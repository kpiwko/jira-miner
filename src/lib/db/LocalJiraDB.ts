'use strict'

import { promisify } from 'util'
import * as Loki from 'lokijs'
import * as moment from 'moment'
import logger from '../logger'
import JiraClient, { JiraQueryOptions } from '../jira/JiraClient';

const HISTORY_SNAPSHOT = '__hiStOry__'


const snapshotInTime = function (date: moment.Moment | string, issue: any) {

  date = date ? moment(date) : moment()

  // skip evaluation is issue has been created after snapshot date
  if (moment(issue.Created).isAfter(date)) {
    return null
  }
  const copy = Object.assign({}, issue)

  Object.keys(issue.History).forEach(field => {
    // find the last change prior 'date' for each field and replace current value
    // in a copy of the issue with that value
    const last = issue.History[field]
      .filter((fieldChange: any) => {
        return moment(fieldChange.change).isBefore(date)
      })
      // FIXME this might not be sorting the right direction
      .sort((a: any, b: any) => {
        // sort ascending, so the latest change is the last element in the list
        return moment(a.change).diff(moment(b.change))
      })

    if (last.length > 0) {
      copy[field] = last[last.length - 1].to
    }
  })

  // remove all comments that have been created after snapshot
  copy.Comment = issue.Comment.filter(comment => {
    return moment(comment.lastUpdated).isBefore(date)
  })

  copy.SnapshotVersion = date.format()
  // remove loki metadata
  delete copy["$loki"]

  return copy
}

export interface HistoryResultset extends Resultset<any> {

}

export interface HistoryCollection<E extends object> {
  name(): string
  history(date: moment.Moment | string): Promise<HistoryCollection<E>>
  where(fun: (data: E) => boolean): (E & LokiObj)[]
  chain(): HistoryResultset
  mapReduce<U, R>(mapFunction: (value: E, index: number, array: E[]) => U, reduceFunction: (ary: U[]) => R): R
  removeWhere(query: ((value: E, index: number, array: E[]) => boolean) | LokiQuery<E & LokiObj>): void
  insert(doc: E[]): E[] | undefined
  count(query?: LokiQuery<E & LokiObj>): number
}

interface JiraDBInstance<E extends object = any> {
  populate(collectionName: string, data: any): Promise<HistoryCollection<E>>
  populate(jira: JiraClient, query: string, optional: JiraQueryOptions, collectionName?: string): Promise<HistoryCollection<any>>
  getHistoryCollection(collectionName: string): Promise<HistoryCollection<E>>
  saveDatabase(): Promise<void>
}

// implementation

class HistoryCollectionImpl<E extends object> implements HistoryCollection<E> {

  collection: Collection<E>
  db: JiraDBInstance

  constructor(collection: Collection<E>, db: JiraDBInstance) {
    this.collection = collection
    this.db = db
  }
  name() {
    return this.collection.name
  }
  where(fun: (data: E) => boolean): (E & LokiObj)[] {
    return this.collection.where(fun)
  }
  mapReduce<U, R>(mapFunction: (value: E, index: number, array: E[]) => U, reduceFunction: (ary: U[]) => R): R {
    return this.collection.mapReduce(mapFunction, reduceFunction)
  }

  chain(): HistoryResultset {
    return this.collection.chain()
  }

  async history(date: moment.Moment | string): Promise<HistoryCollection<E>> {

    const data = this.mapReduce(
      (issue: any) => {
        return snapshotInTime(date, issue)
      },
      (issues: any) => {
        return issues.filter((issue: any) => issue !== null)
      }
    )

    return await this.db.populate(`${HISTORY_SNAPSHOT}-${this.name}-${date.toString()}`, data)
  }

  removeWhere(query: ((value: E, index: number, array: E[]) => boolean) | LokiQuery<E & LokiObj>): void {
    return this.collection.removeWhere(query)
  }
  insert(doc: E[]): E[] | undefined {
    return this.collection.insert(doc)
  }

  count(query?: LokiQuery<E & LokiObj>): number {
    return this.collection.count(query)
  }
}

export class JiraDBFactory {
  constructor() {
  }

  static async localInstance(path: string) {
    const db = new Loki(path, {
      adapter: new Loki.LokiFsAdapter()
    })
    const loadDB = promisify<any>(db.loadDatabase).bind(db, {})
    try {
      await loadDB()
      logger.debug(`Local JIRA database loaded from ${path}`)
    }
    catch (err) {
      logger.warn('Unable to load database, ignoring', path, err)
    }
    return new LocalJiraDBInstance(db, path)
  }
}

export class LocalJiraDBInstance implements JiraDBInstance {

  db: Loki
  path: string

  constructor(db: Loki, path: string) {
    this.db = db
    this.path = path
  }

  async getHistoryCollection(collectionName: string): Promise<HistoryCollection<any>> {
    let collection = this.db.getCollection(collectionName)
    if (collection === null) {
      logger.debug(`Created collection ${collectionName} in database`)
      collection = this.db.addCollection(collectionName, { indices: ['id', 'key'] })
    }

    return new HistoryCollectionImpl(collection, this)
  }
  async populate(jira: JiraClient, query: string, optional: JiraQueryOptions, collectionName?: string): Promise<HistoryCollection<any>>
  async populate(collectionName: string, data: any): Promise<HistoryCollection<any>>
  async populate(...args: any): Promise<HistoryCollection<any>> {
    if (args.length === 2 && typeof args[0] === 'string') {
      return await this._populate(args[0], args[1])
    }
    else if (args.length > 2 && args[0] instanceof JiraClient) {
      const collectionName = (args.length === 4 && args[3]) ? args[3] : 'default'
      const issues = await (<JiraClient>args[0]).fetch(args[1], args[2])
      return await this._populate(collectionName, issues)
    }
    else {
      throw Error(`Invalid populate() call`)
    }
  }

  async _populate(collectionName: string, data: any): Promise<HistoryCollection<any>> {
    let collection = await this.getHistoryCollection(collectionName)

    // data are already in, update based on issue id
    // update might be done a better way - for now it just deletes all previous entries
    const toBeDeleted = data.reduce((acc: string[], issue: any) => {
      acc.push(issue.id)
      return acc
    }, [])

    logger.debug(`Going to drop ${toBeDeleted.length} entries from collection ${collectionName} as they have been updated`)
    collection.removeWhere((issue: any) => {
      return toBeDeleted.includes(issue.id)
    })

    // insert data into database
    logger.debug(`Inserting ${data.length} entries into collection ${collectionName}`)
    collection.insert(data)

    logger.debug(`Collection ${collectionName} now contains ${collection.count()} entries`)
    return collection
  }

  async saveDatabase(): Promise<void> {

    // drop all collections that are actually history snapshots
    const collections = this.db.listCollections()
    collections.forEach(collection => {
      if (collection.name.startsWith(HISTORY_SNAPSHOT)) {
        this.db.removeCollection(collection.name)
      }
    })

    this.db.saveDatabase((err) => {
      if (err) {
        logger.error('Unable to store database', err)
        throw err
      }
      logger.debug(`Database has been saved to ${this.path}`)
    })
  }
}
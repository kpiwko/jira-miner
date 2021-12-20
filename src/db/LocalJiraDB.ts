'use strict'

import { promisify } from 'util'
import Loki from 'lokijs'
import { parseISO, formatISO, isAfter, isBefore, compareAsc } from 'date-fns'
import Logger from '../logger'
import { JiraClient, JiraQuery } from '../jira/JiraClient'
import { FieldChange, Issue } from '../jira/Issue'

const HISTORY_SNAPSHOT = '__hiStOry__'
const logger = new Logger()

const snapshotInTime = function (date: string, issue: Issue) {
  const reference = parseISO(date)

  // skip evaluation is issue has been created after snapshot date
  if (isAfter(parseISO(issue.Created), reference)) {
    return null
  }
  const copy = Object.assign({}, issue)

  Object.keys(issue.History).forEach((field) => {
    // find the last change prior 'date' for each field and replace current value
    // in a copy of the issue with that value
    const last = issue.History[field]
      .filter((fieldChange: FieldChange) => {
        return isBefore(parseISO(fieldChange.change), reference)
      })
      .sort((a: any, b: any) => {
        // sort ascending, so the latest change is the last element in the list
        return compareAsc(parseISO(a.change), parseISO(b.change))
      })

    if (last.length > 0) {
      copy[field] = last[last.length - 1].to
    }
  })

  // remove all comments that have been created after snapshot
  copy.Comment = issue.Comment?.filter((comment: any) => {
    return isBefore(parseISO(comment.lastUpdated), reference)
  })

  copy.SnapshotVersion = formatISO(reference)
  // remove loki metadata
  delete copy['$loki']

  return copy
}

export type CollectionDetails = {
  name: string
  type: string
  count: number
}

export interface HistoryCollection {
  name(): string
  history(date: string): Promise<HistoryCollection>
  where(fun: (data: Issue) => boolean): (Issue & LokiObj)[]
  chain(): Resultset<Issue & LokiObj>
  mapReduce<U, R>(mapFunction: (value: Issue, index: number, array: Issue[]) => U, reduceFunction: (ary: U[]) => R): R
  removeWhere(query: ((value: Issue, index: number, array: Issue[]) => boolean) | LokiQuery<Issue & LokiObj>): void
  insert(doc: Issue[]): Issue[] | undefined
  count(query?: LokiQuery<Issue & LokiObj>): number
  dropHistoryCollections(): number
}

interface JiraDBInstance {
  populate(
    ...args: [jira: JiraClient, query: JiraQuery, collectionName?: string] | [collectionName: string, data: Issue[]]
  ): Promise<HistoryCollection>
  getHistoryCollection(collectionName: string): Promise<HistoryCollection>
  saveDatabase(): Promise<void>
  listCollections(): CollectionDetails[]
  removeCollection(name: string): void
}

// implementation

class HistoryCollectionImpl implements HistoryCollection {
  collection: Collection<Issue>
  db: JiraDBInstance

  constructor(collection: Collection<Issue>, db: JiraDBInstance) {
    this.collection = collection
    this.db = db
  }
  name() {
    return this.collection.name
  }
  where(fun: (data: Issue) => boolean): (Issue & LokiObj)[] {
    return this.collection.where(fun)
  }
  mapReduce<U, R>(mapFunction: (value: Issue, index: number, array: Issue[]) => U, reduceFunction: (ary: U[]) => R): R {
    return this.collection.mapReduce(mapFunction, reduceFunction)
  }

  chain(): Resultset<Issue & LokiObj> {
    return this.collection.chain()
  }

  async history(date: string): Promise<HistoryCollection> {
    const data = this.mapReduce(
      (issue: any) => {
        return snapshotInTime(date, issue)
      },
      (issues: any) => {
        return issues.filter((issue: any) => issue !== null)
      }
    )

    return await this.db.populate(`${HISTORY_SNAPSHOT}-${this.name()}-${date.toString()}`, data)
  }

  removeWhere(query: ((value: Issue, index: number, array: Issue[]) => boolean) | LokiQuery<Issue & LokiObj>): void {
    return this.collection.removeWhere(query)
  }
  insert(doc: Issue[]): Issue[] | undefined {
    return this.collection.insert(doc)
  }

  count(query?: LokiQuery<Issue & LokiObj>): number {
    return this.collection.count(query)
  }

  dropHistoryCollections(): number {
    const collections = this.db.listCollections()
    let count = 0
    collections.forEach((collection) => {
      if (collection.name.startsWith(HISTORY_SNAPSHOT)) {
        this.db.removeCollection(collection.name)
        count++
      }
    })
    return count
  }
}

export class JiraDBFactory {
  static async localInstance(path: string): Promise<LocalJiraDBInstance> {
    const db = new Loki(path, {
      adapter: new Loki.LokiFsAdapter(),
    })
    const loadDB = promisify<any>(db.loadDatabase).bind(db, {})
    try {
      await loadDB()
      logger.debug(`Local JIRA database loaded from ${path}`)
    } catch (err) {
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

  async getHistoryCollection(collectionName: string): Promise<HistoryCollection> {
    let collection = this.db.getCollection(collectionName)
    if (collection === null) {
      logger.debug(`Created collection ${collectionName} in database`)
      collection = this.db.addCollection(collectionName, {
        indices: ['id', 'key'],
      })
    }

    return new HistoryCollectionImpl(collection, this)
  }

  async populate(
    ...args: [jira: JiraClient, query: JiraQuery, collectionName?: string] | [collectionName: string, data: Issue[]]
  ): Promise<HistoryCollection> {
    if (args.length === 2 && typeof args[0] === 'string') {
      return await this._populate(args[0], <Issue[]>args[1])
    } else if (args.length >= 2 && args.length <= 3 && args[0] instanceof JiraClient) {
      const collectionName = args.length === 3 && args[2] ? args[2] : 'default'
      const issues = await (<JiraClient>args[0]).fetch(<JiraQuery>args[1])
      return await this._populate(collectionName, issues)
    } else {
      throw Error(`Invalid populate(${((<unknown>args) as any[]).map((a: any) => typeof a).join(', ')}}) call`)
    }
  }

  async _populate(collectionName: string, data: Issue[]): Promise<HistoryCollection> {
    const collection = await this.getHistoryCollection(collectionName)

    // there might be some data already in the collection, drop previous data with the same id
    // update might be done a better way - for now it just deletes all previous entries
    const toBeDeleted = data.map((issue: Issue) => issue.id)
    let deleted = 0
    collection.removeWhere((issue: Issue) => {
      const removeItem = toBeDeleted.includes(issue.id)
      if (removeItem) {
        deleted++
      }
      return removeItem
    })

    // insert data into database
    logger.debug(
      `Populating collection ${collectionName} with ${data.length} entries. ${deleted} entries will be updated, ${
        data.length - deleted
      } are net new.`
    )
    collection.insert(data)

    logger.debug(`Collection ${collectionName} now contains ${collection.count()} entries`)
    return collection
  }

  async saveDatabase(): Promise<void> {
    // drop all collections that are actually history snapshots
    const collections = this.db.listCollections()
    collections.forEach((collection) => {
      if (collection.name.startsWith(HISTORY_SNAPSHOT)) {
        this.removeCollection(collection.name)
      }
    })

    this.db.saveDatabase((err) => {
      if (err) {
        logger.error(`Unable to store database ${this.path}`)
        logger.error(err)
        throw err
      }
      logger.debug(`Database has been saved to ${this.path}`)
    })
  }

  listCollections(): CollectionDetails[] {
    return (<unknown>this.db.listCollections()) as CollectionDetails[]
  }

  removeCollection(name: string): void {
    this.db.removeCollection(name)
  }
}

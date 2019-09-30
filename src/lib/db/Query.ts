'use strict'


import { HistoryCollection } from './LocalJiraDB'
import logger, { Logger } from '../logger'

export interface QueryResult {
  result: any
  collection: HistoryCollection<any>
  logger: Logger
  args?: object
}

export default class Query {
  collection: HistoryCollection<any>

  constructor(collection: HistoryCollection<any>) {
    this.collection = collection
  }

  async query(queryFunction: (collection: HistoryCollection<any>, logger: Logger, args?: object) => Promise<any> | any, args?: object): Promise<QueryResult> {
    let result: any
    try {
      // wrapping function into promise
      result = await Promise.resolve(queryFunction.call(null, this.collection, logger, args))
    }
    catch (err) {
      throw Error(`Unable to execute query ${queryFunction.toString()}, ${err}`)
    }
    return {
      result,
      collection: this.collection,
      logger,
      args
    }
  }
}
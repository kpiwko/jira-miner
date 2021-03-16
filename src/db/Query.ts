'use strict'

import { HistoryCollection } from './LocalJiraDB'
import Logger from '../logger'

const logger = new Logger()

export interface QueryResult<T> {
  result: T
  collection: HistoryCollection
  logger: Logger
  args?: Record<string, unknown>
}

export default class Query {
  collection: HistoryCollection

  constructor(collection: HistoryCollection) {
    this.collection = collection
  }

  async query<T = any>(
    queryFunction: (collection: HistoryCollection, logger: Logger, args?: Record<string, unknown>) => Promise<T> | T,
    args?: Record<string, unknown>
  ): Promise<QueryResult<T>> {
    let result: T
    try {
      // wrapping function into promise
      result = await Promise.resolve(queryFunction.call(null, this.collection, logger, args))
    } catch (err) {
      logger.error(err)
      throw Error(`Unable to execute query ${queryFunction.toString()}`)
    }
    return {
      result,
      collection: this.collection,
      logger,
      args,
    }
  }
}

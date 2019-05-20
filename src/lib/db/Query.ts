'use strict'


import { HistoryCollection } from './LocalJiraDB'
import JiraClient from '../jira/JiraClient';

export interface QueryResult {
  result: any
  collection: HistoryCollection<any>
  args?: object
  jiraClient?: JiraClient
}

export default class Query {
  collection: HistoryCollection<any>

  constructor(collection: HistoryCollection<any>) {
    this.collection = collection
  }

  async query(queryFunction: (collection: HistoryCollection<any>, args?: object) => Promise<any> | any, args?: object): Promise<QueryResult> {
    let result: any
    try {
      // wrapping function into promise
      result = await Promise.resolve(queryFunction.call(null, this.collection, args))
    }
    catch (err) {
      throw Error(`Unable to execute query ${queryFunction.toString()}, ${err}`)
    }
    return {
      result,
      collection: this.collection,
      args
    }
  }
}
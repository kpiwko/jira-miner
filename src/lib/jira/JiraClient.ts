'use strict'

import * as JiraApi from 'jira-client'
import * as urlParser from 'url'
import * as rpr from 'promise-request-retry'
import logger from '../logger'
import * as rp from 'request-promise'
import { transformAll, isSchemaTyped } from '../utils'
import { Issue } from './Issue';

// max issues to be processed at once
const MAX_RESULTS = 100
// max retries if something goes wrong with request
const MAX_RETRIES = 3

const rpr_retry = function (options:any) : rp.RequestPromiseAPI {
  options = Object.assign({
    retry: MAX_RETRIES
  }, options)
  
  return rpr(options)
}

export interface JiraAuth {
  url: string
  user?: string
  password?: string
}

export interface JiraClientOptions {
  apiVersion?: string,
  debug?: boolean,
  strictSSL?: boolean,
  request?: any
}

export interface JsonResponse {
  [name: string]: any;
}

export interface JiraQueryOptions {//extends JiraApi.SearchQuery {
  startAt?: number;
  maxResults?: number;
  fields?: string[];
  expand?: string[];
}

export default class JiraClient {

  user: string
  url: string
  password: string
  jira: JiraApi
  rp: rp.RequestPromiseAPI

  constructor(auth: JiraAuth, options?: JiraClientOptions) {
    // parse config
    const url = auth.url
    const user = auth.user || ''
    const password = auth.password || ''
    const config = urlParser.parse(url)
    const protocol = config.protocol.replace(/:\s*$/, '')
    const port = config.port ? config.port : (config.protocol.startsWith('https') ? '443' : '80')

    // set default options
    options = Object.assign({
      apiVersion: '2',
      debug: !!process.env.DEBUG || process.env.NODE_DEBUG === 'request',
      strictSSL: true,
      request: rpr_retry
    }, options)

    if (options.debug) {
      logger.debug('Setting up JIRA request debugging on for JiraClient')
      // TS claims that debug property is readonly, need to override that
      rp['debug' as any] = true
    }

    this.jira = new JiraApi(Object.assign({
      protocol: protocol,
      host: config.hostname,
      port: port,
      username: user,
      password: password
    }, options))

    this.url = url
    this.user = user
    this.password = password
    this.rp = options.request
  }

  async fetch(query: string, options?: JiraQueryOptions): Promise<any[]> {

    const defaultQueryOptions = {
      maxResults: MAX_RESULTS,
      startAt: 0,
      expand: ['changelog', 'names'],
      fields: ['*navigable']
    }

    // allow user to specify no expand
    if (options && options.expand && Array.isArray(options.expand) && options.expand.length === 0) {
      defaultQueryOptions.expand = []
    }
    // set default options
    options = Object.assign(defaultQueryOptions, options)

    // query for length first and afterwards query all
    const issues = await this.jira.searchJira(query, options)

    const total = issues.total, maxRes = options.maxResults
    let issueData: any[]

    // return immediately if no further processing is needed
    if (total <= options.maxResults) {
      logger.debug(`Found ${total} issues within limit of ${options.maxResults}, returning list for query ${query}`)
      issueData = issues.issues
    }
    // construct promises to fetch all the data in JIRA query
    else {
      logger.debug(`Found ${total} issues, will trigger multiple queries to get full list for query ${query}`)
      const plist: Promise<JsonResponse>[] = []
      let fetched: number = 0
      for (let i = 0; i <= total; i += maxRes) {
        const limit = i + maxRes > total ? total - i : maxRes
        logger.debug(`Query for items ${i}..${i + limit} out of ${total} in query '${query}'`)
        plist.push(this.jira.searchJira(query, Object.assign(options, {
          maxResults: limit,
          startAt: i
        })
        ).then(async (issues: any) => {
          // chain promise to notify user about progress
          fetched++
          logger.debug(`Fetched ${(fetched * 100.0 / plist.length).toFixed(2)}% of results`, query)
          return issues
        }))
      }
      issueData = await transformAll<JsonResponse, any>((json: JsonResponse) => json.issues, plist)
    }

    logger.debug('Querying jira for custom fields in order to remap them in issues and populate issue history')
    const jiraFields = await this.listFields()

    return issueData.map((issue, index) => {
      if (((index + 1) % maxRes) === 0) {
        logger.debug(`Remapped fields and added history of the first ${index + 1} issues`)
      }
      return new Issue(issue, jiraFields)
    })
  }

  async checkCredentials(): Promise<JiraAuth> {

    const options = {
      method: 'POST',
      url: `${this.url}/rest/auth/1/session`,
      resolveWithFullResponse: true,
      headers: {
        "content-type": "application/json",
      },
      json: true,
      body: {
        'username': this.user,
        'password': this.password
      },
      simple: false,
    }

    const response = await this.rp(options)
    // login was succesfull
    if (response.statusCode === 200) {
      return {
        url: this.url,
        user: this.user,
        password: this.password
        
      }
    }
    // login was not successful
    else if (response.statusCode === 401) {
      throw Error(`Either wrong user ${this.user} or wrong password provided`)
    }
    // captcha triggered
    else if (response.statusCode == 403) {
      Object.keys(response.headers).forEach(header => {
        if (header === 'x-authentication-denied-reason' && response.headers[header].includes('CAPTCHA_CHALLENGE')) {
          throw Error(`Captcha challenge please login via browser at ${response.headers[header]} first`)
        }
      })
      throw Error(`Failed to login to JIRA instance ${this.url} `)
    }
    else {
      throw Error(`Failed to login to JIRA instance ${this.url}, unhandled control flow`)
    }
  }

  async listFields() {
    return await this.jira.listFields()
  }

  async describeFields() {

    const fieldDefinitions = await this.listFields()

    const describeField = function (fieldSchema) {

      if (!isSchemaTyped(fieldSchema, logger)) {
        return ['text', 'Unknown description']
      }

      switch (fieldSchema.schema.type) {
        case 'user':
          return ['text', 'Real user name']
        case 'array':
          const desc = ['array of '].concat(
            describeField({
              schema: {
                type: fieldSchema.schema.items
              }
            })
          )
          return [desc[0] + desc[1], desc[2]]
        case 'datetime':
          return ['datetime', 'Date time value, such as YYYY-MM-DD HH:MM']
        case 'date':
          return ['date', 'Date value, such as YYYY-MM-DD']
        case 'project':
          return ['text', 'Project key in JIRA']
        case 'priority':
          return ['text', 'Proct priority']
        case 'status':
          return ['text', 'Status of the issue']
        case 'resolution':
          return ['text', 'Resolution of the issue']
        case 'issuetype':
          return ['text', 'Type of issue']
        case 'component':
          return ['text', 'Component associated with the issue']
        case 'version':
          return ['text', 'Version associated with the issue']
        case 'issuelinks':
          return ['{key, type}', 'Issue key associated with the link and type of link,\nsuch as Duplicate']
        case 'comments-page':
          return ['array of {lastAuthor, lastUpdated, content}', 'Comments on the issue with last editing user real name,\nthe last date of modification and content']
        default:
          return ['text', 'Unknown description']
      }
    }

    return fieldDefinitions.reduce((acc: any, field: any) => {
      acc.push([field.name].concat(describeField(field)))
      return acc
    }, [])
  }
}
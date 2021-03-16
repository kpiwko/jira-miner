'use strict'

import JiraApi from 'jira-client'
import * as urlParser from 'url'
import promiseRetry from 'promise-request-retry'
import Logger from '../logger'
import rp from 'request-promise'
import pLimit from 'p-limit'
import { isSchemaTyped } from '../utils'
import { changeFieldSchemaType, FieldJson, Issue, IssueJson } from './Issue'

// max issues to be processed at once
export const MAX_RESULTS = 100
// max retries if something goes wrong with request
export const MAX_RETRIES = 3
// max concurrent requests to JIRA API
export const MAX_CONCURRENT_REQUESTS = 10

const logger = new Logger()

export type JiraAuth = {
  url: string
  user?: string
  password?: string
  oauth?: JiraApi.OAuth
}

export type JiraClientOptions = {
  apiVersion?: string
  debug?: boolean
  strictSSL?: boolean
  request?: (options: Record<string, unknown>) => Promise<any>
  maxConcurrentRequests?: number
}

export type JiraQuery = {
  //extends JiraApi.SearchQuery
  query: string
  startAt?: number
  maxResults?: number
  fields?: string[]
  expand?: string[]
}

export class JiraClient {
  public jira: JiraApi
  private url: string
  private user: string
  private password: string
  private maxConcurrentRequests: number
  private rp: (options: Record<string, unknown>) => Promise<any>

  constructor(
    { url: urlToParse, user = '', password = '' }: JiraAuth,
    clientOptions = {
      apiVersion: '2',
      debug: process.env.NODE_DEBUG?.includes('request') || process.env.DEBUG?.includes('request'),
      request: rpr_retry,
      strictSSL: true,
      maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
    } as JiraClientOptions
  ) {
    if (clientOptions.debug) {
      logger.debug('Setting up JIRA request debugging on for JiraClient')
      // TS claims that debug property is readonly, need to override that
      ;(<any>rp)['debug' as any] = true
    } else {
      // since we are changing global state of request, make sure that we change the configuration back to default state
      ;(<any>rp)['debug' as any] = false
    }

    // parse url to find values for jira API
    const url = urlParser.parse(urlToParse)

    this.jira = new JiraApi({
      // connection details
      host: url.hostname ?? '',
      base: url.pathname?.replace(/\/$/, '') ?? '',
      protocol: url.protocol?.replace(/:\s*$/, ''),
      port: url.port ?? (url.protocol?.startsWith('https') ? '443' : '80'),
      apiVersion: clientOptions.apiVersion ?? '2',
      // specific settings
      strictSSL: clientOptions.strictSSL ?? true,
      request: clientOptions.request ?? rpr_retry,
      // credentials
      username: user,
      password: password,
    })
    this.maxConcurrentRequests = clientOptions.maxConcurrentRequests ?? MAX_CONCURRENT_REQUESTS
    this.url = urlToParse
    this.user = user
    this.password = password
    this.rp = clientOptions.request ?? rpr_retry
  }

  async fetch({
    query,
    startAt = 0,
    maxResults = MAX_RESULTS,
    expand = ['changelog', 'names'],
    fields = ['*navigable'],
  }: JiraQuery): Promise<Issue[]> {
    // set default options
    // query for length first and afterwards query all
    const issues = await this.jira.searchJira(query, {
      startAt,
      maxResults,
      expand,
      fields,
    })

    const total = issues.total,
      maxRes = maxResults
    let issueData: Array<IssueJson> = []

    // return immediately if no further processing is needed
    if (total <= maxResults) {
      logger.debug(`Found ${total} issues within limit of ${maxResults}, returning list for query ${query}`)
      issueData = issues.issues
    }
    // construct promises to fetch all the data in JIRA query
    else {
      logger.debug(
        `Found ${total} issues, going to trigger multiple queries (max ${this.maxConcurrentRequests} concurrently) to get all data for the query ${query}`
      )
      const plist: Promise<JiraApi.JsonResponse>[] = []
      const promiseLimit = pLimit(this.maxConcurrentRequests)
      let fetched = 0

      for (let i = 0; i <= total; i += maxRes) {
        const limit = i + maxRes > total ? total - i : maxRes
        plist.push(
          // limit number of concurrently executed promises
          promiseLimit(async () => {
            logger.debug(`Query for items ${i}..${i + limit} out of ${total} in query '${query}'`)
            return await Promise.resolve(
              this.jira.searchJira(query, {
                maxResults: limit,
                startAt: i,
                fields,
                expand,
              })
            ).then(async (issues: any) => {
              // chain promise to notify user about progress
              fetched++
              logger.debug(`Fetched ${((fetched * 100.0) / plist.length).toFixed(2)}% of results`, query)
              return issues
            })
          })
        )
      }
      const results = await Promise.all(plist)
      results.forEach((json: JiraApi.JsonResponse) => {
        issueData.push(...json.issues)
      })
    }

    logger.debug('Querying jira for custom fields in order to remap them in issues and populate issue history')
    const jiraFields = await this.listFields()

    return issueData.map((issue, index) => {
      if ((index + 1) % maxRes === 0) {
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
        'content-type': 'application/json',
      },
      json: true,
      body: {
        username: this.user,
        password: this.password,
      },
      simple: false,
    }

    const response = await this.rp(options)
    // login was succesfull
    if (response.statusCode === 200) {
      return {
        url: this.url,
        user: this.user,
        password: this.password,
      }
    }
    // login was not successful
    else if (response.statusCode === 401) {
      throw Error(`Either wrong user ${this.user} or wrong password provided`)
    }
    // captcha triggered
    else if (response.statusCode == 403) {
      Object.keys(response.headers).forEach((header) => {
        if (header === 'x-authentication-denied-reason' && response.headers[header].includes('CAPTCHA_CHALLENGE')) {
          throw Error(`Captcha challenge please login via browser at ${response.headers[header]} first`)
        }
      })
      throw Error(`Failed to login to JIRA instance ${this.url} `)
    } else {
      throw Error(`Failed to login to JIRA instance ${this.url}, unhandled control flow`)
    }
  }

  async listFields(): Promise<any> {
    return await this.jira.listFields()
  }

  async describeFields(): Promise<Array<[string, string, string]>> {
    const fieldDefinitions = await this.listFields()

    const describeField = (fieldSchema: FieldJson) => {
      if (!isSchemaTyped(fieldSchema, logger)) {
        return ['text', 'Unknown description']
      }

      switch (fieldSchema.schema.type) {
        case 'user':
          return ['text', 'Real user name']
        case 'array':
          const desc: any[] = ['array of '].concat(describeField(changeFieldSchemaType(fieldSchema, fieldSchema.schema.items)))
          return [desc[0] + desc[1], desc[2]]
        case 'datetime':
          return ['datetime', 'Date time value, such as YYYY-MM-DD HH:MM']
        case 'date':
          return ['date', 'Date value, such as YYYY-MM-DD']
        case 'project':
          return ['text', 'Project key in JIRA']
        case 'priority':
          return ['text', 'Project priority']
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
          return [
            'array of {lastAuthor, lastUpdated, content}',
            'Comments on the issue with last editing user real name,\nthe last date of modification and content',
          ]
        default:
          return ['text', `Unknown description for type '${fieldSchema.schema.type}'`]
      }
    }

    return fieldDefinitions.reduce((acc: any, field: FieldJson) => {
      acc.push([field.name].concat(describeField(field)))
      return acc
    }, [])
  }
}

const rpr_retry = (options: Record<string, unknown>): Promise<any> => {
  return promiseRetry({
    retry: MAX_RETRIES,
    ...options,
  })
}

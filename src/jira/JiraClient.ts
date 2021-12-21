'use strict'

import JiraApi from 'jira-client'
import { URL } from 'url'
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
  token?: string
}

export type JiraClientOptions = {
  apiVersion?: string
  verbose?: boolean
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
  private token?: string
  private maxConcurrentRequests: number
  private rp: (options: Record<string, unknown>) => Promise<any>
  private clientOptions: JiraClientOptions
  private verbose: boolean

  constructor(
    { url: urlToParse, token }: JiraAuth,
    clientOptions = {
      apiVersion: '2',
      verbose: process.env.NODE_DEBUG?.includes('request') || process.env.DEBUG?.includes('request'),
      request: rpr_retry,
      strictSSL: true,
      maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
    } as JiraClientOptions
  ) {
    if (clientOptions.verbose) {
      logger.debug('Setting up JIRA request debugging on for JiraClient')
      // TS claims that debug property is readonly, need to override that
      ;(<any>rp)['debug' as any] = true
    } else {
      // since we are changing global state of request, make sure that we change the configuration back to default state
      ;(<any>rp)['debug' as any] = false
    }

    // parse url to find values for jira API
    const url = new URL(urlToParse)

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
      bearer: token,
    })
    this.maxConcurrentRequests = clientOptions.maxConcurrentRequests ?? MAX_CONCURRENT_REQUESTS
    this.url = urlToParse
    this.token = token
    this.clientOptions = clientOptions
    this.rp = clientOptions.request ?? rpr_retry
    this.verbose = clientOptions.verbose ?? false
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

    if (this.verbose) {
      logger.debug(`JIRA fields raw data: ${JSON.stringify(jiraFields, null, 2)}`)
    }

    return issueData.map((issue, index) => {
      if ((index + 1) % maxRes === 0) {
        logger.debug(`Remapped fields and added history of the first ${index + 1} issues`)
      }
      if (this.verbose) {
        logger.debug(`JIRA Issue ${index} raw data: ${JSON.stringify(issue, null, 2)}`)
      }
      return new Issue(issue, jiraFields)
    })
  }

  async checkCredentials(): Promise<JiraAuth> {
    const options = {
      method: 'GET',
      url: `${this.url}/rest/${this.clientOptions.apiVersion}/myself`,
      resolveWithFullResponse: true,
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      json: true,
      simple: false,
    }

    const response = await this.rp(options)
    // login was succesfull
    if (response.statusCode === 200) {
      const loggedIn = response.headers?.['x-seraph-loginreason'] as string | undefined
      const username = response.headers?.['x-ausername'] as string | undefined
      if ('OK' === loggedIn) {
        logger.debug(`Logged in as ${username}`)
        return {
          url: this.url,
          token: this.token,
        }
      }
      throw Error(`Unable to authorize with the token`)
    }
    // login was not successful
    else if (response.statusCode === 401) {
      throw Error(`Unable to authorize with the token`)
    }
    // captcha triggered
    else if (response.statusCode == 429) {
      throw Error(`Failed to login to JIRA instance ${this.url}, API rate limit hit`)
    } else {
      throw Error(`Failed to login to JIRA instance ${this.url}, unhandled control flow`)
    }
  }

  async listFields(): Promise<any> {
    return await this.jira.listFields()
  }

  async describeFields(): Promise<Array<[string, string, string, string]>> {
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

    return fieldDefinitions.map((field: FieldJson) => {
      return [field.name, field.id, ...describeField(field)]
    })
  }
}

const rpr_retry = (options: Record<string, unknown>): Promise<any> => {
  return promiseRetry({
    retry: MAX_RETRIES,
    ...options,
  })
}

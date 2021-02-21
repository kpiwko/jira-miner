'use strict'

import path from 'path'
import _ from 'lodash'
import { stripIndent } from 'common-tags'
import { JiraDBFactory } from '../db/LocalJiraDB'
import Logger from '../logger'
import Configuration from '../Configuration'
import { JiraClient, JiraQuery, MAX_CONCURRENT_REQUESTS } from '../jira/JiraClient'

const logger = new Logger()

const command = 'populate <query>'
const describe = 'Populate local database with data based on query'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const builder = (yargs: any): any => {
  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE || process.cwd()

  return yargs
    .usage(
      stripIndent`
      usage: $0 populate <query> [options]

      Downloads data from targeted JIRA instead based on <query> and stores them in local database.
      <query> is JQL query string`
    )
    .option('db', {
      alias: 'd',
      describe: 'Database location',
      default: path.resolve(HOME, '.jira-minerdb'),
      defaultDescription: '.jira-minerdb in HOME directory',
    })
    .option('fields', {
      alias: 'f',
      describe: 'Fields to be fetched during query, comma separated syntax. Options: *navigable, comment, *all',
      type: 'string',
      default: '*all',
      defaultDescription: 'All fields',
    })
    .option('since', {
      alias: 's',
      describe: 'Fetch only issues updated since the value',
      type: 'string',
    })
    .option('throttle', {
      alias: 'l',
      describe: 'Limit number of concurrent API requests to JIRA during data fetch',
      type: 'number',
      default: MAX_CONCURRENT_REQUESTS,
    })
    .option('ignore-history', {
      describe: 'Ignore changelog of the issue',
      type: 'boolean',
      default: false,
      defaultDescription: 'false',
    })
    .positional('query', {
      describe: 'JQL query',
    })
    .help('help')
    .wrap(null)
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const handler = (argv: any): any => {
  const query: JiraQuery = {
    query: `${argv.query}${argv.since ? ` AND updated>=${argv.since}` : ''}`,
    fields: argv.fields?.split(','),
    expand: !argv.ignoreHistory ? ['changelog', 'names'] : ['names'],
  }
  const config = new Configuration()
  const target = argv.target
  const debugRequestModule = argv.verbose >= 2 ? true : false
  const throttle = argv.throttle

  // this function is the only function that will be executed in the CLI scope, so we are ignoring that yargs is not able to handle async/await
  async function wrap(): Promise<void> {
    try {
      const db = await JiraDBFactory.localInstance(argv.db)
      const jiraConfig = await config.readConfiguration()
      const jiraAuth = _.find(jiraConfig, (c) => c.target === target)
      if (!jiraAuth) {
        throw Error(`Unable to create Jira Client with target ${target}, such configuration was not found`)
      }
      const jira = new JiraClient(jiraAuth.jira, {
        debug: debugRequestModule,
        maxConcurrentRequests: throttle,
      })
      logger.info(`Fetched query from JIRA and will store in ${argv.db}`, {
        query,
      })
      await db.populate(jira, query)
      await db.saveDatabase()
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  }

  // we can ignore await here - this is the only call in the process
  wrap()
}

export { command, describe, builder, handler }

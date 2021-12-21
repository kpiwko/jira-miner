'use strict'

import path from 'path'
import { stripIndent } from 'common-tags'
import { JiraDBFactory } from '../db/LocalJiraDB'
import Logger from '../logger'
import { JiraClient, JiraQuery, MAX_CONCURRENT_REQUESTS } from '../jira/JiraClient'

const logger = new Logger()

const command = 'populate <query>'
const describe = 'Populate local database with data based on query'

const builder = (yargs: any): any => {
  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE || process.cwd()

  return yargs
    .usage(
      stripIndent`
      usage: $0 populate --url <url> --token <token> [options] <query> 

      Downloads data from targeted JIRA instead based on <query> and stores them in local database.
      <query> is JQL query string`
    )
    .option('url', {
      alias: 'u',
      describe: 'URL of JIRA instance to connect to',
      type: 'string',
      default: process.env.JIRA_URL,
      defaultDescription: 'JIRA URL from JIRA_URL environment variable',
    })
    .option('token', {
      alias: 't',
      describe: 'JIRA Personal Access Token',
      default: process.env.JIRA_TOKEN,
      defaultDescription: 'JIRA Personal Access Token from JIRA_TOKEN environment variable',
      type: 'string',
    })
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

const handler = (argv: any): any => {
  const query: JiraQuery = {
    query: `${argv.query}${argv.since ? ` AND updated>=${argv.since}` : ''}`,
    fields: argv.fields?.split(','),
    expand: !argv.ignoreHistory ? ['changelog', 'names'] : ['names'],
  }
  const debugRequestModule = argv.verbose >= 2 ? true : false
  const { url, token, throttle, db } = argv

  // this function is the only function that will be executed in the CLI scope, so we are ignoring that yargs is not able to handle async/await
  async function wrap(): Promise<void> {
    try {
      const database = await JiraDBFactory.localInstance(db)
      const jira = new JiraClient(
        { url, token },
        {
          verbose: debugRequestModule,
          maxConcurrentRequests: throttle,
        }
      )
      logger.info(`Fetched query from JIRA and will store in ${db}`, {
        query,
      })
      await database.populate(jira, query)
      await database.saveDatabase()
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  }

  // we can ignore await here - this is the only call in the process
  wrap()
}

export { command, describe, builder, handler }

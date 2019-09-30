'use strict'

import * as path from 'path'
import * as _ from 'lodash'
import { stripIndent } from 'common-tags'
import { JiraDBFactory } from '../lib/db/LocalJiraDB'
import logger from '../lib/logger'
import Configuration from '../lib/Configuration'
import JiraClient, { JiraAuth } from '../lib/jira/JiraClient'


const command = 'populate <query>'
const describe = 'Populate local database with data based on query'
const builder = function (yargs) {

  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

  return yargs
    .usage(stripIndent`
      usage: $0 populate <query> [options]

      Downloads data from targeted JIRA instead based on <query> and stores them in local database.
      <query> is JQL query string`
    )
    .option('db', {
      alias: 'd',
      describe: 'Database location',
      default: path.resolve(HOME, '.jira-minerdb'),
      defaultDescription: '.jira-minerdb in HOME directory'
    })
    .option('fields', {
      alias: 'f',
      describe: 'Fields to be fetched during query, comma separated syntax',
      type: 'string',
      default: '*navigable,comment',
      defaultDescription: 'All navigable fields (*navigable) and comments'
    })
    .option('since', {
      alias: 's',
      describe: 'Fetch only issues updated since the value',
      type: 'string'
    })
    .option('ignore-history', {
      describe: 'Ignore changelog of the issue',
      type: 'boolean',
      default: false,
      defaultDescription: 'false'
    })
    .positional('query', {
      describe: 'JQL query'
    })
    .help('help')
    .wrap(null)
}

const handler = function (argv: any) {

  const optional = {
    fields: argv.fields.split(','),
    expand: !argv.ignoreHistory ? ['changelog', 'names'] : ['names']
  }
  const query = `${argv.query}${argv.since ? ` AND updated>=${argv.since}` : ''}`
  const config = new Configuration()
  const target = argv.target
  const debug = argv.verbose >= 2 ? true : false

  // this function is the only function that will be executed in the CLI scope, so we are ignoring that yargs is not able to handle async/await
  async function wrap(): Promise<void> {
    try {
      const db = await JiraDBFactory.localInstance(argv.db)
      const jiraConfig = await config.readConfiguration()
      const jiraAuth = _.find(jiraConfig, (c) => c.target === target)
      if(!jiraAuth) {
        throw Error(`Unable to create Jira Client with target ${target}, such configuration was not found`)
      }
      const jira = new JiraClient(jiraAuth.jira, { debug: debug })
      logger.info(`Fetched query from JIRA and will store in ${argv.db}`, { query })
      await db.populate(jira, query, optional)
      await db.saveDatabase()
    }
    catch (err) {
      console.error(err)
      process.exit(1)
    }
  }

  // we can ignore await here - this is the only call in the process
  wrap()
}

module.exports = { command, describe, builder, handler }

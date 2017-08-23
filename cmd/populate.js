'use strict'

const path = require('path')
const stripIndent = require('common-tags').stripIndent
const config = require('../lib/config')
const jiraClient = require('../lib/jira/client')
const DB = require('../lib/db/client')
const jiraPopulate = require('../lib/jira/populate')
const logger = require('../lib/logger')


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
      type: ''
    })
    .option('ignore-history', {
      describe: 'Ignore changelog of the issue',
      type: 'boolean',
      default: false,
      defaultDescription: 'false'
    })
    .demand(1)
    .help('help')
    .wrap(null)
}

const handler = function(argv) {

  const optional = {
    fields: argv.fields.split(','),
    expand: !argv.ignoreHistory ? ['changelog', 'names'] : ['names']
  }
  const query = `${argv.query}${argv.since ? ` AND updated>=${argv.since}`: ''}`

  Promise.all([DB(argv.db), config.readConfiguration()])
    .then(([db, c]) => {
      const jira = jiraClient(c.jira.url, c.jira.user, c.jira.password)
      logger.info(`Fetched query from JIRA and will store in ${argv.db}`, {query})
      return Promise.all([Promise.resolve(c), Promise.resolve(db), jiraPopulate(jira, db, query, optional), jira.listFields()])
    })
    .then(([config, db, collection]) => {
      db.saveDatabase(() => {
        logger.info(`Updated local database in ${argv.db}`)
      })
    })
    .catch(err => {
      logger.error(err)
      process.exit(1)
    })
}

module.exports = {command, describe, builder, handler }

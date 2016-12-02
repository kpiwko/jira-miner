'use strict'

const path = require('path')
const logger = require('../lib/logger')
const config = require('../lib/config')
const jiraClient = require('../lib/jira/client')
const DB = require('../lib/db/client')
const jiraPopulate = require('../lib/jira/populate')


const command = 'populate <query>'
const describe = 'Populate local database with data based on query'
const builder = function (yargs) {

  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

  return yargs
    .usage(`usage: $0 populate <query> [options]

  Downloads data from targeted JIRA instead based on <query> and stores them in local database.
  <query> is JQL query string`)
    .option('db', {
      alias: 'd',
      describe: 'Database location',
      default: path.resolve(HOME, '.jira-minerdb2'),
      defaultDescription: '.jira-minerdb in HOME directory'
    })
    .option('collection', {
      alias: 'c',
      describe: 'Collection name',
      default: 'default',
      defaultDescription: 'default'
    })
    .option('fields', {
      alias: 'f',
      describe: 'Fields to be fetched during query, comma separated syntax',
      type: 'string',
      default: '*navigable',
      defaultDescription: 'All navigable fields (*navigable)'
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
    expand: !argv.ignoreHistory ? ['changelog'] : []
  }
  const query = `${argv.query}${argv.since ? ` AND updated>=${argv.since}`: ''}`

  Promise.all([DB(argv.db), config.readConfiguration()])
    .then(([db, c]) => {
      const jira = jiraClient(c.jira.url, c.jira.user, c.jira.password)
      logger.trace({query, optional}, `Fetching query from JIRA and storing in ${argv.db} in collection ${argv.collection}`)
      return Promise.all([Promise.resolve(c), Promise.resolve(db), jiraPopulate(jira, db, query, optional, argv.collection)])
    })
    .then(([config, db, collection]) => {
      db.saveDatabase(() => {
        console.log(`Updated and stored collection ${argv.collection} in ${argv.db}`)
      })
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = {command, describe, builder, handler}

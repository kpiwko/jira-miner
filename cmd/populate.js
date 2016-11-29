'use strict'

const fs = require('fs')
const path = require('path')
const request = require('request')
const logger = require('../lib/logger')
const config = require('../lib/config')
const jiraClient = require('../lib/jira/client')


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
      defaultValue: path.resolve(HOME, '.jira-minerdb'),
      defaultDescription: '.jira-minerdb in HOME directory'
    })
    .option('fields', {
      alias: 'f',
      describe: 'Fields to be fetched during query',
      type: 'array',
      defaultValue: ['*navigable'],
      defaultDescription: 'All navigable fields (*navigable)'
    })
    .option('ignore-history', {
      describe: 'Ignore changelog of the issue',
      type: 'boolean',
      defaultValue: false,
      defaultDescription: 'false'
    })
    .demand(1)
    .help('help')
    .wrap(null)
}

const handler = function(argv) {
  const query = argv.query

  const jira = jiraClient.

  console.log(query)
}

module.exports = {command, describe, builder, handler}

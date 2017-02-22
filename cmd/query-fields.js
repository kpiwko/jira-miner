'use strict'

const fs = require('fs')
const path = require('path')
const Table = require('cli-table')
const prettyjson = require('prettyjson')
const stripIndent = require('common-tags').stripIndent
const config = require('../lib/config')
const jiraClient = require('../lib/jira/client')
const describeFields = require('../lib/jira/normalizer').describeFields
const logger = require('../lib/logger')

const command = 'query-fields'
const describe = 'List fields that can be queried by query command'
const builder = function (yargs) {

  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

  return yargs
    .usage(stripIndent`
      usage: $0 query-fields [options]

      List fields that can be used in query for currently targeted JIRA instance`)
    .help('help')
    .wrap(null)
}

const handler = function(argv) {

  config.readConfiguration()
    .then(config => {
      const jira = jiraClient(config.jira.url, config.jira.user, config.jira.password)
      return jira.listFields()
        .then(fields => {
          return Promise.resolve(describeFields(fields))
        })
    })
    .then(description => {

      const table = new Table({
        head: ['Name', 'Type', 'Description'],
        colWidths: [30, 15, 75]
      })

      description = description.sort((a, b) => {
        const left = a[0]
        const right = b[0]

        if (left < right) {
          return -1
        }
        if (left > right) {
          return 1
        }
        return 0
      })

      description.forEach(desc => table.push(desc))

      console.log(table.toString())
    })
    .catch(err => {
      logger.error(err)
      process.exit(1)
    })
}

module.exports = {command, describe, builder, handler}

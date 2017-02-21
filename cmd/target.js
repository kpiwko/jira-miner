'use strict'

const fs = require('fs')
const path = require('path')
const request = require('request')
const stripIndent = require('common-tags').stripIndent
const jiraTarget = require('../lib/jira/target')
const config = require('../lib/config')
const logger = require('../lib/logger')

const command = 'target <url>'
const describe = 'Connect to a JIRA module that will be used as data source'
const builder = function (yargs) {
  return yargs
    .usage(stripIndent`
      usage: $0 target <url> [options]

      Connects to JIRA <url> that will used as data source.
        <url> example - https://issues.jboss.org`)
    .option('user', {
      alias: 'u',
      describe: 'User name',
    })
    .option('password', {
      alias: 'p',
      describe: 'Password',
    })
    .demand(1)
    .help('help')
    .wrap(null)
}

const handler = function(argv) {
  const jiraUrl = argv.url

  jiraTarget.checkCredentials(jiraUrl, argv.user, argv.password)
    .then(credentials => {
      logger.info('Successfully targeted JIRA', {url: credentials.jira.url, user: credentials.jira.user})
      return config.updateConfiguration(credentials)
    })
    .catch(err => {
      logger.error({err})
      process.exit(1)
    })
}

module.exports = {command, describe, builder, handler}

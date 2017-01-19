'use strict'

const fs = require('fs')
const path = require('path')
const request = require('request')
const logger = require('../lib/logger')
const jiraTarget = require('../lib/jira/target')
const config = require('../lib/config')

const command = 'target <url>'
const describe = 'Connect to a JIRA module that will be used as data source'
const builder = function (yargs) {
  return yargs
    .usage(`usage: $0 target <url> [options]

  Connects to JIRA <url> that will used as data source
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
      console.log({url: credentials.jira.url, user: credentials.jira.user}, 'Successfully targeted JIRA')
      return config.updateConfiguration(credentials)
    })
    .catch(err => {
      console.error({err})
      process.exit(1)
    })
}

module.exports = {command, describe, builder, handler}

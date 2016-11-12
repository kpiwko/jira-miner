'use strict'

const fs = require('fs')
const path = require('path')
const request = require('request')
const logger = require('../lib/logger')
const jiraTarget = require('../lib/jira/target')

const command = 'target <url>'
const describe = 'Connect to a JIRA module that will be used as data source'
const builder = function (yargs) {
  return yargs
    .usage('usage: $0 target <url> [options]')
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
  const jiraUrl = argv.url;

  jiraTarget.checkCredentials(jiraUrl, argv.user, argv.password)
    .then(config => {
      console.log({url: config.url, user: config.user}, 'Successfully targeted JIRA')
      return jiraTarget.writeConfiguration(config)
    })
    .catch(err => {
      console.error({err})
      process.exit(1)
    })
}

module.exports = {command, describe, builder, handler}

'use strict'

import { stripIndent } from 'common-tags'
import JiraClient from '../lib/jira/JiraClient'
import Configuration from '../lib/Configuration'
import logger from '../lib/logger'

const command = 'target <url>'
const describe = 'Connect to a JIRA module that will be used as data source'
const builder = function (yargs) {
  return yargs
    .usage(
      stripIndent`
      usage: $0 target <url> [options]

      Connects to JIRA <url> that will used as data source.
    `)
    .option('user', {
      alias: 'u',
      describe: 'User name',
      type: 'string'
    })
    .option('password', {
      alias: 'p',
      describe: 'Password',
      type: 'string'
    })
    .positional('url', {
      describe: 'JIRA instance url, example https://issues.jboss.org'
    })
    .help('help')
    .wrap(null)
}

const handler = function (argv) {
  const debug = argv.verbose >= 2 ? true : false
  const target = argv.target
  const config = new Configuration()
  const jiraClient = new JiraClient({
      url: argv.url,
      user: argv.user,
      password: argv.password
  }, { debug })

  // this function is the only function that will be executed in the CLI scope, so we are ignoring that yargs is not able to handle async/await
  async function wrap(): Promise<void> {
    try {
      const jira = await jiraClient.checkCredentials()
      logger.info('Successfully targeted JIRA', {
        url: jira.url,
        user: jira.user
      })
      await config.updateConfiguration([{
        target,
        jira
      }])
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

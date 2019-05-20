'use strict'

import * as Table from 'cli-table'
import { stripIndent } from 'common-tags'
import Configuration from '../lib/Configuration'
import JiraClient, { JiraAuth } from '../lib/jira/JiraClient'
import logger from '../lib/logger'

const command = 'query-fields'
const describe = 'List fields that can be queried by query command'
const builder = function (yargs) {

  return yargs
    .usage(
      stripIndent`
      usage: $0 query-fields [options]

      List fields that can be used in query for currently targeted JIRA instance`
    )
    .help('help')
    .wrap(null)
}

const handler = function (argv) {
  const config = new Configuration()

  const table = new Table({
    head: ['Name', 'Type', 'Description'],
    colWidths: [30, 30, 65],
  })


  // this function is the only function that will be executed in the CLI scope, so we are ignoring that yargs is not able to handle async/await
  async function wrap(): Promise<void> {
    try {
      const jiraAuth = await config.readConfiguration()
      const jira = new JiraClient(jiraAuth)
      let description = await jira.describeFields()

      description = description.sort((a: any[], b: any[]) => {
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

      description.forEach((desc: any[]) => table.push(desc))
      console.log(table.toString())
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

import Table from 'cli-table'
import { stripIndent } from 'common-tags'
import Configuration from '../Configuration'
import { JiraClient } from '../jira/JiraClient'

const command = 'query-fields'
const describe = 'List fields that can be queried by query command'
const builder = (yargs: any): any => {
  return yargs
    .usage(
      stripIndent`
      usage: $0 query-fields [options]

      List fields that can be used in query for currently targeted JIRA instance`
    )
    .help('help')
    .wrap(null)
}

const handler = (argv: any): any => {
  const config = new Configuration()
  const verbose = argv.verbose >= 2 ? true : false
  const target = argv.target

  const table = new Table({
    head: ['Name', 'id', 'Type', 'Description'],
    colWidths: [30, 30, 20, 50],
  })

  // this function is the only function that will be executed in the CLI scope, so we are ignoring that yargs is not able to handle async/await
  async function wrap(): Promise<void> {
    try {
      const jiraConfig = await config.readConfiguration()
      const jiraAuth = jiraConfig.find((c) => c.target === target)
      if (!jiraAuth) {
        throw Error(`Unable to create Jira Client with target ${target}, such configuration was not found`)
      }
      const jira = new JiraClient(jiraAuth.jira, { verbose: verbose })
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
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  }
  // we can ignore await here - this is the only call in the process
  wrap()
}

module.exports = { command, describe, builder, handler }

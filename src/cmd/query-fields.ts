import Table from 'cli-table'
import { stripIndent } from 'common-tags'
import { JiraClient } from '../jira/JiraClient'

const command = 'query-fields'
const describe = 'List fields that can be queried by query command'
const builder = (yargs: any): any => {
  return yargs
    .usage(
      stripIndent`
      usage: $0 query-fields --url <url> --token <token> [options]

      List fields that can be used in query for currently targeted JIRA instance`
    )
    .option('url', {
      alias: 'u',
      describe: 'URL of JIRA instance to connect to',
      type: 'string',
      default: process.env.JIRA_URL,
      defaultDescription: 'JIRA URL from JIRA_URL environment variable',
    })
    .option('token', {
      alias: 't',
      describe: 'JIRA Personal Access Token',
      default: process.env.JIRA_TOKEN,
      defaultDescription: 'JIRA Personal Access Token from JIRA_TOKEN environment variable',
      type: 'string',
    })
    .help('help')
    .wrap(null)
}

const handler = (argv: any): any => {
  const verbose = argv.verbose >= 2 ? true : false
  const { url, token } = argv

  const table = new Table({
    head: ['Name', 'id', 'Type', 'Description'],
    colWidths: [30, 30, 20, 50],
  })

  // this function is the only function that will be executed in the CLI scope, so we are ignoring that yargs is not able to handle async/await
  async function wrap(): Promise<void> {
    try {
      const jira = new JiraClient({ url, token }, { verbose: verbose })
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

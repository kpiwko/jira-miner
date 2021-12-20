import { stripIndent } from 'common-tags'
import { JiraClient } from '../jira/JiraClient'
import Configuration from '../Configuration'
import Logger from '../logger'

const logger = new Logger()
const command = 'target <url>'
const describe = 'Connect to a JIRA module that will be used as data source'
const builder = function (yargs: any) {
  return yargs
    .usage(
      stripIndent`
      usage: $0 target <url> [options]

      Connects to JIRA <url> that will used as the data source.
    `
    )
    .option('token', {
      alias: 'p',
      describe: 'Personal access token',
      type: 'string',
    })
    .positional('url', {
      describe: 'JIRA instance url, example https://issues.redhat.com',
    })
    .help('help')
    .wrap(null)
}

const handler = function (argv: any) {
  const verbose = argv.verbose >= 2 ? true : false
  const target = argv.target
  const config = new Configuration()
  const jiraClient = new JiraClient(
    {
      url: argv.url,
      token: argv.token,
    },
    { verbose: verbose }
  )

  // this function is the only function that will be executed in the CLI scope, so we are ignoring that yargs is not able to handle async/await
  async function wrap(): Promise<void> {
    try {
      const jira = await jiraClient.checkCredentials()
      logger.info('Successfully targeted JIRA', {
        url: jira.url,
        token: jira.token,
      })
      await config.updateConfiguration([
        {
          target,
          jira,
        },
      ])
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  }

  // we can ignore await here - this is the only call in the process
  wrap()
}

module.exports = { command, describe, builder, handler }

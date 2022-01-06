#!/usr/bin/env -S node --experimental-specifier-resolution=node --loader=ts-node/esm --max-old-space-size=8196 --no-warnings

import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import Logger from './logger'
import { JiraClient, JiraQuery, MAX_CONCURRENT_REQUESTS } from './jira/JiraClient'
import { JiraDBFactory } from './db/LocalJiraDB'
import * as prettyjson from 'prettyjson'
import Table from 'cli-table'
import { Parser } from 'json2csv'
import Query from './db/Query'
import { stripIndent } from 'common-tags'

const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE || process.cwd()
const logger = new Logger()

const setDebug = (argv: any) => {
  if (argv['verbose']) {
    logger.setDebug()
    logger.debug('Enabled debug logs')
  }
}

const populate = async (argv: any) => {
  setDebug(argv)

  const query: JiraQuery = {
    query: `${argv.query}${argv.since ? ` AND updated>=${argv.since}` : ''}`,
    fields: argv.fields?.split(','),
    expand: !argv.ignoreHistory ? ['changelog', 'names'] : ['names'],
  }

  const debugRequestModule = argv.verbose >= 2 ? true : false
  const { url, token, throttle, db } = argv

  const database = await JiraDBFactory.localInstance(db)
  const jira = new JiraClient(
    { url, token },
    {
      verbose: debugRequestModule,
      maxConcurrentRequests: throttle,
    }
  )
  logger.info(`Fetched query from JIRA and will store in ${db}`, {
    query,
  })
  await database.populate(jira, query)
  await database.saveDatabase()
}

const query = async (argv: any) => {
  setDebug(argv)

  if ([argv.csv, argv.tsv, argv.json].filter((val) => val).length > 1) {
    throw Error(`Multiple output arguments provided`)
  }

  const queryFilePath = path.resolve(process.cwd(), argv.file)

  // get query from file
  let queryFile: any
  try {
    queryFile = await import(queryFilePath)
  } catch (err) {
    logger.error(`Unable to load ${queryFilePath}`)
    logger.error(err)
    process.exit(2)
  }

  if (!queryFile.query) {
    logger.error(`Query file ${queryFilePath} does not contain query() script`)
    process.exit(1)
  }

  logger.info(`Executing query from ${queryFilePath}`)

  const db = await JiraDBFactory.localInstance(argv.db)
  const collection = await db.getHistoryCollection('default')

  if (collection === null) {
    throw Error(`No collection 'default' is available in ${argv.db}`)
  }

  const query = new Query(collection)
  const result = await query.query(queryFile.query, argv)

  // if no specific format flag was provided and transformation function is provided, execute it
  if (!argv.json && !argv.csv && !argv.tsv && queryFile.transform && queryFile.transform instanceof Function) {
    await Promise.resolve(queryFile.transform(result))
  } else {
    if (argv.json) {
      console.info(JSON.stringify(result.result, null, 2))
    } else if (argv.csv) {
      console.info(new Parser({ header: false }).parse(result.result))
    } else if (argv.tsv) {
      console.info(new Parser({ header: false, delimiter: '\t' }).parse(result.result))
    } else {
      console.info(prettyjson.render(result.result))
    }
  }

}

const queryFields = async (argv: any) => {
  setDebug(argv)

  const verbose = argv.verbose >= 2 ? true : false
  const { url, token } = argv

  const table = new Table({
    head: ['Name', 'id', 'Type', 'Description'],
    colWidths: [30, 30, 20, 50],
  })

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
  console.info(table.toString())
}

const parser = yargs(hideBin(process.argv))
  .usage(stripIndent`
  usage: $0 <command>

  Jira - miner is a tool that allows you to query and transform locally cached JIRA database.
  For more information about commands, use run '$0 help <command>'`
  )
  .command({
    command: 'populate <query>',
    describe: 'Populate local database with data based on query',
    builder: (yargs) => yargs
      .usage(`
      usage: $0 populate--url <url> --token <token> [options] <query>

      Downloads data from targeted JIRA instead based on < query > and stores them in local database.
      <query> is JQL query string`
      )
      .env('JIRA')
      .option('url', {
        alias: 'u',
        describe: 'URL of JIRA instance to connect to',
        type: 'string',
        defaultDescription: 'JIRA URL from JIRA_URL environment variable',
      })
      .option('token', {
        alias: 't',
        describe: 'JIRA Personal Access Token',
        type: 'string',
        defaultDescription: 'JIRA Personal Access Token from JIRA_TOKEN environment variable',
      })
      .option('db', {
        alias: 'd',
        describe: 'Database location',
        default: path.resolve(HOME, '.jira-minerdb'),
        defaultDescription: '.jira-minerdb in HOME directory',
      })
      .option('fields', {
        alias: 'f',
        describe: 'Fields to be fetched during query, comma separated syntax. Options: *navigable, comment, *all',
        type: 'string',
        default: '*all',
        defaultDescription: 'All fields',
      })
      .option('since', {
        alias: 's',
        describe: 'Fetch only issues updated since the value',
        type: 'string',
      })
      .option('throttle', {
        alias: 'l',
        describe: 'Limit number of concurrent API requests to JIRA during data fetch',
        type: 'number',
        default: MAX_CONCURRENT_REQUESTS,
      })
      .option('ignore-history', {
        describe: 'Ignore changelog of the issue',
        type: 'boolean',
        default: false,
        defaultDescription: 'false',
      })
      .positional('query', {
        describe: 'JQL query',
      })
      .help(),
    handler: populate
  })
  .command({
    command: 'query <file>',
    describe: 'Queriers local JIRA database using query script stored in file',
    builder: (yargs) => yargs
      .usage(stripIndent`
      usage: jira-miner query [options] <file>

      Queries and processes local database using a TypeScript script located in a file.
      File is supposed to export 'query()' function and can optionally export 'transform(), otherwise it will process return of 'query()' function as JSON.
      If this is not desired behavior, user can provide --output 'csv|tsv|json|prettyjson' flag.
      In case that 'transform(result: QueryResult)' is provided and '--output <value>' flag is not provided, it is responsible for handling output itself.
  
      Example script:
      ---
  
        import { HistoryCollection } from 'jira-miner/db/LocalJiraDB'
        import Logger from 'jira-miner/logger'
  
        export async function query(collection: HistoryCollection, logger: Logger, args?: Record<any, unknown>): Promise<any> {
          return {}
        }
  
        export async function transform({ result, logger }: { result: any; logger: Logger }): Promise<void> {
          console.log(JSON.stringify(result, null, 2))
        }
  
      ---`
      )
      .env('JIRA')
      .option('db', {
        alias: 'd',
        describe: 'Database location',
        default: path.resolve(HOME, '.jira-minerdb'),
        defaultDescription: '.jira-minerdb in HOME directory',
      })
      .option('json', {
        describe: 'Print out query outcome in JSON format',
        type: 'boolean',
        default: false,
      })
      .option('csv', {
        describe: 'Print out query outcome in CSV format',
        type: 'boolean',
        default: false,
      })
      .option('tsv', {
        describe: 'Print out query outcome in Tab Separated Value format',
        type: 'boolean',
        default: false,
      })
      .positional('file', {
        describe: 'File with the query',
      })
      .help(),
    handler: query
  })
  .command({
    command: 'query-fields',
    describe: 'List JIRA fields that can be queried in the query script',
    builder: (yargs) => yargs
      .usage(stripIndent`
      usage: $0 query-fields --url <url> --token <token> [options]

      List fields that can be used in query for currently targeted JIRA instance`
      )
      .env('JIRA')
      .option('url', {
        alias: 'u',
        describe: 'URL of JIRA instance to connect to',
        type: 'string',
        demandOption: true,
        defaultDescription: 'JIRA URL from JIRA_URL environment variable',
      })
      .option('token', {
        alias: 't',
        describe: 'JIRA Personal Access Token',
        type: 'string',
        demandOption: true,
        defaultDescription: 'JIRA Personal Access Token from JIRA_TOKEN environment variable',
      }),
    handler: queryFields,
  })
  .option('verbose', {
    alias: 'v',
    describe: 'Be more verbose. You can provide this option twice',
    global: true,
    type: 'count',
  })
  .help()
  .version()
  .wrap(null)

try {
  await parser.parse()
} catch (err) {
  console.error(err instanceof Error ? `${err.message}${err.stack}` : `${err}`)
  console.info(await parser.getHelp())
  process.exit(2)
}

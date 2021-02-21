import { stripIndent } from 'common-tags'
import * as path from 'path'
import json2csv from 'json2csv'
import * as prettyjson from 'prettyjson'
import { JiraDBFactory } from '../db/LocalJiraDB'
import Query from '../db/Query'
import Logger from '../logger'

const logger = new Logger()
const command = 'query <file>'
const describe = 'Query local database using query(ies) stored in file'
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const builder = (yargs: any): any => {
  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE || process.cwd()
  return yargs
    .usage(
      stripIndent`
      usage: $0 query <file> [options]

      Queries locally populated database using query(ies) located in <file>.

      Query file is a Node.js module exporting "query()" function and optionally a "transform()" function.

        module.exports = {
          query: (collection: HistoryCollection<any>, logger: Logger, args?: object) => Promise<any> | any
            // collection contains collection to be queried
            // logger can be used to provide additional user facing output
            // args contains command line arguments that can be used to parametrize query externally
            // query function is supposed to return an object or a promise
          },
          transform:(result: QueryResult) => any 
            // result.result contains result of the query
            // result.collection contains result of query function
            // result.logger can be used to provide additional user facing output
            // result?.args contains command line arguments that were to parametrize query externally 
               or can be used to parametrize transformation
            // result?.jiraClient contains a client to query jira instance, if desired
          }
        }


      Since "transform(result: QueryResult)" function is optional by default $0 expect "query()" to return a JSON data and uses pretty print
      to output it to console. If this is not desired behavior, user can provide --json, --csv or --tsv argument.
      In case that "transform(result: QueryResult)" is provided and none of --json, --csv or --tsv flags are provided, it is responsible for handling output itself.
    `
    )
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
    .help('help')
    .wrap(null)
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const handler = (argv: any): any => {
  if ([argv.csv, argv.tsv, argv.json].filter((val) => val).length > 1) {
    process.exit(1)
  }
  // this function is the only function that will be executed in the CLI scope, so we are ignoring that yargs is not able to handle async/await
  async function wrap(): Promise<void> {
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

    try {
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
          console.log(JSON.stringify(result.result, null, 2))
        } else if (argv.csv) {
          console.log(
            json2csv({
              data: result.result,
              hasCSVColumnTitle: false,
            })
          )
        } else if (argv.tsv) {
          console.log(
            json2csv({
              data: result.result,
              hasCSVColumnTitle: false,
              del: '\t',
            })
          )
        } else {
          console.log(prettyjson.render(result.result))
        }
      }
    } catch (err) {
      logger.error(`Unable to execute query() or transform function in ${queryFilePath}`)
      logger.error(err)
      process.exit(1)
    }
  }
  // we can ignore await here - this is the only call in the process
  wrap()
}

export { command, describe, builder, handler }

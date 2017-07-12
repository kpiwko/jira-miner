'use strict'

const path = require('path')
const util = require('util')
const stripIndent = require('common-tags').stripIndent
const prettyjson = require('prettyjson')
const json2csv = require('json2csv')
const logger = require('../lib/logger')
const query = require('../lib/query/query')
const DB = require('../lib/db/client')
const config = require('../lib/config')
const jiraClient = require('../lib/jira/client')

const command = 'query <file>'
const describe = 'Query local database using query(ies) stored in file'
const builder = function (yargs) {

  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  return yargs
    .usage(stripIndent`
      usage: $0 query <file> [options]

      Queries locally populated database using query(ies) located in <file>.

      Query file is a Node.js module exporting "query(ctx)" object/array/function and optionally a "transform(ctx)" function.

        module.exports = {
          query: (ctx) => {
            // ctx.args contains command line arguments that can be used to parametrize query externally
            // ctx.acc contains result of the last subquery
            // ctx.collection contains collection to be queried
          },
          transform: (ctx) => {
            // ctx.args contains command line arguments that can be used to parametrized transformation externally
            // ctx.data contains result of query function
            // ctx.jira that contains the connection to currently targetted jira. If jira is for some reason unavailable,
            the transform will be run without this field.
          }
        }

      Note that query can be a array of functions or Loki.js query objects. In such subqueries are executed in sequence
      and users are encouraged to use "ctx.acc" object to chain execution.

      Since "transform(ctx)" function is optional by default $0 expect "query(ctx)" to return a JSON data and uses pretty print
      to output it to console. If this is not desired behavior, user can provide --json or --csv argument.
      In case that "transform(ctx)" is provide, it is responsible for handling output itself.
    `)
    .option('db', {
      alias: 'd',
      describe: 'Database location',
      default: path.resolve(HOME, '.jira-minerdb'),
      defaultDescription: '.jira-minerdb in HOME directory'
    })
    .option('json', {
      describe: 'Print out query outcome in JSON format',
      default: false
    })
    .option('csv', {
      describe: 'Print out query outcome in CSV format',
      default: false
    })
    .option('tsv', {
      describe: 'Print out query outcome in Tab Separated Value format',
      default: false
    })
    .demand(1)
    .help('help')
    .wrap(null)
}

const handler = function(argv) {

  const queryFilePath = path.resolve(process.cwd(), argv.file)

  // get query from file
  let queryFile
  try {
    queryFile = require(queryFilePath)
  }
  catch(e) {
    console.error(`Unable to load ${queryFilePath}\n`)
    console.error(e)
    process.exit(1)  
  }

  if(!queryFile.query) {
    logger.error(`Query file ${queryFilePath} does not contain query`)
    process.exit(1)
  }

  if([argv.csv, argv.tsv, argv.json].filter(val => val).length > 1) {
    logger.error(`Please provide just one of --csv, --tsv or --json flags`)
    process.exit(1)
  }

  DB(argv.db)
    .then(db => {

      const collection = db.getCollection('default')

      if(collection === null) {
        throw Error(`No collection 'default' is available in ${argv.db}`)
      }

      // run the query
      return query(collection, queryFile.query, argv)
    })
    .then(data => {

      if(queryFile.transform && queryFile.transform instanceof Function) {
        let jira = null;
        config.readConfiguration().then(c => {
          jira = jiraClient(c.jira.url, c.jira.user, c.jira.password)
        }).catch(err => {
          logger.error(`Can't read the  to JIRA because ${err}, will run query without jira access`)
        }).then(()=> queryFile.transform({args: argv, data, jira}))
        .catch(err => {
          logger.error(err);
        });
      }
      else {
        if(argv.json) {
          console.log(JSON.stringify(data, null, 2))
        }
        else if(argv.csv) {
          console.log(json2csv({
            data,
            hasCSVColumnTitle: false
          }))
        }
        else if(argv.tsv) {
          console.log(json2csv({
            data,
            hasCSVColumnTitle: false,
            del: '\t'
          }))
        }
        else {
          console.log(prettyjson.render(data))
        }
      }
    })
    .catch(err => {
      logger.error(err)
      process.exit(1)
    })
}

module.exports = {command, describe, builder, handler }

'use strict'

const path = require('path')
const util = require('util')
const prettyjson = require('prettyjson')
const logger = require('../lib/logger')
const query = require('../lib/query/query')
const DB = require('../lib/db/client')

const command = 'query <file>'
const describe = 'Query local database using query(ies) stored in file'
const builder = function (yargs) {

  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  return yargs
    .usage(`usage: $0 query <file> [options]

      Queries locally populated database using query(ies) located in <file>. The file with query also defines output of
      the query.

    `)
    .option('db', {
      alias: 'd',
      describe: 'Database location',
      default: path.resolve(HOME, '.jira-minerdb'),
      defaultDescription: '.jira-minerdb in HOME directory'
    })
    .option('collection', {
      alias: 'c',
      describe: 'Collection name',
      default: 'default',
      defaultDescription: 'default'
    })
    .option('json', {
      alias: 'j',
      describe: 'Provide output in JSON format so it can be further processed',
      default: false
    })
    .demand(1)
    .help('help')
    .wrap(null)
}

const handler = function(argv) {

  const queryFilePath = path.resolve(process.cwd(), argv.file)

  DB(argv.db)
    .then(db => {

      const collection = db.getCollection(argv.collection)
      // get query from file
      let theQuery = require(queryFilePath).query

      // run the query
      return query(collection, theQuery, argv)
    })
    .then(data => {
      if(argv.json) {
        console.log(JSON.stringify(data, null, 2))
      }
      else {
        console.log(prettyjson.render(data))
      }
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = {command, describe, builder, handler}

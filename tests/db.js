'use strict'

const test = require('blue-tape')
const tmp = require('tmp')
const jsonfile = require('jsonfile')
const path = require('path')
const DB = require('../lib/db/client')
const normalizer = require('../lib/jira/normalizer')
const history = require('../lib/jira/history')

test('Initialize empty db', t => {
  const dbpath = tmp.fileSync();
  return DB(dbpath.name)
    .then(testdb => {
      t.ok(testdb, 'Test database has been created')
    })
})

test('Query all agpush issues that contain Android in summary', t => {
  return fixture().then(collection => {
    const results = collection.chain().find({ 'Summary': {'$contains':'Android'}}).simplesort('key').data()
    t.ok(results, 'Some results have been returned')
    t.ok(results.length > 0, 'There are more results than 0')
  })
})

const fixture = function(malformation) {
  const dbPath = tmp.fileSync()
  return DB(dbPath.name)
    .then(testdb => {

      let jiraData = jsonfile.readFileSync(path.join(__dirname, './fixtures/agpush200.json'))

      if(malformation) {
        jiraData = malformation(jiraData)
      }

      const jiraFields = jsonfile.readFileSync(path.join(__dirname, './fixtures/jiraFields.json'))

      jiraData = normalizer.fieldNamesAndValues(jiraData, jiraFields)
      jiraData = history.attachHistories(jiraData, jiraFields)

      return Promise.resolve(testdb.populate('agpush200', jiraData))
    })
}

module.exports = fixture

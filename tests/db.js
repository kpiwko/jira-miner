'use strict'

const test = require('blue-tape')
const tmp = require('tmp')
const jsonfile = require('jsonfile')
const path = require('path')
const DB = require('../lib/db/client')

test('Initialize empty db', t => {
  const dbpath = tmp.fileSync();
  return DB(dbpath.name)
    .then(testdb => {
      t.ok(testdb, 'Test database has been created')
    })
})

test('Query all agpush issues that contain Android in summary', t => {
  return fixture().then(collection => {
    const results = collection.chain().find({ 'fields.summary': {'$contains':'Android'}}).simplesort('key').data()
    t.ok(results, 'Some results have been returned')
    t.ok(results.length > 0, 'There are more results than 0')
  })
})

const fixture = function() {
  const dbPath = tmp.fileSync()
  return DB(dbPath.name)
    .then(testdb => {
      return Promise.resolve(testdb.populate('agpush200', jsonfile.readFileSync(path.join(__dirname, './fixtures/agpush200.json'))))
    })
}

module.exports = fixture

'use strict'

const test = require('blue-tape')
const tmp = require('tmp')
const jsonfile = require('jsonfile')
const path = require('path')
const DB = require('../lib/db/client')



test('Initialize empty db', t => {
  const dbpath = tmp.fileSync();
  const testdb = new DB(dbpath.name)
  t.ok(testdb, 'Test database has been created')
  t.end()
})

test('Query all agpush issues that contain Android in summary', t => {
  const agpush200 = fixture()
  const results = agpush200.chain().find({ 'fields.summary': {'$contains':'Android'}}).simplesort('key').data()
  t.ok(results, 'Some results have been returned')
  t.ok(results.length > 0, 'There are more results than 0')
  t.end()
})

const fixture = function() {
  const dbPath = tmp.fileSync()
  const testdb = new DB(dbPath.name)
  return testdb.populate('agpush200', jsonfile.readFileSync(path.join(__dirname, './fixtures/agpush200.json')))
}

module.exports = {
  fixture
}

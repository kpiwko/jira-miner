'use strict'

const test = require('blue-tape')
const fixture = require('../db').fixture()
const query = require('../../lib/query/query')

test('Invalid subquery function', t => {
  return query(fixture, [
    {
      func: 'doesNotExist',
      args: { 'fields.summary' : {'$contains': 'Android'}}
    },
    {
      func: 'simplesort',
      args: 'key'
    }
  ]).then(issues => {
    t.fail(issues, 'Should fail, invalid function name was provided')
  }).catch(err => {
    t.equals(err.func, 'doesNotExist', 'Attempted to invoke non-existing function')
  })
})


test('Query of Android in summary sorted by key', t => {
  return query(fixture, [
    {
      func: 'find',
      args: { 'fields.summary' : {'$contains': 'Android'}}
    },
    {
      func: 'simplesort',
      args: 'key'
    }
  ]).then(issues => {
    t.ok(issues, 'Fetched')
  }).catch(err => {
    t.fail(err, 'Unable to query issues')
  })
})

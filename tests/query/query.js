'use strict'

const test = require('blue-tape')
const util = require('util')
const fixture = require('../db')
const query = require('../../lib/query/query')

test('Invalid subquery function', t => {
  return fixture().then(collection => {
    return query(collection, [
      {
        func: 'doesNotExist',
        args: { 'fields.summary' : {'$contains': 'Android'}}
      },
      {
        func: 'simplesort',
        args: 'key'
      }
    ])
  })
  .then(issues => {
    t.fail(issues, 'Should fail, invalid function name was provided')
  })
  .catch(err => {
    t.ok(/Not an invokable function/.test(err.message), 'Attempted to invoke non-existing function')
  })
})

test('Query of Android in summary sorted by key via array of functions', t => {
  return fixture().then(c => {
    const q = [
      (res) => {
        return res.collection.chain()
          .find({ 'fields.summary' : {'$contains': 'Android'}})
      },
      (res) => {
        return res.acc.simplesort('key')
          .data()
      }
    ]

    return query(c, q)
  })
  .then(issues => {
    t.equals(issues.length, 4, 'Four issues have been queried by Android in summary field')
  })
  .catch(err => {
    t.fail(err, 'Unable to query issues')
  })
})


test('Query of Android in summary sorted by key', t => {
  return fixture().then(collection => {
    return query(collection, [
      {
        func: 'find',
        args: { 'fields.summary' : {'$contains': 'Android'}}
      },
      {
        func: 'simplesort',
        args: 'key'
      }
    ])
  })
  .then(issues => {
    t.equals(issues.length, 4, 'Four issues have been queried by Android in summary field')
  })
  .catch(err => {
    t.fail(err, 'Unable to query issues')
  })
})


test('Query with map-reduce', t => {
  return fixture().then(collection => {
    return query(collection, [
      {
        func: 'find',
        args: { 'fields.summary' : {'$contains': 'Android'}}
      },
      {
        func: 'simplesort',
        args: 'key'
      },
      {
        func: 'mapReduce',
        args: [
          function(issue) {
            return issue.key
          },
          function(keys) {
            return keys.reduce((acc, key) => {
              return acc.concat(` ${key}`)
            }, '')
          }
        ]
      }
    ])
  })
  .then(keys => {
    t.ok(keys, 'Queried')
    console.error(keys)
  })
  .catch(err => {
    t.fail(err, 'Unable to query issues')
  })
})

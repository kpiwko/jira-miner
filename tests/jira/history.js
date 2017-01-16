'use strict'

const test = require('blue-tape')
const fixture = require('../db')
const query = require('../../lib/query/query')
const history = require('../../lib/jira/history')

test('Check history of issues', t => {
  return fixture().then(collection => {
    return query(collection, [
      {
        func: 'find',
        args: { 'Summary' : {'$contains': 'Android'}}
      },
      {
        func: 'simplesort',
        args: 'key'
      }
    ])
  })
  .then(issues => {
    t.ok(issues.length > 0, 'More than 1 issue has been fetched')
    issues.map(history.status).forEach(statusHistory => {
      t.ok(statusHistory[1].length > 0, `Issue contains history of its states`)
    })
  })
  .catch(err => {
    t.fail(err, 'Unable to query issues')
  })
})

test('Add history series', t => {
  return fixture().then(collection => {
    return query(collection, [
      {
        func: 'find',
        args: { 'Summary' : {'$contains': 'Android'}}
      }
    ])
  })
  .then(issues => {
    t.ok(issues.length > 0, 'More than 1 issue has been fetched')
    issues.map(history.addAllSeries).forEach(issue => {
      t.ok(issue.History['Status'].length > 0, `Issue ${issue.key} contains history of Status`)
      t.ok(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
    })
  })
})

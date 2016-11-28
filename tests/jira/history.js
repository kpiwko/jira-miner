'use strict'

const test = require('blue-tape')
const fixture = require('../db').fixture()
const query = require('../../lib/query/query')
const history = require('../../lib/jira/history')

test('Check history of issues', t => {
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
    // fixme
    issues.map(history.status).forEach(statusHistory => {
      t.ok(statusHistory[1].length > 0, `Issue contains history of its states`)
    })
  }).catch(err => {
    t.fail(err, 'Unable to query issues')
  })
})

test('Add history series', t => {
  return query(fixture, [
    {
      func: 'find',
      args: { 'fields.summary' : {'$contains': 'Android'}}
    }
  ]).then(issues => {
    issues.map(history.addAllSeries).forEach(issue => {
      t.ok(issue.history['status'].length > 0, `Issue ${issue.key} contains history of status`)
      t.ok(issue.history['Fix Version'].length > 0, `Issue ${issue.key} contains history of FixVersion`)
    })
  })
})

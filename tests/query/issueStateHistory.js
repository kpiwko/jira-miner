'use strict'

const test = require('blue-tape')
const fixture = require('../db').fixture()
const query = require('../../lib/query/query')
const issueStateHistory = require('../../lib/query/issueStateHistory')

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
    issues.map(issueStateHistory).forEach(issue => {
      t.ok(issue.states.length >= 0, `Issue ${issue.key} ${issue.fields.summary} contains history of its states`)
    })
  }).catch(err => {
    t.fail(err, 'Unable to query issues')
  })
})

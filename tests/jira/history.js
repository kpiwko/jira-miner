'use strict'

const test = require('blue-tape')
const jsonfile = require('jsonfile')
const path = require('path')
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
    issues.map(issue => {
      t.ok(issue.History !== null, `Issue contains history series`)
    })
  })
  .catch(err => {
    t.fail(err, 'Unable to query issues')
  })
})

test('Process history of issue with no author', t => {

  return fixture(issues => {
    // remove author
    issues.forEach(issue => {
        if(issue.changelog && issue.changelog.histories) {
          issue.changelog.histories.forEach(history => {
            delete history.author
          })
        }
    })
    return issues
  }).then(collection => {
    return query(collection, [
      {
        func: 'find',
        args: { 'Summary' : {'$contains': 'Android'}}
      }
    ])
  })
  .then(issues => {
    t.ok(issues.length > 0, 'More than 1 issue has been fetched')
    issues.forEach(issue => {
      t.ok(issue.History['Status'].length > 0, `Issue ${issue.key} contains history of Status`)
    })
  })
})

test('Process history of issue with comments', t => {
  return fixture(null, './fixtures/issue-with-comments.json').then(collection => {
    return query(collection, ctx => {
      return ctx.collection.history('2016-11-29')
    })
  })
  .then(issues => {
    t.ok(issues.length === 1, 'Just 1 issue has been fetched')
    issues.forEach(issue => {
      t.ok(issue.Comment.length === 6, `Issue ${issue.key} has exactly 6 comments`)
      t.ok(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
    })
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
    issues.forEach(issue => {
      t.ok(issue.History['Status'].length > 0, `Issue ${issue.key} contains history of Status`)
      t.ok(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
    })
  })
})

'use strict'

const test = require('blue-tape')
const jiraClient = require('../lib/jira/client')
const jiraFetch = require('../lib/jira/fetch')

const jira = jiraClient('https://issues.jboss.org', '', '')

test('Fetch public AGPUSH project', t => {
  return jiraFetch(jira, 'project = AGPUSH', {fields: ['Summary']})
    .then(issues => {
      t.ok(issues, 'AGPUSH issues have been fetched')
    })
    .catch(err => {
      t.fail(err, 'Failed fetching issues')
    })
})

test('Fetch single issue', t => {
  return jiraFetch(jira, 'key = AGPUSH-1', {fields: ['Summary'], maxResults: 1})
    .then(issues => {
      t.ok(issues, 'AGPUSH-1 issue has been fetched')
      t.equal(issues.length, 1, 'There is just one jira fetched')
    })
    .catch(err => {
      t.fail(err, 'Failed fetching issues')
    })
})

test('Fetch issues via multiple calls and limit number of issues', t => {
  return jiraFetch(jira, 'project = AGPUSH', {fields: ['Summary'], maxResults: 1200})
    .then(issues => {
      t.ok(issues, 'AGPUSH issues has been fetched')
      t.equal(issues.length, 1200, 'There has been 1200 issues fetched')
    })
    .catch(err => {
      t.fail(err, 'Failed fetching issues')
    })
})

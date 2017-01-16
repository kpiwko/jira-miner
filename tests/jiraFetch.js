'use strict'

const test = require('blue-tape')
const jsonfile = require('jsonfile')
const jiraClient = require('../lib/jira/client')
const jiraFetch = require('../lib/jira/fetch')

const jira = jiraClient('https://issues.jboss.org', '', '')

test('Fetch public AGPUSH project', t => {
  return jiraFetch(jira, 'project = AGPUSH', {fields: ['summary']})
    .then(issues => {
      t.ok(issues.length > 0, 'AGPUSH issues have been fetched')
    })
    .catch(err => {
      t.fail(err, 'Failed fetching issues')
    })
})

test('Fetch single issue', t => {
  return jiraFetch(jira, 'key = AGPUSH-1', {fields: ['summary'], maxResults: 1})
    .then(issues => {
      t.ok(issues, 'AGPUSH-1 issue has been fetched')
      t.equal(issues.length, 1, 'There is just one jira fetched')
    })
    .catch(err => {
      t.fail(err, 'Failed fetching issues')
    })
})

test('Fetch issues via multiple calls and limit number of issues', t => {
  return jiraFetch(jira, 'project = AGPUSH', {fields: ['summary'], maxResults: 1200})
    .then(issues => {
      t.ok(issues, 'AGPUSH issues has been fetched')
      t.equal(issues.length, 1200, 'There has been 1200 issues fetched')
    })
    .catch(err => {
      t.fail(err, 'Failed fetching issues')
    })
})

test('Fetch issue with no field', t => {
  return jiraFetch(jira, 'key = AGPUSH-1', {fields: []})
    .then(issues => {
      t.ok(issues, 'AGPUSH-1 issue has been fetched')
      t.equal(issues.length, 1, 'There is just one jira fetched')
      t.notOk(issues[0].fields, 'Issue has no fields fetched')
    })
    .catch(err => {
      t.fail(err, 'Failed fetching issues')
    })
})

test('Fetch issue with changelog', t => {
  return jiraFetch(jira, 'key = AGPUSH-1', {fields: [], expand: ['changelog']})
    .then(issues => {
      t.ok(issues, 'AGPUSH-1 issue has been fetched')
      t.equal(issues.length, 1, 'There is just one jira fetched')
      t.notOk(issues[0].fields, 'Issue has no fields fetched')
    })
    .catch(err => {
      t.fail(err, 'Failed fetching issues')
    })
})

test.skip('Prepopulate agpush200 fixture', t => {
  return jiraFetch(jira, 'project = AGPUSH AND key <= AGPUSH-200',
    {fields: ['*all'], expand: ['changelog'], maxResults: 200})
    .then(issues => {
      jsonfile.writeFileSync('./tests/fixtures/agpush200.json', issues, {spaces: 2})
      t.pass()
    })
    .catch(err => {
      t.fail(err, 'Unable to store sample AGPUSH data')
    })
})

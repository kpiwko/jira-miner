'use strict'

const test = require('blue-tape')
const jiraClient = require('../lib/jira/client')

test('Log to JIRA without user', (t) => {
  const jira = jiraClient('https://issues.jboss.org')
  return jira.getCurrentUser()
    .then((user) => {
      t.fail(user, 'User is not authorized but accesses restricted API')
    })
    .catch((err) => {
      t.ok(err, 'Received HTTP 401 from this call')
    })
})


test('Log to JIRA with invalid user', (t) => {
  const jira = jiraClient('https://issues.jboss.org', 'user', 'dummy')
  return jira.getCurrentUser()
    .then((user) => {
      t.notOk(user, 'User should be empty')
    })
    .catch((err) => {
      t.fail(err, 'Unable to exercise JIRA API')
    })
})

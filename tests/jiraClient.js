'use strict'

const test = require('blue-tape')
const jiraClient = require('../lib/jira/client')

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

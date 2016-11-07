'use strict'

const test = require('blue-tape')
const jiraTarget = require('../lib/jira/target')

test('Connect to jira using wrong credentials', (t) => {
  return t.shouldFail(jiraTarget.checkCredentials('https://issues.jboss.org', 'dummy', 'user'))
})

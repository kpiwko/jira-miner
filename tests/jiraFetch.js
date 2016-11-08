'use strict'

const test = require('blue-tape')
const jiraClient = require('../lib/jira/client')
const jiraFetch = require('../lib/jira/fetch')

test('Fetch public AGPUSH project', (t) => {

  const jira = jiraClient('https://issues.jboss.org', '', '')

  return jiraFetch(jira, 'project = AGPUSH', {fields: ['Summary']})
    .then(issues => {
      t.ok(issues, `JIRA issues have been fetched`)
    })
    .catch(err => {
      t.fail(err, 'Failed fetching issues')
    })
})

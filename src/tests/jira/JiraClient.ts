import test from 'ava'
import sinon from 'sinon'
import { JiraClient } from '../../jira/JiraClient'
import rp from 'request-promise'

test('Log to JIRA without token', async (t) => {
  const jira = new JiraClient({ url: 'https://issues.redhat.com' })
  await t.throwsAsync(jira.checkCredentials(), { message: /Unable to authorize with the token/ })
})

test('Exercise JIRA check token handling logic', async (t) => {
  const request = sinon.stub()
  request.onCall(0).resolves({
    statusCode: 401,
    body: {
      message: 'Client must be authenticated to access this resource.',
    },
  })
  request.onCall(1).resolves({
    statusCode: 200,
    headers: {
      'x-seraph-loginreason': 'OK',
      'x-ausername': 'dummy',
    },
  })
  request.onCall(2).resolves({
    statusCode: 429,
    body: {},
    headers: {},
  })
  request.onCall(3).resolves({
    statusCode: 500,
  })

  const mockedJira = new JiraClient(
    {
      url: 'https://issues.redhat.org',
      token: 'invalid',
    },
    {
      // introduce mocked request
      request: <any>(<unknown>request),
    }
  )

  t.plan(5)
  await t.throwsAsync(mockedJira.checkCredentials(), {
    message: /Unable to authorize with the token/,
  })

  const credentials = await mockedJira.checkCredentials()
  t.truthy(credentials, 'Returned mocked configuration of jira instance')
  t.is(credentials.token, 'invalid', 'Logged in as dummy user')

  await t.throwsAsync(mockedJira.checkCredentials(), {
    message: /API rate limit/,
  })
  await t.throwsAsync(mockedJira.checkCredentials(), {
    message: /unhandled control flow/,
  })
})

const jira = new JiraClient({ url: 'https://issues.apache.org/jira/' }, { verbose: false })

test('Fetch issues with summary field', async (t) => {
  const issues = await jira.fetch({ query: 'project = AMQ AND key < AMQ-2', fields: ['summary'] })
  t.assert(issues.length > 0, 'AMQ issues have been fetched')
  t.truthy(issues[0]['Summary'], 'Summary is available on the first issue')
})

test('Fetch single issue', async (t) => {
  const issues = await jira.fetch({
    query: 'key = AMQ-71',
    fields: ['summary'],
  })
  t.assert(issues, 'AMQ-71 issue has been fetched')
  t.is(issues.length, 1, 'There is just one jira fetched')
})

test('Fetch issues via single call within limit', async (t) => {
  const issues = await jira.fetch({ query: 'project = AMQ AND key <= AMQ-50', fields: ['summary'], maxResults: 100 })
  t.truthy(issues, 'Some AMQ issues has been fetched')
  t.assert(issues.length <= 100, 'Less than 100 issues have been fetched')
})

test('Fetch issues via multiple calls and limit number of issues', async (t) => {
  const issues = await jira.fetch({ query: 'project = AMQ and key <= AMQ-200', fields: ['summary'], maxResults: 100 })
  t.truthy(issues, 'Some AMQ issues has been fetched')
  t.assert(issues.length >= 100, 'More than 100 issues have been fetched')
})

test('Fetch issue without changelog', async (t) => {
  const issues = await jira.fetch({ query: 'key = AMQ-71', expand: [] })
  t.truthy(issues, 'AMQ-71 issue has been fetched')
  t.is(issues.length, 1, 'There is just one jira fetched')
  t.deepEqual(issues[0].History, {}, 'Issue history is empty')
})

test('Fetch issue with changelog', async (t) => {
  const issues = await jira.fetch({ query: 'key = AMQ-71', expand: ['changelog'] })
  t.truthy(issues, 'AMQ-71 issue has been fetched')
  t.is(issues.length, 1, 'There is just one jira fetched')
  t.truthy(issues[0].History, 'Changelog is attached and transformed to History field')
})

test('Check additional JiraClient options', async (t) => {
  const debugJira = new JiraClient(
    { url: 'https://issues.apache.org:445/jira/' },
    {
      verbose: true,
    }
  )
  await t.throwsAsync(debugJira.fetch({ query: 'project = AMQ AND key < AMQ-2', fields: ['summary'] }), {
    message: /connect ECONNREFUSED/,
  })
  // remove debugging for request
  ;(<any>rp)['debug' as any] = false
})

import test from 'ava'
import sinon from 'sinon'
import { JiraClient } from '../../jira/JiraClient'

test('Log to JIRA without user', async (t) => {
  const jira = new JiraClient({ url: 'https://issues.redhat.com' })
  await t.throwsAsync(jira.checkCredentials(), { message: /Either wrong user/ })
})

test('Exercise JIRA check credentials logic', async (t) => {
  const request = sinon.stub()
  request.onCall(0).resolves({
    statusCode: 401,
    body: {},
  })
  request.onCall(1).resolves({
    statusCode: 200,
    body: {
      session: {
        name: 'JSESSIONID',
        value: '12345',
      },
      loginInfo: {
        failedLoginCount: 300,
        loginCount: 600,
        lastFailedLoginTime: '2019-05-15T08:05:56.488-0400',
        previousLoginTime: '2019-05-14T03:14:44.896-0400',
      },
    },
  })
  request.onCall(2).resolves({
    statusCode: 403,
    body: {
      errorMessages: ['Login denied'],
      errors: {},
    },
    headers: {
      'x-authentication-denied-reason': 'CAPTCHA_CHALLENGE mocked URL',
    },
  })
  request.onCall(3).resolves({
    statusCode: 403,
    body: {},
    headers: {},
  })
  request.onCall(4).resolves({
    statusCode: 500,
  })

  const mockedJira = new JiraClient(
    {
      url: 'https://issues.redhat.org',
      user: 'dummy',
      password: 'user',
    },
    {
      // introduce mocked request
      request: <any>(<unknown>request),
    }
  )

  t.plan(6)
  await t.throwsAsync(mockedJira.checkCredentials(), {
    message: /Either wrong user dummy or wrong password provided/,
  })

  const credentials = await mockedJira.checkCredentials()
  t.truthy(credentials, 'Returned mocked configuration of jira instance')
  t.is(credentials.user, 'dummy', 'Logged in as dummy user')

  await t.throwsAsync(mockedJira.checkCredentials(), {
    message: /Captcha challenge please login via browser/,
  })
  await t.throwsAsync(mockedJira.checkCredentials(), {
    message: /Failed to login to JIRA instance/,
  })
  await t.throwsAsync(mockedJira.checkCredentials(), {
    message: /unhandled control flow/,
  })
})

const jira = new JiraClient({ url: 'https://issues.apache.org/jira/' })

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

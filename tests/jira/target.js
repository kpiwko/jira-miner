'use strict'

const test = require('blue-tape')
const proxyquire = require('proxyquire').noPreserveCache();
const sinon = require('sinon')
const tmp = require('tmp')

test('Connect to jira using wrong credentials', t => {

  const jiraTarget = require('../../lib/jira/target')

  return t.shouldFail(jiraTarget.checkCredentials('https://issues.jboss.org', 'dummy', 'user'),
    null, 'Unable to target JIRA with dummy user')
})

test('Fail to join to JIRA', t => {
  const request = sinon.stub()
  request.onFirstCall().yields({err: 'Error'}, null, null)
    .onSecondCall().yields(
        null,
        {statusCode: 200},
        JSON.stringify({
          self : 'https://issues.jboss.org/rest/api/2/user?username=dummy',
          key: 'dummy',
          name: 'dummy',
          emailAddress: 'dummyuser@example.com',
          avatarUrls: {},
          displayName : 'Dummy User',
          active: true,
          timeZone: 'Europe/Prague',
          locale: 'en_US',
          groups: { size:1,items:[]},
          applicationRoles: {size:1, items :[]},
          expand: 'groups,applicationRoles'
        })
      )
    .onThirdCall().yields(
      null,
      {statusCode: 200},
      'Non JSON body'
    )

  const jiraTarget = proxyquire('../../lib/jira/target', {
    'request': request
  })

  t.plan(4)
  jiraTarget.checkCredentials('https://issues.jboss.org', 'dummy', 'user')
    .catch(err => {
      t.ok(err, 'Unable to process failing request')
    })

  jiraTarget.checkCredentials('https://issues.jboss.org', 'dummy', 'user')
    .then(config => {
      t.ok(config, 'Returned configuration of jira instance')
      t.equals(config.jira.user, 'dummy', 'Logged in as dummy user')
    })
    .catch(err => {
      console.log(err)
      t.fail(err, 'Should not get here')
    })

  jiraTarget.checkCredentials('https://issues.jboss.org', 'dummy', 'user')
    .catch(err => {
      t.ok(err, 'Unable to process failing request')
    })
})

'use strict'

const test = require('blue-tape')
const proxyquire = require('proxyquire').noPreserveCache();
const path = require('path')
const sinon = require('sinon')
const tmp = require('tmp')

test('Connect to jira using wrong credentials', t => {

  const jiraTarget = require('../lib/jira/target')

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

  const jiraTarget = proxyquire('../lib/jira/target', {
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
      t.equals(config.user, 'dummy', 'Logged in as dummy user')
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

test('Store JIRA configuration in home directory', t => {

  const resolve = sinon.stub()
  resolve.onFirstCall().returns(path.resolve(tmp.dirSync().name, '.jira-miner'))
    .onSecondCall().returns('unused')

  const jiraTarget = proxyquire('../lib/jira/target', {
    'path': {
      resolve: resolve
    }
  })

  return writeConfiguration(jiraTarget)
    .then(configPath => {
      t.equals(configPath, jiraTarget.configurationPaths[0], 'Stored in home directory')
    })
})

test('Store JIRA configuration in current directory', t => {

  const resolve = sinon.stub()
  // the first path is in directory that does not exist
  resolve.onFirstCall().returns(path.resolve(tmp.tmpNameSync(), '.jira-miner'))
    .onSecondCall().returns(path.resolve(tmp.dirSync().name, '.jira-miner'))

  const jiraTarget = proxyquire('../lib/jira/target', {
    'path': {
      resolve: resolve
    }
  })

  return writeConfiguration(jiraTarget)
    .then(configPath => {
      t.equals(configPath, jiraTarget.configurationPaths[1], 'Stored in current directory')
    })
})

test('Fail to store configuration', t => {
  const resolve = sinon.stub()
  // both paths are in a directory that does not exist
  resolve.onFirstCall().returns(path.resolve(tmp.tmpNameSync(), '.jira-miner'))
    .onSecondCall().returns(path.resolve(tmp.tmpNameSync(), '.jira-miner'))

  const jiraTarget = proxyquire('../lib/jira/target', {
    'path': {
      resolve: resolve
    }
  })

  return writeConfiguration(jiraTarget)
    .catch(err => {
      t.ok(err, 'Failed to store configuration')
    })
})

const writeConfiguration = function(jiraTarget) {
  return jiraTarget.writeConfiguration({
    user: 'dummy',
    password: 'user',
    url: 'https://example.com'
  })
}

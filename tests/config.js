'use strict'

const test = require('blue-tape')
const proxyquire = require('proxyquire').noPreserveCache();
const path = require('path')
const sinon = require('sinon')
const tmp = require('tmp')

test('Store configuration in home directory', t => {

  const resolve = sinon.stub()
  resolve.onFirstCall().returns(path.resolve(tmp.dirSync().name, '.jira-miner'))
    .onSecondCall().returns('unused')

  const config = proxyquire('../lib/config', {
    'path': {
      resolve: resolve
    }
  })

  return writeConfiguration(config)
    .then(configPath => {
      t.equals(configPath, config.configurationPaths[0], 'Stored in home directory')

      return config.readConfiguration()
        .then(conf => {
          t.same(conf, dummyConfiguration, 'Configuration loaded from disk is the same as stored one')
        })
    })
})

test('Store JIRA configuration in current directory', t => {

  const resolve = sinon.stub()
  // the first path is in directory that does not exist
  resolve.onFirstCall().returns(path.resolve(tmp.tmpNameSync(), '.jira-miner'))
    .onSecondCall().returns(path.resolve(tmp.dirSync().name, '.jira-miner'))

  const config = proxyquire('../lib/config', {
    'path': {
      resolve: resolve
    }
  })

  return writeConfiguration(config)
    .then(configPath => {
      t.equals(configPath, config.configurationPaths[1], 'Stored in current directory')
      return config.readConfiguration()
        .then(conf => {
          t.same(conf, dummyConfiguration, 'Configuration loaded from disk is the same as stored one' + `${configPath}`)
        })
    })
})

test('Fail to store configuration', t => {
  const resolve = sinon.stub()
  // both paths are in a directory that does not exist
  resolve.onFirstCall().returns(path.resolve(tmp.tmpNameSync(), '.jira-miner'))
    .onSecondCall().returns(path.resolve(tmp.tmpNameSync(), '.jira-miner'))

  const config = proxyquire('../lib/config', {
    'path': {
      resolve: resolve
    }
  })

  return writeConfiguration(config)
    .then(configPath => {
      t.fail(err)
    })
    .catch(err => {
      t.ok(err, 'Failed to store configuration')

      return config.readConfiguration()
        .catch(err => {
          t.ok(err, 'Failed to read non-stored configuration')
        })
    })
})

test('Update configuration', t => {

  const resolve = sinon.stub()
  resolve.onFirstCall().returns(path.resolve(tmp.dirSync().name, '.jira-miner'))
    .onSecondCall().returns('unused')

  const config = proxyquire('../lib/config', {
    'path': {
      resolve: resolve
    }
  })

  t.plan(3)
  config.updateConfiguration({foo:'bar'})
    .then(configPath => {
      t.ok(configPath, 'Updated non-existing configuration')
      return config.updateConfiguration({foo: 'barbar'})
    })
    .then(() => config.readConfiguration())
    .then(c => {
      t.equals(c.foo, 'barbar', 'Configuration has been updated')
      return config.updateConfiguration({foo: 'baz'}, {foo: 'bar'})
    })
    .then(() => config.readConfiguration())
    .then(c => {
      t.equals(c.foo, 'bar', 'Configuration has been double updated to bar')
    })
})

const dummyConfiguration = {
  user: 'dummy',
  password: 'user',
  url: 'https://example.com'
}

const writeConfiguration = function(config) {
  return config.writeConfiguration(dummyConfiguration)
}

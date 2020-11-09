'use strict'

import test from 'ava'
import * as path from 'path'
import * as tmp from 'tmp'
import _ from 'lodash'
import Configuration from '../Configuration'

class MockedConfiguration extends Configuration {
  constructor(configurationPaths: [string, string]) {
    super()
    this.configurationPaths = configurationPaths
  }
}

test('Store configuration in home directory', async t => {

  const config = new MockedConfiguration([path.resolve(tmp.dirSync().name, '.jira-miner'), 'unused'])
  try {
    const configPath = await config.writeConfiguration(dummyConfiguration)
    t.is(configPath, config.configurationPaths[0], 'Stored in home directory')
    const configuration = await config.readConfiguration()
    t.deepEqual(configuration, dummyConfiguration, 'Configuration loaded from disk is the same as stored one')
  }
  catch (err) {
    console.error(err)
    t.fail('Failed to write and read configuration from home directory')
  }
})


test('Store JIRA configuration in current directory', async t => {

  const config = new MockedConfiguration([path.resolve(tmp.tmpNameSync(), '.jira-miner'), path.resolve(tmp.dirSync().name, '.jira-miner')])

  try {
    const configPath = await config.writeConfiguration(dummyConfiguration)
    t.is(configPath, config.configurationPaths[1], 'Stored in current directory')
    const configuration = await config.readConfiguration()
    t.deepEqual(configuration, dummyConfiguration, `Configuration loaded from disk is the same as stored one ${configPath}`)
  }
  catch (err) {
    console.error(err)
    t.fail('Failed to write and read configuration from current directory')
  }
})


test('Fail to store configuration', async t => {
  const config = new MockedConfiguration([path.resolve(tmp.tmpNameSync(), '.jira-miner'), path.resolve(tmp.tmpNameSync(), '.jira-miner')])

  try {
    await config.writeConfiguration(dummyConfiguration)
    t.fail('Should have failed to store configuration')
  }
  catch (err) {
    t.pass('Failed to store configuration')
  }

  try {
    await config.readConfiguration()
    t.fail('Should have failed to read configuration')
  }
  catch (err) {
    t.pass('Failed to read non-stored configuration')
  }
})

test('Update configuration', async t => {
  const config = new MockedConfiguration([path.resolve(tmp.dirSync().name, '.jira-miner'), 'unused'])

  t.plan(3)
  try {
    const configPath = await config.updateConfiguration([{
      target: 'dummy',
      jira: {
        url: 'https://bar'
      }
    }])
    t.truthy(configPath, 'Updated non-existing configuration')
    let configuration = await config.readConfiguration()
    t.is(_.find(configuration, (c) => c.target === 'dummy')?.jira.url, 'https://bar', 'Configuration has been updated')
    await config.updateConfiguration([{
      target: 'dummy',
      jira: {
        url: 'https://foo'
      }
    }])
    configuration = await config.readConfiguration()
    t.is(_.find(configuration, (c) => c.target === 'dummy')?.jira.url, 'https://foo', 'Configuration has been updated for the second time')
  }
  catch (err) {
    console.error(err)
    t.fail('Failed to update configuration')
  }

})

const dummyConfiguration = [ {
  target: 'dummy',
  jira: {
    user: 'dummy',
    password: 'user',
    url: 'https://example.com'
  }
}]

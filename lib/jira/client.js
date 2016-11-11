'use strict'

const JiraApi = require('jira-client')
const urlParser = require('url')
const configurationPaths = require('./target').configurationPaths
const logger = require('../logger')


const login = function(url, user='', password='', apiVersion=2) {
  // load configuration from file
  if(url===undefined && user===undefined && password===undefined) {

  }

  // parse config
  const config = urlParser.parse(url)
  const protocol = config.protocol.replace(/:\s*$/, '')
  const port = config.port ? config.port : (config.protocol.startsWith('https') ? 443 : 80)

  return new JiraApi({
    protocol: protocol,
    host: config.hostname,
    port: port,
    username: user,
    password: password,
    apiVersion: apiVersion,
    strictSSL: true
  })
}

module.exports = login

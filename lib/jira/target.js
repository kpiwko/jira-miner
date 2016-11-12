'use strict'

const fs = require('fs')
const path = require('path')
const request = require('request')
const logger = require('../logger')

/**
 * Checks credentials with given JIRA instance
 * Returns a promise with JIRA url, user name and password
 */
const checkCredentials = function(url, user='', password='') {
  return new Promise((resolve, reject) => {
    request({
      url: `${url}/jira/rest/api/2/user?username=${user}`,
      headers: {
        'Authorization': (() => 'Basic ' + new Buffer(`${user}:${password}`).toString('base64'))()
      }
    }, (err, response, body) => {
      if(err) {
        logger.trace({err, response, body}, 'Unable to connect to JIRA')
        return reject(err)
      }
      if(response.statusCode === 200 && !!body) {
        try {
          body = JSON.parse(body)
        }
        catch(e) {
          return reject({url: url, user: user, body: body, err: e, msg: 'Unable to parse response body'})
        }
        // matched user in response
        if(body.name === user) {
          return resolve({url, user, password})
        }
      }
      return reject({url: url, user: user, err: 'Either wrong user or wrong password provided'})
    })
  })
}

const writeConfiguration = function(config) {

  return new Promise((resolve, reject) => {

    // write down configuration to a file
    let configFile = configurationPaths[0]
    fs.writeFile(configFile, JSON.stringify(config), (err) => {
      if(err) {
        logger.warn({configFile, err}, 'Unable to write down configuration to HOME directory')
        // use local directory instead as fallback option
        configFile = configurationPaths[1]
        fs.writeFile(configFile, JSON.stringify(config), (err) => {
          if(err) {
            logger.error({configFile, err}, 'Unable to write down configuration to current working directory neither')
            return reject({configFile, err})
          }
          return resolve(configFile)
        })
      }
      return resolve(configFile)
    })
  })
}

const configurationPaths = (() => {
  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  return [ path.resolve(HOME, '.jira-miner'), path.resolve(process.cwd(), '.jira-miner')]
})()

module.exports = {
  checkCredentials,
  writeConfiguration,
  configurationPaths
}

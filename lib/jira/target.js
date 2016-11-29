'use strict'

const fs = require('fs')
const path = require('path')
const request = require('request')
const config = require('../config')
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
          return resolve({jira: {url, user, password}})
        }
      }
      return reject({url: url, user: user, err: 'Either wrong user or wrong password provided'})
    })
  })
}

module.exports = {
  checkCredentials,
}

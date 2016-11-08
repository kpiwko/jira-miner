'use strict'

const bunyan = require('bunyan')
const logger = (() => {

  let options = {
    name: 'jira-miner'
  }
  if(process.env.DEBUG) {
    options.streams = [{
      stream: process.stdout,
      level: 'trace'
    }]
  }

  return bunyan.createLogger(options)
})()

module.exports = logger

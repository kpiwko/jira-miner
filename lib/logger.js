'use strict'

const bunyan = require('bunyan')

const logger = bunyan.createLogger({name: 'jira-miner'})

module.exports = logger

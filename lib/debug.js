'use strict'

const winston = require('winston')

const enableDebug = function() {
  winston.configure({
    transports: [
      new (winston.transports.Console)({ level: 'debug' })
    ]
  })
}

module.exports = enableDebug

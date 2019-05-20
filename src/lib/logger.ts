'use strict'

import { Logger, transports } from 'winston'

const logger = new Logger({
  transports: [
    new transports.Console({ level: process.env.DEBUG ? 'debug' : 'info' })
  ]
})

export default logger
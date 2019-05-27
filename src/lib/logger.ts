'use strict'

import * as winston from 'winston'

export class Logger extends winston.Logger {

  constructor() {
    super({
      transports: [
        new winston.transports.Console({ level: process.env.DEBUG ? 'debug' : 'info' })
      ]
    })
  }

  setDebug() {
    Object.keys(this.transports).forEach(key => {
      this.transports[key].level = 'debug'
    })
  }

}

export default new Logger()
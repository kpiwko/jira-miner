'use strict'

import * as winston from 'winston'

const enableDebug = function (): void {
  winston.configure({
    transports: [
      new (winston.transports.Console)({ level: 'debug' })
    ]
  })
}

export default enableDebug
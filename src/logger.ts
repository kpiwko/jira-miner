'use strict'

import winston, { format } from 'winston'

export default class Logger {

  private static instance: Logger
  private logger!: winston.Logger

  constructor() {
    if(Logger.instance) {
      return Logger.instance
    }
    else {
      const level = process.env.DEBUG && process.env.DEBUG.includes('jira-miner') ? 'debug' : 'info'
      this.logger = winston.createLogger({
        transports: [
          new winston.transports.Console({ level}),
        ],
        format: format.combine(format.timestamp(), format.label({label: 'jira-miner', message: true}), format.json())
      })
      Logger.instance = this  
    }
  }

  setDebug() {
    Object.keys(this.logger.transports).forEach((key: any) => {
      this.logger.transports[key].level = 'debug'
    })
  }

  error(message: string, ...meta: any): Logger
  error(message: string, meta: any): Logger
  error(...args: any): Logger {
    this.logger.error.apply(this.logger, args)
    return this
  }
  
  warn(message: string, ...meta: any): Logger
  warn(message: string, meta: any): Logger
  warn(...args: any): Logger {
    this.logger.warn.apply(this.logger, args)
    return this
  }

  info(message: string, ...meta: any): Logger
  info(message: string, meta: any): Logger
  info(...args: any): Logger {
    this.logger.info.apply(this.logger, args)
    return this
  }

  http(message: string, ...meta: any): Logger
  http(message: string, meta: any): Logger
  http(...args: any): Logger {
    this.logger.http.apply(this.logger, args)
    return this
  }

  verbose(message: string, ...meta: any): Logger
  verbose(message: string, meta: any): Logger
  verbose(...args: any): Logger {
    this.logger.verbose.apply(this.logger, args)
    return this
  }

  debug(message: string): Logger
  debug(message: string, meta: any): Logger
  debug(message: string, ...meta: any): Logger
  debug(...args: any): Logger {
    this.logger.debug.apply(this.logger, args)
    return this
  }

  silly(message: string, ...meta: any): Logger
  silly(message: string, meta: any): Logger
  silly(...args: any): Logger {
    this.logger.silly.apply(this.logger, args)
    return this
  }


}
import winston, { format } from 'winston'

export default class Logger {
  private static instance: Logger
  private logger!: winston.Logger

  constructor() {
    if (Logger.instance) {
      return Logger.instance
    } else {
      const level = process.env.DEBUG && process.env.DEBUG.includes('jira-miner') ? 'debug' : 'info'
      const simpleFormat = process.env.NODE_ENV === 'development'
      this.logger = winston.createLogger({
        transports: [new winston.transports.Console({ level })],
        format: simpleFormat
          ? format.combine(format.simple())
          : format.combine(
              format.errors({ stack: true }),
              format.timestamp(),
              format.label({ label: 'jira-miner', message: true }),
              format.json()
            ),
      })
      Logger.instance = this
    }
  }

  public setDebug(): void {
    Object.keys(this.logger.transports).forEach((key: any) => {
      this.logger.transports[key].level = 'debug'
    })
  }

  private _log(level: string, param1: string | any, ...param2: any[]): Logger {
    /* This method implements following Winston like interface
      (message: string): Logger
      (message: string, meta: any): Logger
      (message: string, ...meta: any[]): Logger
      (message: any): Logger
      (infoObject: object): Logger
    */
    if (param2.length === 0) {
      this.logger.log(level, param1)
    } else if (param2.length === 1) {
      this.logger.log(level, param1, param2[0])
    } else {
      this.logger.log(level, param1, ...param2)
    }
    return this
  }

  error(param1: string | any, ...param2: any[]): Logger {
    return this._log('error', param1, ...param2)
  }

  warn(param1: string | any, ...param2: any[]): Logger {
    return this._log('warn', param1, ...param2)
  }

  info(param1: string | any, ...param2: any[]): Logger {
    return this._log('info', param1, ...param2)
  }

  http(param1: string | any, ...param2: any[]): Logger {
    return this._log('http', param1, ...param2)
  }

  verbose(param1: string | any, ...param2: any[]): Logger {
    return this._log('verbose', param1, ...param2)
  }

  debug(param1: string | any, ...param2: any[]): Logger {
    return this._log('debug', param1, ...param2)
  }

  silly(param1: string | any, ...param2: any[]): Logger {
    return this._log('silly', param1, ...param2)
  }
}

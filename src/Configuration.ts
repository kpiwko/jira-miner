import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import Logger from './logger'
import { JiraAuth } from './jira/JiraClient'

export interface JiraConfig {
  target: string
  jira: JiraAuth
}

const logger = new Logger()

export default class Configuration {
  configurationPaths: [string, string]

  constructor() {
    const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE || process.cwd()
    this.configurationPaths = [path.resolve(HOME, '.jira-miner'), path.resolve(process.cwd(), '.jira-miner')]
  }

  async writeConfiguration(config: JiraConfig[]): Promise<string> {
    const fsWriteFile = promisify(fs.writeFile)
    // write down configuration to a file
    let configFile = this.configurationPaths[0]
    try {
      await fsWriteFile(configFile, JSON.stringify(config))
      logger.debug(`JIRA miner configuration stored to HOME directory (${configFile})`)
    } catch (err) {
      logger.warn(`Unable to write down configuration to HOME directory (${configFile})`)
      logger.warn(err)
      // try to write down configuration to local directory
      configFile = this.configurationPaths[1]
      try {
        await fsWriteFile(configFile, JSON.stringify(config, null, 2))
        logger.debug(`JIRA miner configuration stored to local directory (${configFile})`)
      } catch (err) {
        logger.warn(`Unable to write down configuration to current working directory neither (${configFile})`)
        logger.warn(err)
        throw err
      }
    }

    return configFile
  }

  async readConfiguration(): Promise<JiraConfig[]> {
    const fsReadFile = promisify(fs.readFile)
    // find configuration file
    let configFile = this.configurationPaths[0]
    let configurationData: Buffer
    try {
      configurationData = await fsReadFile(configFile)
      logger.debug(`Loaded configuration from HOME directory ${configFile}`)
    } catch (err) {
      logger.warn(`Unable to read configuration file from HOME directory ${configFile}`)
      configFile = configFile = this.configurationPaths[1]
      try {
        configurationData = await fsReadFile(configFile)
        logger.debug(`Loaded configuration from current working directory ${configFile}`)
      } catch (err) {
        logger.warn(`Unable to read configuration file from current working directory neither ${configFile}`)
        logger.warn(err)
        throw err
      }
    }

    try {
      return JSON.parse(configurationData.toString('utf-8'))
    } catch (err) {
      logger.error(`Unable to parse configuration data ${configFile}`)
      logger.error(err)
      throw err
    }
  }

  async updateConfiguration(newConfig: JiraConfig[]): Promise<string> {
    try {
      const config = await this.readConfiguration()

      config.forEach((subConfig: JiraConfig) => {
        const newSubConfig = newConfig.find((c) => c.target === subConfig.target)
        if (newSubConfig) {
          Object.assign(subConfig, newSubConfig)
        }
      })
      newConfig.forEach((subConfig: JiraConfig) => {
        const oldConfig = config.find((c) => c.target === subConfig.target)
        if (!oldConfig) {
          config.push(subConfig)
        }
      })
      return await this.writeConfiguration(config)
    } catch (err) {
      logger.warn('Unable to read jira-miner configuration', err)
      return this.writeConfiguration(newConfig)
    }
  }
}

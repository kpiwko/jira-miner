'use strict'

import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import logger from './logger'
import { JiraAuth } from './jira/JiraClient';

export default class Configuration {

  configurationPaths: [string, string]

  constructor() {
    const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
    this.configurationPaths = [path.resolve(HOME, '.jira-miner'), path.resolve(process.cwd(), '.jira-miner')]
  }

  async writeConfiguration(config: JiraAuth): Promise<string> {
    const fsWriteFile = promisify(fs.writeFile)
    // write down configuration to a file
    let configFile = this.configurationPaths[0]
    try {
      await fsWriteFile(configFile, JSON.stringify(config))
      logger.debug('JIRA miner configuration stored to HOME directory', configFile)
    }
    catch (err) {
      logger.warn('Unable to write down configuration to HOME directory', configFile, err)
      // try to write down configuration to local directory
      configFile = this.configurationPaths[1]
      try {
        await fsWriteFile(configFile, JSON.stringify(config))
        logger.debug('JIRA miner configuration stored to local directory', configFile)
      }
      catch (err) {
        logger.warn('Unable to write down configuration to current working directory neither', configFile, err)
        throw err
      }
    }

    return configFile
  }

  async readConfiguration(): Promise<JiraAuth> {

    const fsReadFile = promisify(fs.readFile)
    // find configuration file
    let configFile = this.configurationPaths[0]
    let configurationData: Buffer
    try {
      configurationData = await fsReadFile(configFile)
      logger.debug('Loaded configuration from HOME directory', configFile)
    }
    catch (err) {
      logger.warn('Unable to read configuration file from HOME directory', configFile, err)
      configFile = configFile = this.configurationPaths[1]
      try {
        configurationData = await fsReadFile(configFile)
        logger.debug('Loaded configuration from current working directory', { configFile })
      }
      catch (err) {
        logger.warn('Unable to read configuration file from current working directory neither', configFile, err)
        throw err
      }
    }

    try {
      return JSON.parse(configurationData.toString('utf-8'))
    }
    catch (err) {
      logger.error('Unable to parse configuration data', configFile)
      throw err
    }
  }

  async updateConfiguration(newConfig: JiraAuth): Promise<string> {
    try {
      const config = await this.readConfiguration()
      Object.assign(config, newConfig)
      return await this.writeConfiguration(config)
    }
    catch (err) {
      logger.warn('Unable to read jira-miner configuration', err)
      const freshConfiguration = Object.assign({}, newConfig)
      return this.writeConfiguration(freshConfiguration)
    }
  }
}
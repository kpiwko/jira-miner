'use strict'

const fs = require('fs')
const path = require('path')
const request = require('request')
const logger = require('./logger')

const writeConfiguration = function(config) {

  return new Promise((resolve, reject) => {
    // write down configuration to a file
    let configFile = configurationPaths[0]
    fs.writeFile(configFile, JSON.stringify(config), err => {
      if(err) {
        logger.debug('Unable to write down configuration to HOME directory', {configFile, err})
        // use local directory instead as fallback option
        configFile = configurationPaths[1]
        fs.writeFile(configFile, JSON.stringify(config), err => {
          if(err) {
            logger.debug('Unable to write down configuration to current working directory neither', {configFile, err})
            return reject({configFile, err})
          }
          else {
            logger.debug('JIRA miner configuration stored to local directory', {configFile})
            return resolve(configFile)
          }
        })
      }
      else {
        logger.debug('JIRA miner configuration stored to HOME directory', {configFile})
        return resolve(configFile)
      }
    })
  })
}

const updateConfiguration = function(...newConfig) {

  return readConfiguration()
    .then(allConfig => {
      Object.assign(allConfig, ...newConfig)
      return writeConfiguration(allConfig)
    })
    .catch(err => {
      logger.warn('Unable to read jira-miner configuration', {err})
      const freshConfiguration = Object.assign({}, ...newConfig)
      return writeConfiguration(freshConfiguration)
    })
}

const readConfiguration = function() {

  return new Promise((resolve, reject) => {
    // find configuration file
    let configFile = configurationPaths[0]
    fs.readFile(configFile, (err, data) => {
      if(err) {
        logger.warn('Unable to read configuration file from HOME directory', {configFile, err})
        configFile = configurationPaths[1]
        fs.readFile(configFile, (err, data) => {
          if(err) {
            logger.error('Unable to read configuration file from current working directory neither', {configFile, err})
            return reject({configFile, err})
          }
          else {
            try {
              logger.debug('Loaded configuration from current working directory', {configFile})
              return resolve(JSON.parse(data))
            }
            catch(e) {
              return reject({e, data})
            }
          }
        })
      }
      else {
        try {
          logger.debug('Loaded configuration from HOME directory', {configFile})
          return resolve(JSON.parse(data))
        }
        catch(e) {
          return reject({e, data})
        }
      }
    })
  })

}

const configurationPaths = (() => {
  const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  return [ path.resolve(HOME, '.jira-miner'), path.resolve(process.cwd(), '.jira-miner')]
})()

module.exports = {
  readConfiguration,
  writeConfiguration,
  updateConfiguration,
  configurationPaths
}

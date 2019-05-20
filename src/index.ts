#!/usr/bin/env node
'use strict'

import * as yargs from 'yargs'
import { stripIndent } from 'common-tags'
import debug from './lib/debug'
import logger from './lib/logger'

const cli = function () {
  var argv = yargs
    .usage(stripIndent`
      usage: $0 <command>

      Jira-miner is a tool that allows you to query and transform locally cached JIRA database.
      For more information about commands, use run '$0 help <command>'
    `)
    .commandDir('./cmd')
    .demandCommand()
    .help('help')
    .option('debug', {
      describe: 'Logs debug information to console output',
      global: true,
      type: 'boolean',
      default: false
    })
    .version()
    .wrap(null)
    .argv

  if (argv.debug) {
    debug()
    logger.debug('Enabled debug logs')
  }
}

cli()

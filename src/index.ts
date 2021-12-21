#!/usr/bin/env node
'use strict'

import * as yargs from 'yargs'
import { stripIndent } from 'common-tags'
import Logger from './logger'

const logger = new Logger()

const cli = function () {
  const argv = yargs
    .usage(
      stripIndent`
      usage: $0 <command>

      Jira-miner is a tool that allows you to query and transform locally cached JIRA database.
      For more information about commands, use run '$0 help <command>'
    `
    )
    .commandDir('./cmd')
    .demandCommand()
    .help('help')
    .option('verbose', {
      alias: 'v',
      describe: 'Be more verbose. You can provide this option twice',
      global: true,
      type: 'count',
    })
    .version()
    .wrap(null).argv

  if (argv['verbose']) {
    logger.setDebug()
    logger.debug('Enabled debug logs')
  }
}

cli()

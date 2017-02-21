#!/usr/bin/env node
'use strict'

const yargs = require('yargs')
const stripIndent = require('common-tags').stripIndent

const cli = function() {
  var argv = yargs
    .usage(stripIndent`
      usage: $0 <command>

      Jira-miner is a tool that allows you to query and transform locally cached JIRA database.
      For more information about commands, use run '$0 help <command>'
    `)
    .commandDir('./cmd')
    .demand(1)
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

  if(argv.debug) {
    require('./lib/debug')()
    require('./lib/logger').debug('Enabled debug logs')
  }
}

cli()

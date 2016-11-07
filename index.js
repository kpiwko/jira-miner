#!/usr/bin/env node
'use strict'

const yargs = require('yargs')

const cli = function() {
  var argv = yargs
    .usage('usage: $0 <command>')
    .commandDir('./cmd')
    .demand(1)
    .help('help')
    .version()
    .wrap(null)
    .argv
}

cli()

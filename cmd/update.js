'use strict'

const jiraClient = require('../lib/jira/client')
const logger = require('../lib/logger')
const stripIndent = require('common-tags').stripIndent
const config = require('../lib/config')
const prettyjson = require('prettyjson')

const command = 'update <query>'
const describe = 'Update all issues in a jira query with new values for given params'
const builder = function (yargs) {
  return yargs
    .usage(stripIndent`
      usage: $0 update <query> [options]

      Updates data on targeted JIRA based on <query> and stores them in local database.
      <query> is JQL query string`
    )
    .option('field', {
      alias: 'f',
      describe: 'Field to change',
      type: ''
    })
    .option('value', {
      alias: 'v',
      describe: 'Value to set',
      type: ''
    })
    .option('limit', {
      alias: 'l',
      describe: 'max number of issues to change, default 200',
      type: ''
    })
    .option('dryrun', {
      alias: 'd',
      describe: 'will not run the update',
      type: ''
    })
    .option('since', {
      alias: 's',
      describe: 'Fetch only issues updated since the value',
      type: ''
    })
    .demand(1)
    .help('help')
    .wrap(null)
}

const handler = function(argv) {
  const query = `${argv.query}${argv.since ? ` AND updated>=${argv.since}`: ''}`
  config.readConfiguration().then(c => {
    const jira = jiraClient(c.jira.url, c.jira.user, c.jira.password)
    return jira.searchJira(query, {
      maxResults: argv.limit || 200,
      startAt: 0,
      fields: ['*navigable']
    }).then(result => {
      const keys = result.issues.map(x => x.key);
      const update = { "fields" : {}};
      update.fields[argv.field] = {value:argv.value}

      logger.info("Issues:")
      for(let issue of result.issues) {
        logger.info(`* ${issue.key} - ${issue.fields.summary}`);
      }
      logger.info(prettyjson.render(update));
      if(argv.dryrun) {
        logger.info(`would have been updated`);
      } else {
        return Promise.all(keys.map(key => jira.updateIssue(key,update)));
      }
    });
  }).catch(err => {
      logger.error(err)
      process.exit(1)
  });
}

module.exports = {command, describe, builder, handler }

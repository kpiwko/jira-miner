# JIRA Miner [![Build Status](https://travis-ci.org/kpiwko/jira-miner.svg?branch=master)](https://travis-ci.org/kpiwko/jira-miner) [![Coverage Status](https://coveralls.io/repos/github/kpiwko/jira-miner/badge.svg?branch=master)](https://coveralls.io/github/kpiwko/jira-miner?branch=master)

A tool to gather data from JIRA and query them locally for better speed and more flexible query language than jql. The tool stores
entries available in JIRA locally in [Loki.js](http://lokijs.org) database in a file. This means the tool has no dependency but Node.js

## Usage

The tool is intended to act both as command line tool or a library in other projects. In order to be able to effectively query something,
you need to populate the database first. Afterwards, you can query content of the database pretty easily.

You can install the tool by
```
npm install -g jira-miner
```

Or, use development copy by
```
git clone https://github.com/kpiwko/jira-miner.git && cd jira-miner && npm link
```

Command line usage follows next, make sure you consult `jira-miner help` if you need further information. You can also run the tool setting `DEBUG=1`
environment variable, which will provide bunyan log traces useful for debugging.

### Connecting to JIRA instance

You need to point jira-miner to a JIRA instance you want to use as data source. You might need to provide your credentials as well in order to
access restricted data.

```
jira-miner target <jiraUri> [--user <user>] [--password [password]]
```

### Populate & update local database

Once, you have targeted a jira, you can populate local database

```
jira populate <jqlQuery>
```

EXAMPLE: `jira-miner populate "project in (AGPUSH, ARQ)"` downloads all issues (including their history) for projects AGPUSH and ARQ)

If you rerun the query, it will rewrite all updated items. It might be a good idea to update the database since the last query to limit
the amount of fetched data. You can do that via `--since` argument that accepts a timestamp.

TIP: For very large queries, you might run out of memory. You can increase memory of node process and reduce GC calls via following:
```
node --max_old_space_size=4096 --nouse-idle-notification index.js populate
```

### Query the database

JIRA miner provides an API to query the database. Query must be defined in one of following formats:

```JavaScript
const query = ctx => {
  // ctx.acc contains result of previous call
  // ctx.collection contains Loki.js collection
  // ctx.args contains optional arguments, such as ones on command line
}

// or
const query = [
  ctx => {
    return xyz    
  },
  ctx => {
    // ctx.acc now contains a result of previous function call
  }
]

// or
const query = [
  { 'age': {'$gt': 21 } /* Loki.js Mongo like query */ }
]

// or mix of function and Loki.js queries

module.exports = {query}
```

Supposing that this file, called _my-example-query.js_ is in current directory, you call it via following

```
jira-miner query my-example-query [--args]
```

All arguments passed on command line will be available in ctx.args object. Example query files is available in [tests/fixtures](tests/fixtures)

### Debug output

Simply run any command with `--debug` parameter

## Testing

Prerequisites:

```
npm install -g tape tap-xunit istanbul coveralls
```

Afterwards, you can run tests via following command:

```
npm test
```

XUnit compatible report generated in _report.xml_ file:
```
npm run xunit
```

Code coverage (via Istanbul tool):
```
npm run coverage
```

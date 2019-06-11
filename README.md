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

You need to point jira-miner to a JIRA instance you want to use as data source. You might need to provide your credentials as well in order to access restricted data.
WARNING: Note that credentials are stored as plain text in your `$HOME` folder.

```
jira-miner target <jiraUri> [--user <user>] [--password [password]]
```

### Populate & update local database

Once, you have targeted a jira, you can populate local database

```
jira-miner populate <jqlQuery>
```

EXAMPLE: `jira-miner populate "project in (AEROGAR, ARQ)"` downloads all issues (including their history) for projects AGPUSH and ARQ)

If you rerun the query, it will rewrite all updated items. It might be a good idea to update the database since the last query to limit
the amount of fetched data. You can do that via `--since` argument that accepts a timestamp.

TIP: For very large queries, you might run out of memory. You can increase memory of node process and reduce GC calls via following:
```
node --max_old_space_size=4096 --nouse-idle-notification dist/index.js populate
```

### Query the database

JIRA miner provides an API to query the database. Query must be defined in one of following formats:

```TypeScript
import { HistoryCollection } from 'jira-miner/dist/lib/db/LocalJiraDB'
import { QueryResult } from 'jira-miner/dist/lib/db/Query'


export async function query(collection: HistoryCollection<any>, args?: object): Promise<any> {
  // async is optional here, for your convenience
}

// this is optional function
export async function transform(result: QueryResult) {
  // async is optional here, for your convenience
}

```

Supposing that this file, called _my-example-query.ts_ is in current directory, and your TypeScript compiler compiles to _dist_ directory, you call your query via following

```
jira-miner query dist/my-example-query.js [--args]
```

All arguments passed on command line will be available in args object. Example query files is available in [src/tests/fixtures](src/tests/fixtures)

### Debug output

Simply run any command with `--verbose` parameter. You can provide it twice (e.g. `-vv`) to have further level of debug output

### Image rendering example

This will render a line chart using date as x-axis and values as y-axis.
For entries that have optional `link` attribute provided, it will additionally render a click-able link in SVG image.

```TypeScript

import TimeLineChart from 'jira-miner/dist/lib/chart/TimeLineChart'

export async function query(collection: HistoryCollection<any>, args?: object): Promise<any> {

  return ['2019-01-12', '2019-08-19'].map((date) => {
    return {
      date: string
      value: number
      link?: string
    }
  })
}

export async function transform(result: QueryResult) {

  const chart = new TimeLineChart({ name: 'Name', axisNames: ['X', 'Y'] })
  const imageBuffer = await chart.render(result.result)
  fs.writeFileSync("dest.png", imageBuffer)

}
```

## Testing

Prerequisites:

```
npm install -g typescript ava nyc
```

Afterwards, you can run tests via following command:

```
npm run build && npm run test
```


Code coverage (via nyc tool):
```
npm run coverage
```

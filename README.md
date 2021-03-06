# JIRA Miner ![CI](https://github.com/kpiwko/jira-miner/workflows/CI/badge.svg) [![Coverage Status](https://coveralls.io/repos/github/kpiwko/jira-miner/badge.svg?branch=main)](https://coveralls.io/github/kpiwko/jira-miner?branch=main)

A tool to gather data from JIRA and query them locally for better speed and more flexible query language than jql. The tool stores entries available in JIRA locally in [Loki.js](http://lokijs.org) database in a file. This means the tool has no dependency but Node.js.

## Usage

The tool is intended to act both as command line tool or a library in other projects. In order to be able to effectively query something,
you need to populate the database first. Afterwards, you can query content of the database pretty easily.

You can install the tool by running
```
npm install -g jira-miner
```

Command line usage follows next, make sure you consult `jira-miner help` if you need further information. You can also run the tool setting `DEBUG=1`
environment variable, which will provide bunyan log traces useful for debugging.

### Connecting to JIRA instance

You need to point jira-miner to a JIRA instance you want to use as data source. You might need to provide your credentials as well in order to access restricted data.
WARNING: Note that credentials are stored as plain text in your `$HOME` folder.

```
jira-miner target [-t <id>] <jiraUri> [--user <user>] [--password [password]]
```

### Populate & update local database

Once, you have targeted a jira, you can populate local database

```
jira-miner populate [-t <id>] <jqlQuery>
```

**EXAMPLE**: `jira-miner populate "project in (AEROGEAR, ARQ)"` downloads all issues (including their history) for projects AEROGEAR and ARQ)

If you rerun the query, it will rewrite all updated items. It might be a good idea to update the database since the last query to limit
the amount of fetched data. You can do that via `--since` argument that accepts a timestamp.

TIP: For very large queries, you might run out of memory. You can increase memory of node process and reduce GC calls via following:
```
npx -n "--max-old-space-size=4096" jira-miner populate
```

### Query the database

JIRA miner provides an API to query the database. Query must be defined in one of following formats:

```TypeScript
import { HistoryCollection } from 'jira-miner/lib/db/LocalJiraDB'
import { QueryResult } from 'jira-miner/lib/db/Query'
import Logger from 'jira-miner/lib/logger'


export async function query<T>(collection: HistoryCollection<Issue>, logger: Logger, args?: Record<string, unknown>): Promise<QueryResult<T>> {
  // async is optional here, for your convenience
}

// this is optional function
export async function transform(result: QueryResult<T>) {
  // async is optional here, for your convenience
}

```

Supposing that this file, called _my-example-query.ts_ is in current directory, and your TypeScript compiler compiles to _dist_ directory, you call your query via following

```
jira-miner query dist/my-example-query.js [--args]
```

All arguments passed on command line will be available in args object. Example query files is available in [src/tests/fixtures](src/tests/fixtures)

### Debug output

Simply run any command with `--verbose` parameter. You can provide it twice (e.g. `-vv`) to have further level of debug output.

You can also setup environment variable `DEBUG` to include `jira-miner` value to get the equivalent of verbose logging.

## Testing

Prerequisites:

```
npm install -g ava typescript nyc coveralls
```

Afterwards, you can run tests via following commands:

```
npm run test
```


Code coverage (via `nyc` tool):
```
npm run coverage
```

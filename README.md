# JIRA Miner ![CI](https://github.com/kpiwko/jira-miner/workflows/CI/badge.svg) [![Coverage Status](https://coveralls.io/repos/github/kpiwko/jira-miner/badge.svg?branch=main)](https://coveralls.io/github/kpiwko/jira-miner?branch=main)

A tool to gather data from JIRA and query them locally for better speed and more flexible query language than JQL. The tool stores entries available in JIRA locally in [Loki.js](http://lokijs.org) database in a file. This means the tool has no dependency but Node.js.

## Requirements

Tool requires Node.js >=16 and uses experimenal `ts-node/esm` loader to be able to work directly with TypeScript.

`jira-miner` binary is wrapping that in execution file, however it requires `coreutils >= 8.30` that supports providing multiple arguments to `env` [CoreUtils](https://lists.gnu.org/archive/html/info-gnu/2018-07/msg00001.html). 
This version of coreutils was released in July 2018 so assuming a large overlap with systems where Node.js 16 is used.

## Usage

The tool is intended to act both as command line tool or a library in other projects. In order to be able to effectively query something,
you need to populate the database first. Afterwards, you can query content of the database pretty easily.

You can install the tool by running

```
npm install -g jira-miner
```

Command line usage follows next, make sure you consult `jira-miner help` if you need further information. 

### Populate & update local database

You can populate local database by executing following command

```
jira-miner populate -u <jira-url> -t <jira-personal-access-token> <jqlQuery>
```

Alternatively, you can source JIRA URL and JIRA PAT from `JIRA_URL` and `JIRA_TOKEN` environment variables.

**EXAMPLE**: `jira-miner populate "project in (AEROGEAR, ARQ)"` downloads all issues (including their history) for projects AEROGEAR and ARQ)

If you rerun the query, it will rewrite all updated items. It might be a good idea to update the database since the last query to limit
the amount of fetched data. You can do that via `--since` argument that accepts a timestamp.

TIP: For very large queries, you might run out of memory. You can increase memory of node process and reduce GC calls via following:
```
npm exec -n "--max-old-space-size=4096" -- jira-miner populate
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

Supposing that this file, called _my-example-query.ts_ is in current directory, because of `ts-node` loader, you call your query via following

```
jira-miner query my-example-query.ts [--args]
```

All arguments passed on command line will be available in args object. Example query files are available in [src/tests/fixtures](src/tests/fixtures)

### Debug output

Simply run any command with `--verbose` parameter. You can provide it twice (e.g. `-vv`) to have additional level of debug output.

You can also setup environment variable `DEBUG` to include `jira-miner` value to get the equivalent of verbose logging.

## Testing

Prerequisites:

```
npm install -g typescript ts-node
```

Running tests (via `ava` tool):

```
npm run test
```

Running code coverage (via `c8` tool):

```
npm run coverage
```

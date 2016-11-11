# JIRA Miner [![Build Status](https://travis-ci.org/kpiwko/jira-miner.svg?branch=master)](https://travis-ci.org/kpiwko/jira-miner) [![Coverage Status](https://coveralls.io/repos/github/kpiwko/jira-miner/badge.svg?branch=master)](https://coveralls.io/github/kpiwko/jira-miner?branch=master)

A tool to gather data from JIRA and query them locally for better speed and more flexible query language than jql.

## Prerequisites

## Testing

Prerequisites:

```
npm install -g tape tap-xunit istanbul coveralls
```

Afterwards, you can run tests via following command:

```
npm test
```

You can also get more debugging output by setting up DEBUG variable, e.g.

```
DEBUG=1 npm test
```

XUnit compatible report generated in _report.xml_ file:
```
npm run xunit
```

Code coverage (via Istanbul tool):
```
npm run coverage
```

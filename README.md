# JIRA Miner [![Build Status](https://travis-ci.org/kpiwko/jira-miner.svg?branch=master)](https://travis-ci.org/kpiwko/jira-miner)

A tool to gather data from JIRA and query them locally for better speed and more flexible query language than jql.

## Prerequisites

## Testing

Prerequisites:

```
npm install -g tape tap-xunit
```

Afterwards, you can run tests via following command:

```
npm test | tee >(tap-xunit > report.xml)
```

You can also get more debugging output by setting up DEBUG variable, e.g.

```
DEBUG=1 npm test
```

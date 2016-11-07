# JIRA Miner [![Build Status](https://travis-ci.org/kpiwko/jira-miner.svg?branch=master)](https://travis-ci.org/kpiwko/jira-miner)

A tool to gather data from JIRA

## Testing

Prerequisites: 

```
npm install -g tape tap-xunit
```

Afterwards, you can run tests via following command

```
npm test | tee >(tap-xunit > report.xml)
```

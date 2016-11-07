= JIRA Miner

== Testing

Prerequisites: 

```
npm install -g tape tap-xunit
```

Afterwards, you can run tests via following command

```
npm test | tee >(tap-xunit > report.xml)
```

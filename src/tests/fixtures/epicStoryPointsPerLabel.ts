import { HistoryCollection } from "src/lib/db/LocalJiraDB";

// usage jira-miner query <path-to-this-file> --fixVersion=<fixVersion> --label=<label>
export function query(collection: HistoryCollection<any>, args: any) {

  const testPlans = collection.chain()
    // find all epics with fix version
    .where(issue => {
      return issue['Issue Type'] === 'Epic' && issue['Fix Version/s'].includes(args.fixVersion)
    })
    // where these epic contain a label
    .where(issue => {
      return issue.Labels.includes(args.label)
    })
    .data().map(issue => issue.key)

  return collection.chain()
    .where(issue => {
      // return issue if a part of the epic
      return testPlans.includes(issue['Epic Link'])
    })
    .mapReduce(issue => {
      return {
        key: issue.key,
        sp: issue['Story Points'],
        labels: issue.Labels
      }
    }, issues => {
      return issues.reduce((acc, issue) => {
        issue.labels.forEach(label => {
          acc[label] = (acc[label] ? acc[label] : 0) + issue.sp
        })
        return acc
      }, {})
    })
}
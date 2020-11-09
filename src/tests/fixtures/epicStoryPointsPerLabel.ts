import { HistoryCollection } from "../../db/LocalJiraDB"

// usage jira-miner query <path-to-this-file> --fixVersion=<fixVersion> --label=<label>
export function query(collection: HistoryCollection<any>, args: any) {

  const testPlans = collection.chain()
    // find all epics with fix version
    .where((issue:any) => {
      return issue['Issue Type'] === 'Epic' && issue['Fix Version/s'].includes(args.fixVersion)
    })
    // where these epic contain a label
    .where((issue:any) => {
      return issue.Labels.includes(args.label)
    })
    .data().map((issue:any) => issue.key)

  return collection.chain()
    .where((issue:any) => {
      // return issue if a part of the epic
      return testPlans.includes(issue['Epic Link'])
    })
    .mapReduce((issue:any) => {
      return {
        key: issue.key,
        sp: issue['Story Points'],
        labels: issue.Labels
      }
    }, (issues:any[]) => {
      return issues.reduce((acc: any, issue: any) => {
        issue.labels.forEach((label: string) => {
          acc[label] = (acc[label] ? acc[label] : 0) + issue.sp
        })
        return acc
      }, {})
    })
}
// usage jira-miner query <path-to-this-file> --fixVersion=<fixVersion> --label=<label>
const storyPointsInEpicsPerLabel = [
  // return all issues with given label in given fixVersion
  ctx => {
    const args = ctx.args
    return ctx.collection.chain()
      // find all epics with fix version
      .where(issue => {
        return issue['Issue Type'] === 'Epic' && issue['Fix Version/s'].includes(args.fixVersion)
      })
      // where these epic contain a label
      .where(issue => {
        return issue.Labels.includes(args.label)
      })
      .data().map(issue => issue.key)
  },
  // return story points for all issues in epics partitioned by labels on these issues
  ctx => {
    const testPlans = ctx.acc

    return ctx.collection.chain()
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
              acc[label] = (acc[label] ? acc[label] : 0 ) + issue.sp
            })
            return acc
          }, {})
      })
  }
]


module.exports.query = storyPointsInEpicsPerLabel

// usage jira-miner query <path-to-this-file> --fixVersion=<fixVersion> --label=<label>
const storyPointsInEpicsPerLabel = [
  // return all issues with given label in given fixVersion
  ctx => {
    const args = ctx.args
    return ctx.collection.chain()
      // find all epics with fix version
      .where(issue => {
        const fv = issue.fields.fixVersions.map(version => version.name)
        return issue.fields.issuetype.name === 'Epic' && fv.includes(args.fixVersion)
      })
      // where these epic contain a label
      .where(issue => {
        return issue.fields.labels.includes(args.label)
      })
      .data().map(issue => issue.key)
  },
  // return story points for all issues in epics partitioned by labels on these issues
  ctx => {
    const testPlans = ctx.acc

    return ctx.collection.chain()
      .where(issue => {
        // return issue if a part of the epic
        return testPlans.includes(issue.fields.customfield_12311140)
      })
      .mapReduce(issue => {
        return {
          key: issue.key,
          sp: issue.fields.customfield_12310243,
          labels: issue.fields.labels
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

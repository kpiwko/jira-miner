'use strict'

const logger = require('../logger')

// max issues to be queried at once
const LIMIT = 1000

const searchIssues = function(jira, query, optional={}) {

  // default values
  const fields = optional.fields || ['*navigable']

  // query for length first and afterwards query all
  return jira.searchJira(query, {
    maxResults: optional.maxResults || 1,
    startAt: 0,
    fields: fields
  })
  .then(issues => {
    const total = issues.total
    // return immediately if no further processing is needed
    if(!!optional.maxResults && total < optional.maxResults) {
      logger.trace({query}, `Found ${total} issues with limit ${optional.maxResults}, returning list`)
      return Promise.resolve(issues.issues)
    }

    logger.trace({query}, `Found ${total} issues, will trigger multiple queries to get full list`)
    let plist = []
    for(let i=0; i < total || (!!optional.maxResults && total < optional.maxResults); i+=LIMIT) {
      logger.trace({query}, `Query for items ${i}..${i+LIMIT} out of ${total}`)
      plist.push(jira.searchJira(query, {
        maxResults: LIMIT,
        startAt: i,
        fields: fields
      }))
    }

    // combine results together
    return Promise.all(plist)
      .then(issuesArray => {
        let issues = issuesArray.reduce((acc, sublist) => { return acc.concat(sublist.issues) }, [])
        return Promise.resolve(issues)
      })
      .catch(err => {
        return Promise.reject(err)
      })
  })
  .catch(err => {
    logger.error({err, query}, 'Unable to fetch issues from JIRA')
    return Promise.reject(err)
  })

}

module.exports = searchIssues

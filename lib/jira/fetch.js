'use strict'

const logger = require('../logger')

// max issues to be queried at once
const LIMIT = 1000

const searchIssues = function(jira, query, optional={}) {

  // default values
  const fields = optional.fields!==undefined ? optional.fields : ['*navigable']

  // query for length first and afterwards query all
  return jira.searchJira(query, {
    maxResults: optional.maxResults || 1,
    startAt: 0,
    fields: fields
  })
  .then(issues => {
    const total = issues.total

    // return immediately if no further processing is needed
    if(!!optional.maxResults && total <= optional.maxResults) {
      logger.trace({query}, `Found ${total} issues within limit of ${optional.maxResults}, returning list`)
      return Promise.resolve(issues.issues)
    }

    logger.trace({query}, `Found ${total} issues, will trigger multiple queries to get full list`)
    let plist = []
    for(let i=0, maxRes=optional.maxResults || total; i <= maxRes; i+=LIMIT) {
      const limit = i + LIMIT > maxRes ? maxRes - i : LIMIT
      logger.trace({query}, `Query for items ${i}..${i+limit} out of ${maxRes}`)
      plist.push(jira.searchJira(query, {
        maxResults: limit,
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

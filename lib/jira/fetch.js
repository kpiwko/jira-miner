'use strict'

const logger = require('../logger')

// max issues to be queried at once
const LIMIT = 1000

const fetch = function(jira, query, optional={}) {

  // default values for fields
  let fields = Array.isArray(optional.fields) ? optional.fields : ['*navigable']
  if(fields.length === 0) {
    fields.push('')
  }

  // query for length first and afterwards query all
  return jira.searchJira(query, {
    maxResults: optional.maxResults || 1,
    startAt: 0,
    fields: fields,
    validateQuery: optional.validateQuery || true,
    expand: optional.expand
  })
  .then(issues => {
    const total = issues.total

    // return immediately if no further processing is needed
    if(optional.maxResults && total <= optional.maxResults) {
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
        fields: fields,
        validateQuery: optional.validateQuery || true,
        expand: optional.expand
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

/**
 * Fetches issues from particual JIRA query. Automatically handles multiple requests
 * to be able to fetch more than 1000 issues, which is default limit in JIRA instance
 * @param {object} jira JIRA handler
 * @param {string} query JQL like query
 * @param {object} optional further properties to be passed to query
 * @param {array} [optional.fields] fields to be retrieved. Can be empty array to fetch no fields.
 *   If not provided, it fetches all navigable fields
 * @param {integer} [optional.maxResults] maxResults to be returned from query, can be over 1000 limit
 * @param {boolean} [optional.validateQuery] validate query on server. By default 'true'
 * @param {array} [optional.expand] Further issue parameters to expand, such as 'changelog' for issue history
 */
module.exports = fetch

'use strict'

const logger = require('../logger')
const history = require('./history')
const normalizer = require('./normalizer')

// max issues to be queried at once
const LIMIT = 200

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
      logger.debug(`Found ${total} issues within limit of ${optional.maxResults}, returning list`, {query})
      return Promise.resolve(issues.issues)
    }

    logger.debug(`Found ${total} issues, will trigger multiple queries to get full list`, {query})
    let plist = [], fetched = 0
    for(let i=0, maxRes=optional.maxResults || total; i <= maxRes; i+=LIMIT) {
      const limit = i + LIMIT > maxRes ? maxRes - i : LIMIT
      logger.debug(`Query for items ${i}..${i+limit} out of ${maxRes}`, {query})
      plist.push(jira.searchJira(query, {
        maxResults: limit,
        startAt: i,
        fields: fields,
        validateQuery: optional.validateQuery || true,
        expand: optional.expand
      }).then(issues => {
        // notify user about progress
        fetched++
        logger.debug(`Fetched ${(fetched/plist.length).toFixed(2) * 100}% of results`, {query})
        return Promise.resolve(issues)
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

  // FIXME this should not be here

  .then(issues => {
    logger.debug('Querying jira for custom fields in order to remap them in issues')
    return jira.listFields()
      .then(fields => {
        issues = normalizer.fieldNamesAndValues(issues, fields)
        return history.attachHistories(issues, fields)
      })
      .catch(err => {
        logger.error(err, `Unable to rename field names in jira or to attach their histories`)
        return Promise.reject(err)
      })
  })
  .catch(err => {
    logger.error('Unable to fetch issues from JIRA', {err, query})
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

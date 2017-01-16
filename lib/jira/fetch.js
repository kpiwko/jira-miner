'use strict'

const logger = require('../logger')

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
      logger.trace({query}, `Found ${total} issues within limit of ${optional.maxResults}, returning list`)
      return Promise.resolve(issues.issues)
    }

    logger.trace({query}, `Found ${total} issues, will trigger multiple queries to get full list`)
    let plist = [], fetched = 0
    for(let i=0, maxRes=optional.maxResults || total; i <= maxRes; i+=LIMIT) {
      const limit = i + LIMIT > maxRes ? maxRes - i : LIMIT
      logger.trace({query}, `Query for items ${i}..${i+limit} out of ${maxRes}`)
      plist.push(jira.searchJira(query, {
        maxResults: limit,
        startAt: i,
        fields: fields,
        validateQuery: optional.validateQuery || true,
        expand: optional.expand
      }).then(issues => {
        // notify user about progress
        fetched++
        logger.trace({query}, `Fetched ${(fetched/plist.length).toFixed(2) * 100}% of results`)
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
  // remap custom fields to real names
  .then(issues => {
    logger.trace('Querying jira for custom fields in order to remap them in issues')
    return jira.listFields()
      .then(fields => {
        logger.trace(`Going to normalize field names for ${issues.length} issues`)
        issues.forEach(issue => {
          normalize(issue, fields)
        })
        logger.trace('Issue fields have been renamed')
        return issues
      })
      .catch(err => {
        logger.warn(err, `Unable to rename field names in jira, keeping original names`)
        return issues
      })
  })
  .catch(err => {
    logger.error({err, query}, 'Unable to fetch issues from JIRA')
    return Promise.reject(err)
  })
}

/**
 * Remamps JSON data to reflect user visible names and also removes some of internal data
 * that are a part of JIRA JSON data by default
 * @param jiraFieldDefinitions definitions of JIRA fields
 */
const normalize = function(issue, jiraFieldDefinitions) {
  jiraFieldDefinitions.forEach(field => {
    // check if this jira has field with current id and replace it with field name
    if(issue.fields && issue.fields[field.id] !== undefined) {
      issue[field.name] = issue.fields[field.id]
      delete issue.fields[field.id]
    }
  })
  // delete issue.fields object - it should be empty at this point
  if(issue.fields && Object.getOwnPropertyNames(issue.fields).length === 0) {
    delete issue.fields
  }

  const normalizeField = function(fieldName, mapper) {
    if(issue[fieldName] !== null && issue[fieldName] !== undefined) {
      issue[fieldName] = mapper(issue[fieldName])
    }
  }

  // do some extra work to remove field details we don't needed
  normalizeField('Project', project => { return { key: project.key, name: project.name}})
  normalizeField('Issue Type', type => type.name)
  normalizeField('Fix Version/s', fixVersions => fixVersions.map(fv => fv.name))
  normalizeField('Resolution', resolution => resolution.name)
  normalizeField('Priority', priority => priority.name)
  normalizeField('Affects Version/s', affectsVersions => affectsVersions.map(av => av.name))
  normalizeField('Component/s', components => components.map(c => c.name))

  normalizeField('Linked Issues', links => links.map(l => {
    const [link, rel] = l.inwardIssue ? [l.inwardIssue, l.type.inward] : [l.outwardIssue, l.type.outward]
    return {
      key: link.key,
      Relation: rel,
      "Issue Type": link.fields.issuetype.name,
      Summary: link.fields.summary,
      Status: link.fields.status.name,
      StatusCategory: link.fields.status.statusCategory.name,
      Priority: link.fields.priority.name
    }
  }))

  normalizeField('Sub-Tasks', subtasks => subtasks.map(subtask => {
    return {
      key: subtask.key,
      "Issue Type": subtask.fields.issuetype.name,
      Summary: subtask.fields.summary,
      Status: subtask.fields.status.name,
      StatusCategory: subtask.fields.status.statusCategory.name,
      Priority: subtask.fields.priority.name
    }
  }))

  const personMapper = (person) => { return {name: person.displayName, key: person.key} }
  normalizeField('Creator', personMapper)
  normalizeField('Reporter', personMapper)
  normalizeField('Assignee', personMapper)
  normalizeField('Tester', personMapper)

  normalizeField('Status', status => { return {
    name: status.name,
    category: status.statusCategory.name
  }})

  if(issue.Status && issue.Status.category) {
    issue.StatusCategory = issue.Status.category
    issue.Status = issue.Status.name
  }

  return issue
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

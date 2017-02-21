'use strict'

const logger = require('../logger')
const moment = require('moment')

/**
 * Remamps JSON data to reflect user visible names and also removes some of internal data
 * that are a part of JIRA JSON data by default
 * @param jiraFieldDefinitions definitions of JIRA fields
 */
const fieldNamesAndValues = function(issues, fieldDefinitions) {

  logger.debug(`Going to normalize field names for ${issues.length} issues`)
  issues.forEach(issue => {

    fieldDefinitions.forEach(field => {
      // check if this jira has field with current id and replace it with field name
      if(issue.fields && issue.fields[field.id] !== undefined) {
        const value = extractValueFromField(field, issue.fields[field.id])
        issue[field.name] = value
        delete issue.fields[field.id]
      }
    })

    // delete issue.fields object - it should be empty at this point
    if(issue.fields && Object.getOwnPropertyNames(issue.fields).length === 0) {
      delete issue.fields
    }

    delete issue.expand
  })

  logger.debug(`All issues ${issues.length} have now their fields altered`)
  return issues
}


const isSchemaTyped = function(fieldSchema) {

  if(!fieldSchema || !!!fieldSchema.schema || !fieldSchema.schema.type) {
    if(fieldSchema && fieldSchema.id == 'issuekey') {
      // this is expected, not to produce log message
      return false
    }
    logger.warn(`Unknown field schema ${JSON.stringify(fieldSchema, null, 2)}, passing original value as is`)
    return false
  }
  return true
}

const extractValueFromField = function(fieldSchema, value) {

  if(!isSchemaTyped(fieldSchema)) {
    return value
  }

  switch(fieldSchema.schema.type) {
    case 'user':
      return value ? value.displayName : null
    case 'array':
      return value ? value.map(v => {
        return extractValueFromField( {
          schema: {
            type: fieldSchema.schema.items
          }
        }, v)
      }) : []
    case 'datetime':
    case 'date':
        return value ? moment.parseZone(value) : null
    case 'project':
    case 'priority':
    case 'status':
    case 'resolution':
    case 'issuetype':
    case 'component':
    case 'version':
      return value ? value.name : null
    case 'issuelinks':
      return value ? (() => {
        // figure out what kind of issuelink we are processing
        let link
        if(!!!value.inwardIssue && !!!value.outwardIssue) {
          link = value
        }
        else {
          link = value.inwardIssue ? value.inwardIssue : value.outwardIssue
        }
        return link ? link.key : null
      })() : null
    default:
      return value ? value : null
  }
}

const extractValueFromString = function(fieldSchema, value) {

  if(!isSchemaTyped(fieldSchema)) {
    return value
  }

  switch(fieldSchema.schema.type) {
    case 'user':
      return value ? value : null
    case 'array':
      return value ? value.split(',').map(v => {
        return extractValueFromString( {
          schema: {
            type: fieldSchema.schema.items
          }
        }, v.trim())
      }) : []
    case 'datetime':
    case 'date':
          return value ? moment.parseZone(value) : null
    case 'project':
      return value ? value : null
    case 'priority':
    case 'status':
    case 'resolution':
    case 'issuetype':
    case 'component':
    case 'version':
      return value ? value : null
    case 'issuelinks':
      // link is represented in full text, such as This issue follows up on ABC-XYZ. Extract just the key
      return value ? value.split(' ').pop() : null
    default:
      return value ? value : null
  }

}

module.exports = {
  fieldNamesAndValues,
  extractValueFromField,
  extractValueFromString
}

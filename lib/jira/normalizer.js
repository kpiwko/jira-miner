'use strict'

const logger = require('../logger')
const moment = require('moment')

const LIMIT = 500

moment.createFromInputFallback = function(config) {
  throw Error(`Value ${config ? config._i : null} does not represent valid ISO date time string`)
};


/**
 * Remamps JSON data to reflect user visible names and also removes some of internal data
 * that are a part of JIRA JSON data by default
 * @param jiraFieldDefinitions definitions of JIRA fields
 */
const fieldNamesAndValues = function(issues, fieldDefinitions) {

  logger.debug(`Going to normalize field names for ${issues.length} issues`)
  issues.forEach((issue, index) => {

    fieldDefinitions.forEach(field => {
      // check if this jira has field with current id and replace it with field name
      if(issue.fields && issue.fields[field.id] !== undefined) {
        const value = extractValueFromField(field, issue.fields[field.id])
        issue[field.name] = value
        delete issue.fields[field.id]
      }
    })

    if( ((index+1) % LIMIT) === 0) {
      logger.debug(`Remapped fields of the first ${index+1} issues`)
    }

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
    if(fieldSchema && (fieldSchema.id == 'issuekey' || fieldSchema.id === 'thumbnail')) {
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
    case 'comments-page':
      if(!value || !value.comments) {
        return []
      }
      return value.comments.map(c => {
        return {
          lastAuthor: extractValueFromField({schema: {type: 'user'}}, c.updateAuthor),
          lastUpdated: extractValueFromField({schema: {type: 'datetime'}}, c.updated),
          content: c.body ? c.body : null
        }
      })
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
        return link ? {key: link.key, type: value.type ? value.type.name : null } : null
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
      if(!value) {
        return null
      }
      const parsed = /^(.*?)([A-Z0-9]+-[0-9]+)(.*?)$/.exec(value)
      if(!parsed) {
        return {
          key: '',
          type: value
        }
      }
      return {
        key: parsed[2],
        type: `${parsed[1]} ${parsed[3]}`.trim()
      }
    default:
      return value ? value : null
  }

}

const describeFields = function(fieldDefinitions) {

  const describeField = function(fieldSchema) {

    if(!isSchemaTyped(fieldSchema)) {
      return ['text', 'Unknown description']
    }

    switch(fieldSchema.schema.type) {
      case 'user':
        return ['text', 'Real user name']
      case 'array':
        const desc =  ['array of '].concat(
          describeField({
            schema: {
              type: fieldSchema.schema.items
            }
          })
        )
        return [desc[0] + desc[1], desc[2]]
      case 'datetime':
        return ['datetime', 'Date time value, such as YYYY-MM-DD HH:MM']
      case 'date':
        return ['date', 'Date value, such as YYYY-MM-DD']
      case 'project':
        return ['text', 'Project key in JIRA']
      case 'priority':
        return ['text', 'Proct priority']
      case 'status':
        return ['text', 'Status of the issue']
      case 'resolution':
        return ['text', 'Resolution of the issue']
      case 'issuetype':
        return ['text', 'Type of issue']
      case 'component':
        return ['text', 'Component associated with the issue']
      case 'version':
        return ['text', 'Version associated with the issue']
      case 'issuelinks':
        return ['{key, type}', 'Issue key associated with the link and type of link,\nsuch as Duplicate']
      case 'comments-page':
        return ['array of {lastAuthor, lastUpdated, content}', 'Comments on the issue with last editing user real name,\nthe last date of modification and content']  
      default:
        return ['text', 'Unknown description']
    }
  }

  return fieldDefinitions.reduce((acc, field) => {
    acc.push([field.name].concat(describeField(field)))
    return acc
  }, [])
}

module.exports = {
  fieldNamesAndValues,
  extractValueFromField,
  extractValueFromString,
  describeFields
}

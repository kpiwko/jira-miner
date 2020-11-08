'use strict'

import * as moment from 'moment'
import * as _ from 'lodash'
import { isSchemaTyped } from '../utils'
import logger from '../logger'

// setup moment fallback configuration
interface moment {
  createFromInputFallback(config: any): void
}
(<any>moment).createFromInputFallback = function (config: any) {
  // toString shows localized date string for changes in the field, attempt to parse it
  const fallback = moment.parseZone(`${config ? config._i : null}+00:00`, 'D/MMM/YYYYZ')
  if(fallback.isValid) {
    config._d = fallback.toDate()
    config._offset = fallback.utcOffset()
    config._isUTC = fallback.isUTC()
  }
  else {
    throw Error(`Value ${config ? config._i : null} does not represent valid ISO date time string`)
  }
}

export interface FieldChange {
  author: string,
  change: moment.Moment,
  from: any | any[],
  to: any | any[]
}

export class Issue {

  id: string
  self: string
  key: string
  History: any

  // there are more fields but those are dynamic

  constructor(issue: any, fieldDefinitions: any) {

    if (!this.History) {
      this.History = {}
    }

    // there three properties are present on any jira issue
    this.id = issue.id
    this.self = issue.self
    this.key = issue.key

    // normalize field values
    fieldDefinitions.forEach(fieldDefinition => {
      // check if this jira has field with current id and replace it with field name
      if (issue.fields && issue.fields[fieldDefinition.id] !== undefined) {
        let value:any = issue.fields[fieldDefinition.id]
        try {
          value = extractValueFromField(fieldDefinition, value)
          this[fieldDefinition.name] = value
        }
        catch(e) {
          logger.warn(`Unable to extract value in ${issue.key} for field "${fieldDefinition.name}":
             field "${JSON.stringify(value)}", definition ${JSON.stringify(fieldDefinition)}, ${e}`)
        }
      }
      // parse and add history  
      const [fieldName, value] = historySerie(issue, fieldDefinition)
      // add history for field in case any changes have been reported
      if (value && value.length > 0) {
        this.History[fieldName] = value
      }
    })
  }
}

export const historySerie = function (issue: any, field: any) {

  if (!issue || !issue.changelog || !issue.changelog.histories) {
    return [field.name, []]
  }

  let history = issue.changelog.histories.reduce((acc: FieldChange[], change) => {
    // find item in history that says the field has been changed
    const fieldChanges = change.items.filter(item => {

      const itemFieldName = item.field.toLowerCase().replace(/\s/g, '')

      const names = field.clauseNames.map(name => {
        return name.toLowerCase().replace(/\s/g, '')
      })

      names.push(field.name.toLowerCase().replace(/\s/g, ''))
      names.push(field.id.toLowerCase().replace(/\s/g, ''))

      return names.includes(itemFieldName)
    })

    // if no such field change has been found, ignore this change
    if (fieldChanges.length === 0) {
      return acc
    }

    // identify changes
    let from, to
    // there was just one change, this is not an array value
    try {
      if(fieldChanges.length === 1) {
        from = extractValueFromString(field, fieldChanges[0].fromString)
        to = extractValueFromString(field, fieldChanges[0].toString)
      }
      else {
        from = fieldChanges.reduce((acc: any, change: any) => {
          acc.push(change.fromString)
          return acc
        }, [])
        from = _.uniq(_.compact(from))
        from = extractValueFromString(field, from.join(','))
        to = fieldChanges.reduce((acc: any, change: any) => {
          acc.push(change.toString)
          return acc
        }, [])
        to = _.uniq(_.compact(to))
        to = extractValueFromString(field, to.join(','))
      }
    }
    catch (e) {
      logger.warn(`Unable to extract field "${field.name}" value from history for ${issue.key} ${e}, ignoring`)
    }

    acc.push({
      author: change.author ? change.author.displayName : null,
      change: moment.parseZone(change.created),
      from,
      to
    })
    return acc
  }, [])

  // sort changes
  history = history.sort((a:FieldChange, b: FieldChange) => moment(a.change).diff(moment(b.change)))

  // push initial value from issue creation to the list of changes
  // if the time of the change is the same as jira creation date, skip adding initial value
  if (history.length > 0 && !(history.length === 1 && history[0].change.diff(moment(issue.Created)) === 0)) {
    history = [{
      author: issue.fields.creator ? issue.fields.creator.displayName : null,
      change: moment.parseZone(issue.fields.created),
      from: history[0].from,
      to: history[0].from
    }].concat(history)
  }

  // return both field name and its history
  return [field.name, history]
}

export const extractValueFromField = function (fieldSchema: any, value: any) {

  const originalValue = value

  if (!isSchemaTyped(fieldSchema)) {
    return value
  }

  switch (fieldSchema.schema.type) {
    case 'user':
      return value ? value.displayName : null
    case 'array':
      return value ? (() => {
        if('total' in value) {
          value = value[fieldSchema.schema.items] || value[`${fieldSchema.schema.items}s`]
          if(!Array.isArray(value)) {
            console.warn(`Unable to parse value ${originalValue} with schema ${fieldSchema}, returning empty field.`)
            value = []
          }
        }
        return value.map((v:any) => {
          return extractValueFromField({
            schema: {
              type: fieldSchema.schema.items
            }
          }, v)
        })
      })() : []
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
      if (!value || !value.comments) {
        return []
      }
      return value.comments.map(c => {
        return {
          lastAuthor: extractValueFromField({ schema: { type: 'user' } }, c.updateAuthor),
          lastUpdated: extractValueFromField({ schema: { type: 'datetime' } }, c.updated),
          content: c.body ? c.body : null
        }
      })
    case 'issuelinks':
      return value ? (() => {
        // figure out what kind of issuelink we are processing
        let link
        if (!!!value.inwardIssue && !!!value.outwardIssue) {
          link = value
        }
        else {
          link = value.inwardIssue ? value.inwardIssue : value.outwardIssue
        }
        return link ? { key: link.key, type: value.type ? value.type.name : null } : null
      })() : null
    case 'worklog':
      // unsure whether any parsing is needed, treat is as value
    default:
      // FIXME empty string vs 'null' behavior, unclear whether it has any impact
      return value ? value : null
  }
}

export const extractValueFromString = function (fieldSchema: any, value: any) {

  if (!isSchemaTyped(fieldSchema)) {
    return value
  }

  switch (fieldSchema.schema.type) {
    case 'user':
      return value ? value : null
    case 'array':
      return value ? value.split(',').map(v => {
        return extractValueFromString({
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
      if (!value) {
        return null
      }
      const parsed = /^(.*?)([A-Z0-9]+-[0-9]+)(.*?)$/.exec(value)
      if (!parsed) {
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
      // FIXME empty string vs 'null' behavior, unclear whether it has any impact
      return value ? value : null
  }
}


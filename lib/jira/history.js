'use strict'

const moment = require('moment')
const logger = require('../logger')
const extractValue = require('./normalizer').extractValueFromString

const attachHistories = function(issues, jiraFieldDefinitions) {
  logger.debug(`Attaching history to ${issues.length} issues`)
  issues.forEach(issue => {
    addHistorySeries(issue, jiraFieldDefinitions)
    delete issue.changelog
  })
  logger.debug(`History has been attached to ${issues.length} issues`)
  return issues
}

const addHistorySeries = function(issue, jiraFieldDefinitions) {
  if(!issue.History) {
    issue.History = {}
  }

  // set history for all specified fields
  jiraFieldDefinitions.reduce((acc, fieldDefinition) => {
    const [fieldName, value] = historySerie(issue, fieldDefinition)
    // add history for field in case any changes have been reported
    if(value && value.length > 0) {
      acc[fieldName] = value
    }
    return acc
  }, issue.History)

  return issue
}


const historySerie = function (issue, field) {

  if(!issue || !issue.changelog || !issue.changelog.histories) {
    return [field.name, []]
  }

  let fieldChanges = issue.changelog.histories.reduce((acc, change) => {
    // find item in history that says the field has been changed
    const fieldChanges = change.items.filter(item => {

      const fieldNameLowerCase = field.name.toLowerCase().replace(/\s/g, '')
      const fieldIdLowerCase = field.id.toLowerCase().replace(/\s/g, '')
      const itemFieldName = item.field.toLowerCase().replace(/\s/g, '')

      return itemFieldName.startsWith(fieldIdLowerCase) || itemFieldName.startsWith(fieldNameLowerCase)
        || /* omitted, leads to conflicts fieldIdLowerCase.startsWith(itemFieldName) || */ fieldNameLowerCase.startsWith(itemFieldName)
    })

    // if no such field change has been found, ignore this change
    if(fieldChanges.length === 0) {
      return acc
    }

    // merge field changes and change item details together and push it to history candidate
    fieldChanges.forEach(fieldChange => {
      acc.push(Object.assign({}, fieldChange, change))
    })
    return acc
  }, [])



  fieldChanges = fieldChanges.sort((a, b) => moment(a.change).diff(moment(b.change)))

  // push initial value from issue creation to the list of changes
  // if the time of the change is the same as jira creation date, skip adding initial value
  if(fieldChanges.length > 0 && !(fieldChanges.length === 1 && moment(fieldChanges[0].created).diff(moment(issue.Created)) === 0)) {
    fieldChanges = [{
      author: {
        displayName: issue.Creator
      },
      created: issue.Created,
      fromString: fieldChanges[0].fromString,
      toString: fieldChanges[0].fromString
    }].concat(fieldChanges)
  }

  let lastChange = null
  let history = fieldChanges.map(change => {
    return {
      author: change.author ? change.author.displayName: null,
      change: change.created,
      from: extractValue(field, change.fromString),
      to: extractValue(field, change.toString)
    }
  }).reduce((acc, change) => {

    // merge field entries together if they have been done at the same time
    if(lastChange && moment(lastChange.change).diff(moment(change.change)) === 0) {
      acc.push({
        author: change.author,
        change: moment.parseZone(change.change),
        from: change.from,
        to: lastChange.to
      })
    }
    // this has been different change, keep
    if(lastChange && moment(lastChange.change).diff(moment(change.change)) !== 0) {
      acc.push(lastChange)
      lastChange = change
    }
    lastChange = change
    return acc
  }, [])

  // do have have last change to be added?
  if(lastChange && (history.length === 0 || moment(lastChange.change).diff(moment(history[history.length-1].change)) !== 0)) {
    history.push(lastChange)
  }

  // return both field name and its history
  return [field.name, history]
}

module.exports = {
  attachHistories,
  addHistorySeries,
  historySerie
}

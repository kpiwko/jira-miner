'use strict'

const moment = require('moment')
const logger = require('../logger')

const status = function(issue) {
  const field = 'status'
  return historySeries(issue, field, issue => {
    return [ issue.fields.status.id, issue.fields.status.name]
  })
}

const fixVersion = function(issue) {
  const field = 'Fix Version'
  return historySeries(issue, field, issue => {
    return [issue.fields.fixVersions.map(v => v.id), issue.fields.fixVersions.map(v => v.name)]
  })
}

const addAllSeries = function(issue) {
  return addHistorySeries(issue, status, fixVersion)
}

const addHistorySeries = function(issue, ...series) {

  if(!issue.history) {
    issue.history = {}
  }

  // get history for all fields specified
  const history = series.reduce((acc, serie) => {
    const [field, value] = serie(issue)
    acc[field] = value
    return acc
  }, issue.history)

  // attach history to the issue
  return issue
}

const historySeries = function (issue, fieldName, currentFieldValueMap) {
  const createdDate = issue.fields.created
  const lastUpdated = issue.fields.updated

  // find current value of given field
  const [currentValue, currentValueString] = currentFieldValueMap(issue)

  const fieldChanges = issue.changelog.histories.reduce((acc, change) => {
    // find item in history that says the field has been changed
    const fieldChange = change.items.find(item => {
      return fieldName === item.field
    })

    // if no such field change has been found, ignore this change
    if(!fieldChange) {
      return acc
    }

    // merge field change and change item details together and push it to history candidate
    acc.push(Object.assign({}, fieldChange, change))
    return acc
  }, [])

  let initialValue, initialValueString;

  let history = fieldChanges.map(change => {
    if(!initialValue) {
      initialValue = change.from
      initialValueString = change.fromString
    }
    return {
      change: change.created,
      value: change.to,
      valueString: change.toString
    }
  })

  // create initial value if value has not changed in the past
  if(history.length === 0) {
    history = [{
      change: createdDate,
      value: currentValue,
      valueString: currentValueString
    }]
  }
  // push initial state if state has changed at least once
  else {
    history = [{
      change: createdDate,
      value: initialValue,
      valueString: initialValueString
    }].concat(history)
  }

  // return both field name and its history
  return [fieldName, history]
}

module.exports = {
  addAllSeries,
  addHistorySeries,
  historySeries,
  status
}

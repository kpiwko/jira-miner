'use strict'

const moment = require('moment')
const logger = require('../logger')

const addHistory = function (issue) {
  const createdDate = issue.fields.created
  const lastUpdated = issue.fields.updated
  const currentState = issue.fields.status.id
  const currentStateString = issue.fields.status.name

  const stateChanges = issue.changelog.histories.reduce((acc, change) => {
    // find item in history that says the status field has been changed
    const stateFieldChange = change.items.find(item => {
      return item.field === 'status'
    })

    // if no such state field change has been found, ignore this change
    if(!stateFieldChange) {
      return acc
    }

    // merge status change field details to changelog item
    acc.push(Object.assign(change, stateFieldChange))
    return acc
  }, [])

  let initialState, initialStateString;

  let states = stateChanges.map(change => {
    if(!initialState) {
      initialState = change.from
      initialStateString = change.fromString
    }
    return {
      change: change.created,
      state: change.to,
      stateString: change.toString
    }
  })

  // create initial state if state has not changed in the past
  if(states.length === 0) {
    states = [{
      change: createdDate,
      state: currentState,
      stateString: currentStateString
    }]
  }
  // push initial state if state has changed at least once
  else {
    states = [{
      change: createdDate,
      state: initialState,
      stateString: initialStateString
    }].concat(states)
  }

  issue.states = states
  return issue
}

module.exports = addHistory

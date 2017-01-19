'use strict'

const jiraFetch = require('./fetch')
const history = require('./history')

const populate = function (jira, db, query, optional, collection='default') {
  return jiraFetch(jira, query, optional)
    .then(issues => {
      return Promise.resolve(db.populate(collection, issues))
    })
}

module.exports = populate

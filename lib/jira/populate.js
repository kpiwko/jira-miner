'use strict'

const jiraFetch = require('./fetch')
const history = require('./history')

const populate = function (jira, db, query, optional, collection='default') {
  return jiraFetch(jira, query, optional)
    .then(issues => {

      if(optional.expand) {
        issues.forEach(issue => {
          // populate history field
          issue = history.addAllSeries(issue)
        })
      }

      return Promise.resolve(db.populate(collection, issues))
    })
}

module.exports = populate

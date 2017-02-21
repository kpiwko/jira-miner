'use strict'

const Loki = require('lokijs')
const moment = require('moment')
const logger = require('../logger')

const snapshotInTime = function(date, issue) {

  date = date ? moment(date) : moment()

  // skip evaluation is issue has been created after snapshot date
  if(moment(issue.Created).isAfter(date)) {
    return null
  }
  const copy = Object.assign({}, issue)

  //const copy = Object.assign({}, issue)
  Object.keys(issue.History).forEach(field => {
    // find the last change prior 'date' for each field and replace current value
    // in a copy of the issue with that value
    const last = issue.History[field]
      .filter(fieldChange => {
        return moment(fieldChange.change).isBefore(date)
      })
      // FIXME this might not be sorting the right direction
      .sort((a, b) => {
        // sort ascending, so the latest change is the last element in the list
        return moment(a.change).diff(moment(b.change))
      })

    if(last.length > 0) {
      copy[field] = last[last.length - 1].to
    }
  })

  copy.SnapshotVersion = date.format()

  return copy
}

class ExtendedLoki extends Loki {

  populate(collectionName, data) {

    let collection = this.getCollection(collectionName)
    if(collection === null) {
      logger.debug(`Created collection ${collectionName} in database`)
      this.addCollection(collectionName, { indices: ['id', 'key']})
      collection = this.getCollection(collectionName)
    }

    // data are already in, update based on issue id
    // update might be done a better way - for now it just deletes all previous entries
    const toBeDeleted = data.reduce((acc, issue) => {
      acc.push(issue.id)
      return acc
    }, [])

    logger.debug(`Going to drop ${toBeDeleted.length} entries from collection ${collectionName} as they have been updated`)
    collection.removeWhere(issue => {
      return toBeDeleted.includes(issue.id)
    })

    // insert data into database
    logger.debug(`Inserting ${data.length} entries into collection ${collectionName}`)
    collection.insert(data)

    collection.setTransform('history', [
      {
        type: 'mapReduce',
        mapFunction: '[%lktxp]mapFunction',
        reduceFunction: '[%lktxp]reduceFunction'
      }
    ])

    logger.debug(`Collection ${collectionName} now contains ${collection.count()} entries`)
    return collection
  }

  getCollection(collectionName) {
    const collection = super.getCollection(collectionName)
    if(collection==null) {
      return null
    }
    // FIXME there should be a better way how to use inheritance here
    collection.history = function(date) {
      return collection.chain('history', {
        mapFunction: function(issue) {
          return snapshotInTime(date, issue)
        },
        reduceFunction: function(issues) {
          return issues.filter(issue => issue !== null)
        }
      })
    }

    return collection
  }


}


var DB = function(path) {

  // create a Loki.js instance with filesystem storega in particular path
  const db = new ExtendedLoki(path, {
    adapter: new Loki.persistenceAdapters.fs()
  })

  return new Promise((resolve, reject) => {
    db.loadDatabase({}, (err, _) => {
      if(err) {
        logger.warn('Unable to load database, ignoring', {path, err})
        return resolve(db)
      }
      logger.debug('Database loaded', {path})
      return resolve(db)
    })
  })

}

module.exports = DB

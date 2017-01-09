'use strict'

const Loki = require('lokijs')
const logger = require('../logger')



class ExtendedLoki extends Loki {

  populate(collectionName, data) {

    let collection = this.getCollection(collectionName)
    if(collection === null) {
      logger.trace(`Created collection ${collectionName} in database`)
      collection = this.addCollection(collectionName, { indices: ['id', 'key']})
    }

    // data are already in, update based on issue id
    // update might be done a better way - for now it just deletes all previous entries
    const toBeDeleted = data.reduce((acc, issue) => {
      acc.push(issue.id)
      return acc
    }, [])

    logger.trace(`Going to drop ${toBeDeleted.length} entries from collection ${collectionName} as they have been updated`)
    collection.removeWhere(issue => {
      return toBeDeleted.includes(issue.id)
    })

    // insert data into database
    logger.trace(`Inserting ${data.length} entries into collection ${collectionName}`)
    collection.insert(data)
    logger.trace(`Collection ${collectionName} now contains ${collection.count()} entries`)
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
        logger.trace({path, err}, 'Unable to load database, ignoring')
        return resolve(db)
      }
      logger.trace({path}, 'Database loaded')
      return resolve(db)
    })
  })

}

module.exports = DB

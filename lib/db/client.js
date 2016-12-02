'use strict'

const Loki = require('lokijs')
const logger = require('../logger')



class ExtendedLoki extends Loki {

  populate(collectionName, data) {
    const collection = this.addCollection(collectionName)
    collection.insert(data)
    return collection
  }
}


var DB = function(path) {

  const db = new ExtendedLoki(path, {
    adapter: new Loki.persistenceAdapters.fs()
  })

  db.populate = function(collectionName, data) {
    const collection = this.addCollection(collectionName)
    collection.insert(data)
    return collection
  }

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

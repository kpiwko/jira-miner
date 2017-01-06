'use strict'

const Loki = require('lokijs')
const logger = require('../logger')



class ExtendedLoki extends Loki {

  populate(collectionName, data) {

    let collection = this.getCollection(collectionName)
    if(collection === null) {
      logger.trace(`Created collection ${collectionName} in database`)
      collection = this.addCollection(collectionName)
    }

    // data are already in, update based on issue id
    const ids = collection.mapReduce(issue => {
      issue.id
    }, ids => {
      return ids;
    })

    //collection.updateWhere()

    // insert data into database
    collection.insert(data)
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

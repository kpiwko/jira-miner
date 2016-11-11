'use strict'

const Loki = require('lokijs')

class DB extends Loki {
  constructor(path) {
    super(path)
  }

  populate(collectionName, data) {
    const collection = this.addCollection(collectionName)
    collection.insert(data)
    return collection
  }
}

module.exports = DB

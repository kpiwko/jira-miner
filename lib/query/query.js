'use strict'

const logger = require('../logger')

const queryFunction = function(collection, query) {

  query = Array.isArray(query) ? query : [query]

  return new Promise((resolve, reject) => {
    let bailedOut = undefined
    const data = query.reduce((acc, subquery, index) => {
      // do not execute query anymore if it failed
      if(bailedOut) {
        return acc
      }

      // check whether collection has a function with given name to be invoked
      const func = acc[subquery.func]
      if(func === undefined || !func instanceof Function) {
        logger.error({subquery}, `${subquery.func}(${JSON.stringify(subquery.args)}) is not a function invokable on database collection, bailing out.`)
        bailedOut = {
          func: subquery.func,
          args: subquery.args,
          location: `${index+1} out of ${query.length}`,
          msg: 'Not a function to be invokable on database collection'
        }
        return acc
      }

      // apply query to a collection
      logger.trace({subquery, func}, `Applying subquery ${index+1} out of ${query.length}, results ${acc.count()}`)
      const args = Array.isArray(subquery.args) ? subquery.args : [ subquery.args ]
      return func.apply(acc, args)

    }, collection.chain()).data()

    if(bailedOut) {
      return reject(bailedOut)
    }

    return resolve(data)
  })
}

module.exports = queryFunction

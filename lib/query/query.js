'use strict'

const util = require('util')
const logger = require('../logger')

const query = function(collection, query, args={}) {

  // make sure query is an array
  query = Array.isArray(query) ? query : [query]

  const type = {
    FUNCTION: Symbol('function'),
    LOKIJS: Symbol('lokijs')
  }

  return query.reduce((pacc, subquery, index) => {

    // wrap subquery into function that returns a promise with execution context in the form
    // { acc: result accumulator, collection: collection currently queried, args: command line passed args }
    const wrap = function(subquery) {

      const isFunction = function(subquery) {
        return subquery instanceof Function
      }

      const isLokiChain = function(subquery) {
        return subquery.func !== undefined && collection.chain()[subquery.func] instanceof Function
      }

      const hasData = function(ctx) {
        return ctx.acc != undefined && ctx.acc.data !== undefined && ctx.acc.data instanceof Function
      }


      return function(ctx) {

        return new Promise((resolve, reject) => {

          let newCtx = {};

          // user provided a function to query collection
          if(isFunction(subquery)) {
            logger.trace({subquery}, `Applying subquery in form of function`)

            // we want to normalize data first ( e.g. call .data() if current acc is still in chain() mode)
            if(ctx.lastType === type.LOKIJS && hasData(ctx)) {
              logger.trace(`Automatically populating ctx.acc with data chain holds now`)
              ctx.acc = ctx.acc.data()
            }

            newCtx = {
              acc: subquery.call(null, ctx),
              collection: ctx.collection,
              args: Object.assign({}, args),
              lastType: type.FUNCTION
            }
          }
          // user provided loki.js json-like notion
          else if(isLokiChain(subquery)) {

            // apply query to a result set
            let scope = ctx.acc
            // start new chain if no chain exists now
            if(ctx.lastType === type.FUNCTION && !hasData(ctx)) {
                scope = ctx.collection.chain()
            }

            const func = scope[subquery.func]
            logger.trace({subquery, func}, `Applying subquery in form of loki.js chainable object`)
            const chainArgs = Array.isArray(subquery.args) ? subquery.args : [ subquery.args ]
            newCtx = {
              acc: func.apply(scope, chainArgs),
              collection: ctx.collection,
              args: Object.assign({}, args),
              lastType: type.LOKIJS
            }
          }
          else {
            // otherwise raise error - we don't know how to process that thing
            return reject(new Error(`Not an invokable function ${util.inspect(subquery)}`))
          }
          // return execution context or in case this is the last call, return acc
          if(index === query.length-1) {
            if(hasData(newCtx)) {
              logger.trace(`Automatically populating resolved object with what data chain holds now`)
              return resolve(newCtx.acc.data())
            }
            logger.trace(`Automatically populating resolved object with ctx.acc value`)
            return resolve(newCtx.acc)
          }
          // return context so next promise can use it
          return resolve(newCtx)
        })
      }
    }

    // wrap subquery into function that accepts execution context
    const fn = wrap(subquery)
    return pacc = pacc.then(fn)

  }, Promise.resolve({
      // the first call expects that people are using loki.js chain syntax by default
      acc: collection.chain(),
      collection,
      args: Object.assign({}, args),
      lastType: undefined
  }))
}

module.exports = query

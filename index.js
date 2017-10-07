const Model = require('./src/model')
const Mixin = require('./src/mixin')
const Protocol = require('./src/protocol')
const Collection = require('./src/collection')
const EmittingArray = require('./src/emitting_array')

let promiseFactory = function (...args) {
  return new Promise(...args)
}

promiseFactory.resolve = Promise.resolve.bind(Promise)
promiseFactory.all = Promise.all.bind(Promise)

module.exports = {
  Model,
  Mixin,
  Protocol,
  Collection,
  EmittingArray,
  makeEmitter: require('./src/emitter')

  setPromiseFactory: function (factory) {
    promiseFactory = factory
  },
  resolvePromise: function (arg) {
    return promiseFactory.resolve(arg)
  },
  rejectPromise: function (arg) {
    return promiseFactory.reject(arg)
  },
  allPromise: function (arg) {
    return promiseFactory.all(arg)
  },
  createPromise: function (...args) {
    return promiseFactory(...args)
  }
}

let protocols = require('./src/protocols')
for (let protocolName in protocols) {
  Protocol[protocolName] = protocols[protocolName]
}

let mixins = require('./src/mixins')
for (let mixinName in mixins) {
  Mixin[mixinName] = mixins[mixinName]
}

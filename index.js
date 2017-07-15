const Model = require('./src/model')
const Mixin = require('./src/mixin')
const Protocol = require('./src/protocol')
const Collection = require('./src/collection')

module.exports = {
  Model,
  Mixin,
  Protocol,
  Collection,
  makeEmitter: require('./src/emitter')
}

let protocols = require('./src/protocols')
for (let protocolName in protocols) {
  Protocol[protocolName] = protocols[protocolName]
}

let mixins = require('./src/mixins')
for (let mixinName in mixins) {
  Mixin[mixinName] = mixins[mixinName]
}

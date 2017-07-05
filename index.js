const Model = require('./src/model')
const Mixin = require('./src/mixin')
const Storage = require('./src/storage')
const Collection = require('./src/collection')

module.exports = { Model, Mixin, Storage, Collection }

let mixins = require('./src/mixins')
for (let builtin in mixins) {
  Mixin[builtin] = mixins[builtin]
}

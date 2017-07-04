const Model = require('./src/model')
const Mixin = require('./src/mixin')
const Storage = require('./src/storage')

module.exports = { Model, Mixin, Storage }

let mixins = require('./src/mixins')
for (let builtin in mixins) {
  Mixin[builtin] = mixins[builtin]
}

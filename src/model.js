'use strict'

const $$constructor = Symbol('construct')
const $$fields = Symbol('fields')
const $$data = Symbol('data')
const $$findOne = Symbol('find_one')
const $$findMany = Symbol('find_many')
const $$store = Symbol('store')
const $$mixins = Symbol('mixins')

const Field = require('./field')
const DerivedProperty = require('./derived')
const emitter = require('./emitter')

function ModelDefinitionException (code, message, value) {
  this.code = code
  this.message = message
  this.value = value
}

const Model = function Model (name) {
  const klass = function (...args) {
    this[$$data] = {}
    klass[$$constructor].apply(this, args)
    klass.$emit('new', this)
  }

  Object.defineProperty(klass, 'name', {value: name, __proto__: null})
  Object.defineProperty(klass, 'mixins', { get: function () { return this[$$mixins] } })
  Object.defineProperty(klass.prototype, '$data', {get: function () { return this[$$data] }})

  emitter(klass)
  emitter(klass.prototype)

  klass[$$constructor] = function (data) {
    if (data == null) return

    for (let fieldName in klass[$$fields]) {
      let field = klass[$$fields][fieldName]
      if (data[fieldName] != null) {
        field.maybeUpdate(this, data[fieldName])
      }
    }
  }
  klass[$$fields] = {}
  klass[$$mixins] = []

  klass.construct = function (fn) {
    if (fn instanceof Function) {
      klass[$$constructor] = fn
    }
    return klass
  }

  klass.field = function (name, type, options) {
    const newField = new Field(name, type, options)
    newField.augmentModel(klass)
    klass[$$fields][name] = newField
    return klass
  }

  klass.fields = function (fields) {
    if (fields == null) {
      return klass[$$fields]
    } else {
      for (let name of Object.keys(fields)) {
        let newField = Field.shorthand(name, fields[name])
        newField.augmentModel(klass)
        klass[$$fields][name] = newField
      }
      return klass
    }
  }

  klass.derive = function (name, options, getter) {
    let derived = new DerivedProperty(name, options, getter)
    derived.augmentModel(klass)
    return klass
  }

  klass.use = function (mixin) {
    var alreadyMixedIn = klass.mixins.some(function (other) {
      return other.constructor.uniqueKey() === mixin.constructor.uniqueKey()
    })

    if (alreadyMixedIn) {
      throw new ModelDefinitionException('conflict', `Mixin ${mixin.constructor.name} is already being used in ${this.name}`, mixin)
    } else {
      klass.mixins.push(mixin)
      mixin.augmentModel(this)
      mixin.constructor.$emit('use', mixin, klass)
      mixin.$emit('use', klass)
    }

    return klass
  }

  klass.prototype.update = function (data) {
    let difference = {}
    for (let fieldName in data) {
      if (fieldName in klass.fields()) {
        let field = klass.fields()[fieldName]
        if (field.maybeUpdate(this, data[fieldName])) {
          difference[fieldName] = this[fieldName]
        }
      }
    }
    if (Object.keys(difference).length > 0) {
      this.$emit('change', difference)
      klass.$emit('change', this, difference)
    }
  }

  return klass
}

Model.DefinitionException = ModelDefinitionException

module.exports = Model

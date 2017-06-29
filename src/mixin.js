'use strict'

const $$constructor = Symbol('construct')

const $$derivedProperties = Symbol('derived')
const $$findOne = Symbol('find_one')
const $$findMany = Symbol('find_many')
const $$store = Symbol('store')
const $$usedMixins = Symbol('used')
const $$methods = Symbol('methods')

const DerivedProperty = require('./derived')

const emitter = require('./emitter')

module.exports = function Mixin (name) {
  const klass = function (...args) {
    klass[$$constructor].apply(this, args)
    klass.$emit('new', this)
  }
  const uniqueKey = Symbol('key')

  Object.defineProperty(klass, 'name', {value: name, __proto__: null})
  Object.defineProperty(klass, 'uniqueKey', {value: () => uniqueKey, __proto__: null})

  emitter(klass)
  emitter(klass.prototype)

  klass[$$constructor] = function (data) {
    if (typeof data === 'object') {
      for (let key in data) {
        this[key] = data[key]
      }
    }
  }

  klass[$$derivedProperties] = []
  klass[$$findOne] = []
  klass[$$findMany] = []
  klass[$$store] = []
  klass[$$usedMixins] = []
  klass[$$methods] = {}

  klass.construct = function (fn) {
    if (fn instanceof Function) {
      klass[$$constructor] = fn
    }
    return klass
  }

  klass.derive = function (name, options, getter) {
    klass[$$derivedProperties].push({ name, options, getter })
    return klass
  }

  klass.use = function (mixin) {
    klass[$$usedMixins].push(mixin)
    return klass
  }

  klass.method = function (name, fn) {
    if (typeof fn === 'function') {
      klass[$$methods][name] = fn
    }
    return klass
  }

  klass.methods = function (methods) {
    if (typeof methods === 'object') {
      for (let methodName in methods) {
        klass.method(methodName, methods[methodName])
      }
    }
    return klass
  }

  klass.prototype.augmentModel = function (model) {
    augmentWithDerivedProperties(this, model)
    augmentWithMethods(this, model)
    augmentWithMixins(this, model)
  }

  function augmentWithDerivedProperties (mixin, model) {
    for (let derivedArgs of klass[$$derivedProperties]) {
      var { name, options, getter } = derivedArgs
      if (typeof options === 'function') {
        getter = options
        options = {}
      }

      let derived = new DerivedProperty(name, options, function (...args) {
        return getter.apply(this, [mixin].concat(args))
      })
      derived.augmentModel(model)
    }
  }

  function augmentWithMethods (mixin, model) {
    for (let methodName in klass[$$methods]) {
      let method = klass[$$methods][methodName]
      model.method(methodName, function (...args) {
        return method.call(this, mixin, ...args)
      })
    }
  }

  function augmentWithMixins (mixin, model) {
    for (let subMixin of klass[$$usedMixins]) {
      if (typeof subMixin === 'function') {
        model.use(subMixin.call(mixin))
      } else {
        model.use(subMixin)
      }
    }
  }

  return klass
}

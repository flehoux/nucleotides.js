'use strict'

const __constructor = Symbol('construct')

const __derived_properties = Symbol('derived')
const __find_one = Symbol('find_one')
const __find_many = Symbol('find_many')
const __store = Symbol('store')
const __used_mixins = Symbol('used')

const DerivedProperty = require('./derived')

const emitter = require('./emitter')

module.exports = function Mixin (name) {
  const klass = function (...args) {
    klass[__constructor].apply(this, args)
    klass.$emit("new", this)
  }
  const uniqueKey = Symbol('key')

  Object.defineProperty(klass, 'name', {value: name, __proto__: null})
  Object.defineProperty(klass, 'uniqueKey', {value: () => uniqueKey, __proto__: null})

  emitter(klass)
  emitter(klass.prototype)

  klass[__constructor] = function (data) {
    if (typeof data === 'object') {
      for (let key in data) {
        this[key] = data[key]
      }
    }
  }
  klass[__derived_properties] = []
  klass[__find_one] = []
  klass[__find_many] = []
  klass[__store] = []
  klass[__used_mixins] = []

  klass.construct = function (fn) {
    if (fn instanceof Function) {
      klass[__constructor] = fn
    }
    return klass
  }

  klass.derive = function (name, options, getter) {
    klass[__derived_properties].push({ name, options, getter })
    return klass
  }

  klass.mixin = function (mixin) {
    klass[__used_mixins].push(mixin)
    return klass
  }

  klass.prototype.augmentModel = function (model) {
    let mixin = this
    for (let derivedArgs of klass[__derived_properties]) {
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

    for (let subMixin of klass[__used_mixins]) {
      if (typeof subMixin === 'function') {
        model.mixin(subMixin.call(this))
      } else {
        model.mixin(subMixin)
      }
    }
  }

  return klass
}

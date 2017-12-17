'use strict'

const $$constructor = Symbol('construct')

const $$attributes = Symbol('attributes')
const $$derivedProperties = Symbol('derived')
const $$staticProperties = Symbol('statics')
const $$findOne = Symbol('find_one')
const $$findMany = Symbol('find_many')
const $$store = Symbol('store')
const $$usedMixins = Symbol('used')
const $$methods = Symbol('methods')
const $$classMethods = Symbol('classMethods')
const $$implementations = Symbol('implementations')
const $$models = Symbol('models')
const $$requirements = Symbol('requirements')
const $$validators = Symbol('validators')

const factory = require('./create')
const EventEmitter = require('./emitter')

function generateMixin (name) {
  let klass = factory(name, function (klass, args) {
    klass[$$constructor].apply(this, args)
    this[$$models] = new Set()
    this.$prepareEmitter()
    klass.$emit('new', this)
  })

  const uniqueKey = Symbol('key')

  Object.defineProperty(klass, '$$uniqueKey', {
    value: uniqueKey,
    __proto__: null
  })

  EventEmitter.mixin(klass, true)
  EventEmitter.mixin(klass)

  klass[$$constructor] = function (data) {
    if (typeof data === 'object') {
      for (let key in data) {
        this[key] = data[key]
      }
    }
  }

  klass[$$attributes] = {}
  klass[$$implementations] = []
  klass[$$derivedProperties] = []
  klass[$$staticProperties] = []
  klass[$$findOne] = []
  klass[$$findMany] = []
  klass[$$store] = []
  klass[$$usedMixins] = []
  klass[$$methods] = {}
  klass[$$classMethods] = {}
  klass[$$requirements] = new Set()
  klass[$$validators] = []

  klass.construct = function (fn) {
    if (fn instanceof Function) {
      klass[$$constructor] = fn
    }
    return klass
  }

  klass.validate = function (fn) {
    if (typeof fn.for === 'function') {
      fn = fn.for()
    }
    this[$$validators].push(fn)
    return klass
  }

  klass.attribute = function (name, type, options) {
    let definition = {}
    if (options != null) {
      Object.assign(definition, options)
      definition.type = type
    } else {
      definition = type
    }
    klass[$$attributes][name] = definition
    return klass
  }

  klass.attributes = function (attributes) {
    if (typeof attributes === 'object') {
      for (const name of Object.keys(attributes)) {
        klass[$$attributes][name] = attributes[name]
      }
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

  klass.classMethod = function (name, fn) {
    if (typeof fn === 'function') {
      klass[$$classMethods][name] = fn
    }
    return klass
  }

  klass.classMethods = function (methods) {
    if (typeof methods === 'object') {
      for (let methodName in methods) {
        klass.classMethod(methodName, methods[methodName])
      }
    }
    return klass
  }

  klass.set = function (item, value) {
    klass[$$staticProperties].push({ item, value })
    return klass
  }

  klass.implement = function (item, priority, fn) {
    klass[$$implementations].push({item, priority, fn})
    return klass
  }

  klass.require = function (protocol) {
    klass[$$requirements].add(protocol)
    return klass
  }

  klass.prototype.augmentModel = function (model) {
    if (!this[$$models].has(model)) {
      augmentWithAttributes(this, model)
      augmentWithValidators(this, model)
      augmentWithDerivedProperties(this, model)
      augmentWithMethods(this, model)
      augmentWithClassMethods(this, model)
      augmentWithMixins(this, model)
      augmentWithProtocolRequirements(this, model)
      augmentWithProtocolValue(this, model)
      augmentWithProtocolImplementations(this, model)
      this[$$models].add(model)
    }
  }

  Object.defineProperty(klass.prototype, 'models', {
    get: function () {
      return this[$$models]
    }
  })

  function augmentWithAttributes (mixin, model) {
    if (Object.keys(klass[$$attributes]).length > 0) {
      model.attributes(klass[$$attributes])
    }
  }

  function augmentWithValidators (mixin, model) {
    for (let validatorFactory of klass[$$validators]) {
      model.validate(function () {
        let validator = validatorFactory()
        validator.mixin = mixin
        return validator
      })
    }
  }

  function augmentWithProtocolImplementations (mixin, model) {
    for (let impl of klass[$$implementations]) {
      let {item, priority, fn} = impl
      if (typeof priority === 'function') {
        fn = priority
        priority = 500
      }
      let newFn = function (...args) {
        return fn.apply(this, [mixin, ...args])
      }
      newFn[Symbol.for('mixin')] = mixin
      model.implement(item, priority, newFn)
    }
  }

  function augmentWithProtocolRequirements (mixin, model) {
    for (let protocol of klass[$$requirements]) {
      protocol.augmentModel(model)
    }
  }

  function augmentWithProtocolValue (mixin, model) {
    for (let staticArg of klass[$$staticProperties]) {
      let { item, value } = staticArg
      model.set(item, value)
    }
  }

  function augmentWithDerivedProperties (mixin, model) {
    for (let derivedArgs of klass[$$derivedProperties]) {
      let { name, options, getter } = derivedArgs
      if (typeof options === 'function') {
        if (typeof getter === 'function') {
          options = options.call(model, mixin)
        } else {
          getter = options
          options = {}
        }
      }
      model.derive(name, options, function (...args) {
        return getter.apply(this, [mixin].concat(args))
      })
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

  function augmentWithClassMethods (mixin, model) {
    for (let methodName in klass[$$classMethods]) {
      let method = klass[$$classMethods][methodName]
      model.classMethod(methodName, function (...args) {
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

const Mixin = function (...args) {
  return generateMixin(...args)
}

class MixinError extends Error {
  constructor (message, mixin) {
    super(message)
    this.mixin = mixin
  }
}
Mixin.Error = MixinError

module.exports = Mixin

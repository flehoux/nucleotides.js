'use strict'

const $$constructor = Symbol('construct')

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

const DerivedProperty = require('./derived')
const factory = require('./create')
const makeEmitter = require('./emitter')

function generateMixin (name) {
  let klass = factory(name, function (klass, args) {
    klass[$$constructor].apply(this, args)
    klass.$emit('new', this)
  })

  const uniqueKey = Symbol('key')

  Object.defineProperty(klass, '$$uniqueKey', {
    value: uniqueKey,
    __proto__: null
  })

  makeEmitter(klass)
  makeEmitter(klass.prototype)

  klass[$$constructor] = function (data) {
    if (typeof data === 'object') {
      for (let key in data) {
        this[key] = data[key]
      }
    }
  }

  klass[$$implementations] = []
  klass[$$derivedProperties] = []
  klass[$$staticProperties] = []
  klass[$$findOne] = []
  klass[$$findMany] = []
  klass[$$store] = []
  klass[$$usedMixins] = []
  klass[$$methods] = {}
  klass[$$classMethods] = {}
  klass[$$models] = new Set()
  klass[$$requirements] = new Set()

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
    if (!klass[$$models].has(model)) {
      augmentWithDerivedProperties(this, model)
      augmentWithMethods(this, model)
      augmentWithClassMethods(this, model)
      augmentWithMixins(this, model)
      augmentWithProtocolRequirements(this, model)
      augmentWithProtocolValue(this, model)
      augmentWithProtocolImplementations(this, model)
      klass[$$models].add(model)
    }
  }

  Object.defineProperty(klass.prototype, 'models', {
    get: function () {
      return this[$$models]
    }
  })

  function augmentWithProtocolImplementations (mixin, model) {
    for (let impl of klass[$$implementations]) {
      let {item, priority, fn} = impl
      if (typeof priority === 'function') {
        fn = priority
        priority = 500
      }
      model.implement(item, priority, function (...args) {
        return fn.call(this, mixin, ...args)
      })
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

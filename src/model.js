'use strict'

const $$constructor = Symbol('construct')
const $$attributes = Symbol('attributes')
const $$data = Symbol('data')
const $$derived = Symbol('derived')
const $$mixins = Symbol('mixins')
const $$isModel = Symbol('isModel')
const $$parents = Symbol('parents')
const $$referenceTracker = Symbol('referenceTracker')
const $$protocols = Symbol.for('protocols')
const $$initializing = Symbol('initializing')
const $$updating = Symbol('updating')
const $$lazyData = Symbol('lazyData')
const $$errors = Symbol('errors')

const Attribute = require('./attribute')
const DerivedValue = require('./derived')
const makeEmitter = require('./emitter')
const factory = require('./create')
const Protocol = require('./protocol')

let Model

class ModelDefinitionException extends Error {
  constructor (code, message, value) {
    super(message)
    this.code = code
    this.value = value
  }
}

function generateModel (name) {
  let klass = factory(name, function (klass, args) {
    this[$$data] = {}
    this[$$errors] = {}
    this[$$parents] = {}
    this[$$referenceTracker] = {}
    this[$$initializing] = true
    klass.$emit('creating', this)
    klass[$$constructor].apply(this, args)
    klass.$emit('new', this)
    this.$on('change', function (diff) {
      for (let parentKey of this.$parents) {
        this[$$parents][parentKey].$childDidChange(this, diff)
      }
    })
    delete this[$$initializing]
  })

  klass[$$attributes] = {}
  klass[$$mixins] = []
  klass[$$derived] = {}
  klass[$$isModel] = true
  klass[$$protocols] = {}

  Object.defineProperties(klass, {
    mixins: {
      value: klass[$$mixins],
      __proto__: null
    },
    List: {
      get: function () {
        return {model: this, collection: 'array'}
      }
    },
    Map: {
      get: function () {
        return {model: this, collection: 'map'}
      }
    }
  })

  Object.defineProperties(klass.prototype, {
    $data: {
      get () {
        return this[$$data]
      }
    },
    $parents: {
      get () {
        return Object.getOwnPropertySymbols(this[$$parents])
      }
    },
    $lazyData: {
      get () {
        if (this[$$lazyData] == null) {
          this[$$lazyData] = {}
        }
        return this[$$lazyData]
      }
    },
    $errorStorage: {
      get () {
        return this[$$errors]
      }
    }
  })

  makeEmitter(klass)
  makeEmitter(klass.prototype)

  klass[$$constructor] = function (data) {
    if (data == null) return

    for (let attributeName in klass[$$attributes]) {
      const attribute = klass[$$attributes][attributeName]
      if (data[attributeName] != null) {
        attribute.maybeUpdateInTarget(this, data[attributeName])
      }
    }
  }

  klass.construct = function (fn) {
    if (fn instanceof Function) {
      klass[$$constructor] = fn
    }
    return klass
  }

  klass.createCollection = function (type, elements) {
    if (typeof type !== 'string') {
      elements = type
      type = 'array'
    }

    if (elements == null) {
      elements = []
    }

    if (typeof elements === 'function') {
      const CollectablePromise = require('./collectable_promise')
      const {resolvePromise, allPromise} = require('..')
      let getter = elements
      let result = getter()
      if (result != null && typeof result.then === 'function') {
        return new CollectablePromise(type, result, this)
      } else if (typeof result.length === 'number' && result[0] && typeof result[0].then === 'function') {
        return new CollectablePromise(type, allPromise(result), this)
      } else {
        return new CollectablePromise(type, resolvePromise(result), this)
      }
    } else if (type === 'array') {
      return require('./collection').ArrayCollection.create(this, ...elements)
    } else if (type === 'map') {
      return require('./collection').MapCollection.create(this, ...elements)
    } else {
      throw new Error("Provided collection type should be either 'array' or 'map'")
    }
  }

  klass.attribute = function (name, type, options) {
    if (type == null && options == null) {
      return klass[$$attributes][name]
    } else {
      if (type != null & type.constructor === Object) {
        type = Object.assign({}, type)
      }
      if (options != null) {
        options = Object.assign({}, options)
      }
      const newAttribute = Attribute.create(name, type, options)
      newAttribute.augmentModel(klass)
      klass[$$attributes][name] = newAttribute
      return klass
    }
  }

  klass.attributes = function (attributes) {
    if (attributes == null) {
      return klass[$$attributes]
    } else {
      for (const name of Object.keys(attributes)) {
        const newAttribute = Attribute.shorthand(name, attributes[name])
        newAttribute.augmentModel(klass)
        klass[$$attributes][name] = newAttribute
      }
      return klass
    }
  }

  klass.derive = function (name, options, getter) {
    const derived = DerivedValue.create(name, options, getter)
    derived.augmentModel(klass)
    klass[$$derived][name] = derived
    return klass
  }

  klass.method = function (name, fn) {
    if (typeof fn === 'function') {
      klass.prototype[name] = fn
    }
    return klass
  }

  klass.methods = function (methods) {
    if (typeof methods === 'object') {
      for (const methodName in methods) {
        klass.method(methodName, methods[methodName])
      }
    }
    return klass
  }

  klass.classMethod = function (name, fn) {
    if (typeof fn === 'function') {
      klass[name] = fn
    }
    return klass
  }

  klass.classMethods = function (methods) {
    if (typeof methods === 'object') {
      for (const methodName in methods) {
        klass.classmethod(methodName, methods[methodName])
      }
    }
    return klass
  }

  klass.use = function (mixin) {
    if (mixin == null) {
      return klass
    }
    const alreadyMixedIn = klass.mixins.some(function (other) {
      return other.constructor.$$uniqueKey === mixin.constructor.$$uniqueKey
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

  klass.set = function (protocolValue, value) {
    Protocol.augmentModelWithValue(klass, protocolValue, value)
    return klass
  }

  klass.add = function (protocolValue, value) {
    if (protocolValue.options.accumulate === true) {
      Protocol.augmentModelWithValue(klass, protocolValue, value)
    }
    return klass
  }

  klass.implement = function (protocolImpl, priority, fun) {
    Protocol.augmentModelWithImplementation(klass, protocolImpl, priority, fun)
    return klass
  }

  klass.implements = function (protocolImpl) {
    const {symbol, protocol, key} = protocolImpl
    if (this.hasOwnProperty(symbol)) {
      return protocol.hasImplementationsFor(this, key)
    }
    return false
  }

  klass.hasValue = function (protocolImpl) {
    const {symbol, protocol, key} = protocolImpl
    if (this.hasOwnProperty(symbol)) {
      return protocol.hasValueFor(this, key)
    }
    return false
  }

  klass.derive('$clean', {cached: true}, function () {
    const data = {}
    for (let attributeName in klass[$$attributes]) {
      data[attributeName] = klass[$$attributes][attributeName].getEncodedValue(this)
    }
    return data
  })

  klass.derive('$errors', {cached: true, source: []}, function () {
    const data = {}
    for (let attributeName in klass[$$attributes]) {
      let errors = klass[$$attributes][attributeName].errorsOf(this)
      if (errors != null && errors.length > 0) {
        data[attributeName] = errors.slice(0)
      }
    }
    return data
  })

  klass.derive('$valid', function () {
    return Object.keys(this.$errors).length === 0
  })

  Object.assign(klass.prototype, {
    $updateAttributes (data, options) {
      if (Model.isInstance(data)) {
        data = data.$clean
      }
      const difference = {}
      this[$$updating] = true
      for (const attributeName in data) {
        if (attributeName in klass.attributes()) {
          const attribute = klass.attribute(attributeName)
          if (attribute.maybeUpdateInTarget(this, data[attributeName], options)) {
            difference[attributeName] = this[attributeName]
          }
        }
      }
      delete this[$$updating]
      if (Object.keys(difference).length > 0) {
        this.$didChange(difference, options)
      }
      return this
    },

    $whileInitializing (cb) {
      this[$$initializing] = true
      cb()
      delete this[$$initializing]
    },

    $ensure (...names) {
      const promises = []
      for (name of names) {
        const derived = klass[$$derived][name]
        if (derived == null || !(derived instanceof DerivedValue.Async)) {
          throw new Error(`$ensure was called for a property that wasn't an async derived value: ${name}`)
        }
        if (!derived.fetched(this)) {
          promises.push(derived.ensure(this))
        }
      }
      const {allPromise, resolvePromise} = require('..')
      if (promises.length > 0) {
        return allPromise(promises).then(() => this)
      } else {
        return resolvePromise(this)
      }
    },

    $force (name, value) {
      const derived = klass[$$derived][name]
      if (derived == null || !(derived instanceof DerivedValue.Async)) {
        throw new Error(`$force was called for a property that wasn't an async derived value: ${name}`)
      }
      derived.force(this, value)
    },

    $invalidate (name) {
      const derived = klass[$$derived][name]
      if (derived == null || !(derived instanceof DerivedValue.Async || derived instanceof DerivedValue.Cached)) {
        throw new Error(`$invalidate was called for a property that wasn't a cached derived value: ${name}`)
      }
      derived.clearCache(this)
    },

    $clone (isNew = false) {
      let obj = Reflect.construct(klass, [this.$clean])
      if ('$isNew' in obj) {
        obj.$isNew = isNew
      }
      return obj
    },

    $setTracker (name, symbol) {
      this[$$referenceTracker][name] = symbol
      this[$$referenceTracker][symbol] = name
    },

    $tracker (ref) {
      if (typeof ref === 'string' || typeof ref === 'symbol') {
        return this[$$referenceTracker][ref]
      }
    },

    $addParent (parent, key) {
      const newInParent = !this[$$parents].hasOwnProperty(key)
      this[$$parents][key] = parent
      if (newInParent) {
        this.$emit('addedInObject', parent)
      }
      this.$parent = parent
    },

    $removeParent (parent, key) {
      const existedInParent = this[$$parents].hasOwnProperty(key)
      delete this[$$parents][key]
      if (existedInParent) {
        this.$emit('removedFromObject', parent)
      }
      if (this.$parent === parent) {
        delete this.$parent
      }
    },

    $childDidChange (child, diff, options) {
      for (const attributeName in klass.attributes()) {
        const attribute = klass.attribute(attributeName)
        if (Model.isModel(attribute.baseType, child) && attribute.constainsModelInstance(this, child)) {
          this.$didChange({[attribute.name]: diff}, options)
        }
      }
    },

    $didChange (difference, options) {
      if (this[$$initializing] === true || this[$$updating] === true) return
      this.$emit('change', difference, options)
      klass.$emit('change', this, difference, options)
    }
  })

  return klass
}

Model = function (...args) {
  return generateModel(...args)
}

Object.defineProperties(Model, {
  DefinitionException: {
    value: ModelDefinitionException,
    __proto__: null
  },
  isModel: {
    value: function (object) {
      return (object != null) && object.hasOwnProperty($$isModel)
    },
    __proto__: null
  },
  isInstance: {
    value: function (object, model) {
      if (model == null) {
        return (object != null) && this.isModel(object.constructor)
      } else {
        return object instanceof model
      }
    },
    __proto__: null
  }
})

module.exports = Model

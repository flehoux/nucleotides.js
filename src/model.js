'use strict'

const $$constructor = Symbol('construct')
const $$attributes = Symbol('attributes')
const $$data = Symbol('data')
const $$derived = Symbol('derived')
const $$mixins = Symbol('mixins')
const $$isModel = Symbol('isModel')
const $$parent = Symbol('parent')
const $$collection = Symbol('collection')
const $$referenceTracker = Symbol('referenceTracker')
const $$protocols = Symbol.for('protocols')
const $$lazyData = Symbol('lazyData')
const $$cachedClean = Symbol('cachedClean')
const $$changed = Symbol('changed')
const $$parentLocation = Symbol('parentLocation')
const $$validators = Symbol('validators')

const Attribute = require('./attribute')
const DerivedValue = require('./derived')
const EventEmitter = require('./emitter')
const TransactionManager = require('./transaction')
const factory = require('./create')
const Protocol = require('./protocol')
const deepDiff = require('deep-diff')

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
    TransactionManager.call(this)
    this.constructor = klass
    this[$$data] = {}
    this[$$validators] = []

    for (let validatorFactory of klass[$$validators]) {
      this[$$validators].push(validatorFactory())
    }
    this[$$referenceTracker] = {}
    this.$destroy = this.$destroy.bind(this)
    return this.$performInTransaction({constructing: true}, () =>
      klass[$$constructor].apply(this, args)
    )
  })

  klass.prototype = new TransactionManager()

  klass[$$attributes] = {}
  klass[$$mixins] = []
  klass[$$derived] = {}
  klass[$$isModel] = true
  klass[$$protocols] = {}
  klass[$$validators] = []

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
    $lazyData: {
      get () {
        if (this[$$lazyData] == null) {
          this[$$lazyData] = {}
        }
        return this[$$lazyData]
      }
    },
    $parent: {
      get () { return this[$$parent] }
    },
    $collection: {
      get () { return this[$$collection] }
    }
  })

  EventEmitter.mixin(klass, true)

  klass[$$constructor] = function (data) {
    if (data == null) return

    for (let attributeName in klass[$$attributes]) {
      const attribute = klass[$$attributes][attributeName]
      if (data[attributeName] != null) {
        attribute.setInitialValue(this, data[attributeName])
      }
    }
  }

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

  klass.derive('$clean', {cached: true, source: 'manual'}, function () {
    const data = {}
    for (let attributeName in klass[$$attributes]) {
      data[attributeName] = klass[$$attributes][attributeName].getEncodedValue(this)
    }
    return data
  })

  const issuesAccessor = function (prop, level) {
    let key = Symbol(prop)
    return function () {
      if (!this[key]) {
        if (this.$forked) {
          this[key] = Object.create(this.$original[prop], {})
        } else {
          this[key] = {}
        }
      } else {
        for (let path in this[key]) {
          delete this[key][path]
        }
      }
      let newIssues = require('./validator').summarize(this, this[$$validators], level)
      Object.assign(this[key], newIssues)
      return this[key]
    }
  }

  klass.derive('$errors', {cached: true, source: 'manual'}, issuesAccessor('$errors', Symbol.for('error')))
  klass.derive('$warnings', {cached: true, source: 'manual'}, issuesAccessor('$warnings', Symbol.for('warning')))
  klass.derive('$notices', {cached: true, source: 'manual'}, issuesAccessor('$notices', Symbol.for('notice')))

  klass.derive('$valid', function () { return Object.keys(this.$errors).length === 0 })

  Object.assign(klass.prototype, {
    $updateAttributes (data, options) {
      if (Model.isInstance(data)) {
        data = data.$clean
      }
      this.$performInTransaction(() => {
        for (const attributeName in data) {
          if (attributeName in klass.attributes()) {
            klass.attribute(attributeName)
              .updateValue(this, data[attributeName], options)
          }
        }
      })
      return this
    },

    $beforeTransaction (tx) {
      if (tx.constructing) {
        this[$$cachedClean] = {}
        this.constructor.$emit('creating', this)
      } else {
        this[$$cachedClean] = this.$clean
      }
      if (this.$parent != null) {
        tx.attach(this.$parent.$pushTransaction())
      }
      this[$$changed] = new Set()
      TransactionManager.prototype.$beforeTransaction.call(this, tx)
    },

    $afterTransaction (tx) {
      let difference
      if (this[$$changed] != null) {
        if (this[$$changed].size > 0) {
          this.$invalidate('$clean')
          difference = deepDiff.diff(this[$$cachedClean], this.$clean) || []
          Object.defineProperty(difference, 'keys', {
            configurable: false,
            enumerable: false,
            value: new Set(difference.map((diff) => diff.path[0]))
          })
          for (let derivedName in this.constructor[$$derived]) {
            this.constructor[$$derived][derivedName].maybeUpdate(this.constructor, this, difference)
          }
          if (!tx.constructing) {
            this.constructor.$emit('update', this, difference)
            this.$emit('update', difference)
            this.$validate(this[$$changed])
          }
        }
        if (tx.constructing) {
          this.constructor.$emit('new', this)
          this.$validate(this[$$changed], null, true)
        }
        delete this[$$changed]
      }
      TransactionManager.prototype.$afterTransaction.call(this, tx, difference)
    },

    $validate (keys, data, constructing = false) {
      let promises = []
      const {allPromise} = require('..')

      if (keys instanceof Array) {
        keys = new Set(keys)
      } else if (!(keys instanceof Set)) {
        keys = new Set([keys])
      }

      for (let validator of this[$$validators]) {
        if ((constructing && validator.shouldValidateAtCreation) || validator.shouldValidate(keys)) {
          promises.push(validator.runValidation(this, data))
        }
      }

      return allPromise(promises).then((result) => {
        let union = new Set()
        for (let set of result) {
          for (let level of set) {
            union.add(level)
          }
        }
        if (union.has(Symbol.for('error'))) {
          this.$invalidate('$errors')
        }
        if (union.has(Symbol.for('warning'))) {
          this.$invalidate('$warnings')
        }
        if (union.has(Symbol.for('notice'))) {
          this.$invalidate('$notices')
        }
      })
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
      if (derived == null || !(derived instanceof DerivedValue.Cached)) {
        throw new Error(`$force was called for a property that wasn't an async derived value: ${name}`)
      }
      derived.force(this, value)
    },

    $invalidate (name) {
      const derived = klass[$$derived][name]
      if (derived == null || !(derived instanceof DerivedValue.Cached)) {
        throw new Error(`$invalidate was called for a property that wasn't a cached derived value: ${name}`)
      }
      derived.clearCache(this)
    },

    $clear (name) {
      const derived = klass[$$derived][name]
      if (derived == null || !(derived instanceof DerivedValue.Cached)) {
        throw new Error(`$clear was called for a property that wasn't a cached derived value: ${name}`)
      }
      derived.clearCache(this, false)
    },

    $clone (isNew) {
      let obj = Reflect.construct(klass, [this.$clean])
      if ('$isNew' in obj) {
        if (isNew != null) {
          obj.$isNew = isNew
        } else {
          obj.$isNew = this.$isNew
        }
      }
      return obj
    },

    $setParent (parent, name) {
      if (this[$$parent] == null) {
        this[$$parent] = parent
        this[$$parentLocation] = name
        parent.$on('destroy', this.$destroy)
      } else if (this[$$parent] !== parent) {
        throw new Model.AncestryError('Cannot change an object\'s parent')
      }
    },

    $addToCollection (collection) {
      if (this[$$collection] == null) {
        this[$$collection] = collection
        collection.$on('destroy', this.$destroy)
      } else if (this[$$collection] !== collection) {
        throw new Error('Cannot change an object\'s containing collection')
      }
      if (collection.$parent) {
        this.$setParent(collection.$parent)
      }
    },

    $didChange (name) {
      this[$$changed].add(name)
      if (this.$collection != null) {
        this.$collection.$emit('update', this)
      } else if (this.$parent) {
        this.$parent.$didChange(this[$$parentLocation])
      }
    },

    $destroy () {
      if (this[$$collection]) {
        this[$$collection].$off('destroy', this.$destroy)
        delete this[$$collection]
      }
      if (this[$$parent]) {
        this[$$parent].$off('destroy', this.$destroy)
        delete this[$$parent]
      }
      this.$emit('destroy')
      this.$off()
    }
  })

  return klass
}

Model = function (...args) {
  return generateModel(...args)
}

Model.AncestryError = class AncestryError extends Error {}

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

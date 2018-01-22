'use strict'

const $$protocols = Symbol.for('protocols')
const $$delegates = Symbol.for('delegates')

const $$constructor = Symbol('construct')
const $$attributes = Symbol('attributes')
const $$data = Symbol('data')
const $$derived = Symbol('derived')
const $$mixins = Symbol('mixins')
const $$isModel = Symbol('isModel')
const $$parent = Symbol('parent')
const $$collection = Symbol('collection')
const $$referenceTracker = Symbol('referenceTracker')
const $$lazyData = Symbol('lazyData')
const $$changed = Symbol('changed')
const $$parentLocation = Symbol('parentLocation')
const $$validators = Symbol('validators')
const $$tracking = Symbol('tracking')
const $$validating = Symbol('validating')

const Attribute = require('./attribute')
const DerivedValue = require('./derived')
const EventEmitter = require('./emitter')
const TransactionManager = require('./transaction')
const factory = require('./create')
const Protocol = require('./protocol')
const Difference = require('./difference')

let Model

class ModelDefinitionException extends Error {
  constructor (code, message, value) {
    super(message)
    this.code = code
    this.value = value
  }
}

let isArray = (!Array.isArray) ? function (arg) {
  return Object.prototype.toString.call(arg) === '[object Array]'
} : Array.isArray.bind(Array)

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
  klass[$$delegates] = {}

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
    this.$setInitialAttributes(data)
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
    if (isArray(protocolValue)) {
      for (let _protocolValue of protocolValue) {
        Protocol.augmentModelWithValue(klass, _protocolValue, value)
      }
    } else {
      Protocol.augmentModelWithValue(klass, protocolValue, value)
    }
    return klass
  }

  klass.add = function (protocolValue, value) {
    if (isArray(protocolValue)) {
      for (let _protocolValue of protocolValue) {
        this.add(_protocolValue, value)
      }
    } else {
      if (protocolValue.options.accumulate === true) {
        Protocol.augmentModelWithValue(klass, protocolValue, value)
      }
    }
    return klass
  }

  klass.delegate = function (protocol, getter) {
    if (isArray(protocol)) {
      for (let _protocol of protocol) {
        _protocol.delegateOnModel(this, getter)
      }
    } else {
      protocol.delegateOnModel(this, getter)
    }
    return klass
  }

  klass.proxy = function (key, getter) {
    if (typeof getter === 'string') {
      Object.defineProperty(klass.prototype, key, {
        get () {
          return this[getter][key]
        },
        set (value) {
          this[getter][key] = value
        },
        enumerable: true
      })
    } else if (typeof getter === 'function') {
      Object.defineProperty(klass.prototype, key, {
        get () {
          return getter.call(this)[key]
        },
        set (value) {
          let target = getter.call(this)
          target[key] = value
        },
        enumerable: true
      })
    }
    return klass
  }

  klass.implement = function (protocolImpl, priority, fun) {
    if (isArray(protocolImpl)) {
      for (let _protocolImpl of protocolImpl) {
        Protocol.augmentModelWithImplementation(klass, _protocolImpl, priority, fun)
      }
    } else {
      Protocol.augmentModelWithImplementation(klass, protocolImpl, priority, fun)
    }
    return klass
  }

  klass.implements = function (protocolImpl) {
    const {protocol, key} = protocolImpl
    return protocol.hasImplementationsFor(this, key)
  }

  klass.hasValue = function (protocolImpl) {
    const {protocol, key} = protocolImpl
    return protocol.hasValueFor(this, key)
  }

  klass.derive('$clean', function () {
    this.$startTracking()
    if (this.$difference != null) {
      return this.$difference.$currentData
    } else {
      return {}
    }
  })

  klass.derive('$isPristine', function () {
    if (this.$difference != null) {
      return this.$difference.$isPristine
    } else {
      return true
    }
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
    $setInitialAttributes (data) {
      for (let attributeName in klass[$$attributes]) {
        const attribute = klass[$$attributes][attributeName]
        if (data[attributeName] != null) {
          attribute.setInitialValue(this, data[attributeName])
        }
      }
    },

    $startTracking () {
      if (!this[$$tracking]) {
        this[$$tracking] = true
        Object.defineProperty(this, '$difference', {value: new Difference(this)})
      }
    },

    $startValidating () {
      this[$$validating] = true
      this.$startTracking()
      this.$validate(new Set(Object.keys(this.constructor.attributes())), null, true)
      this.constructor.$emit('startValidating', this)
      this.$emit('startValidating')
    },

    $updateAttributes (data, options) {
      if (Model.isInstance(data)) {
        data = data.$clean
      }
      this.$performInTransaction(() => {
        for (const attributeName in data) {
          if (attributeName in klass.attributes()) {
            klass.attribute(attributeName).updateValue(this, data[attributeName], options)
          }
        }
      })
      return this
    },

    $beforeTransaction (tx) {
      if (tx.constructing) {
        this.constructor.$emit('creating', this)
      }
      if (this.$parent != null) {
        tx.attach(this.$parent.$pushTransaction())
      }
      this[$$changed] = new Set()
      TransactionManager.prototype.$beforeTransaction.call(this, tx)
    },

    $afterTransaction (tx) {
      let changeset
      if (this[$$changed] != null) {
        if (this[$$changed].size > 0 && !tx.constructing) {
          this.$startTracking()
          changeset = this.$difference.$compare()
          if (changeset.$size > 0) {
            for (let derivedName in this.constructor[$$derived]) {
              this.constructor[$$derived][derivedName].maybeUpdate(this.constructor, this, changeset)
            }
            this.constructor.$emit('update', this, changeset)
            this.$emit('update', changeset)
            this.$validate(this[$$changed])
          }
        }
        if (tx.constructing) {
          this.constructor.$emit('new', this)
        }
        delete this[$$changed]
      }
      TransactionManager.prototype.$afterTransaction.call(this, tx, changeset)
    },

    $validate (keys, data, constructing = false) {
      let promises = []
      const {allPromise} = require('..')

      if (keys instanceof Array) {
        keys = new Set(keys)
      } else if (!(keys instanceof Set)) {
        keys = new Set([keys])
      }

      let shouldWait = false
      for (let validator of this[$$validators]) {
        if ((constructing && validator.shouldValidateAtCreation) || validator.shouldValidate(keys)) {
          shouldWait = true
          promises.push(validator.runValidation(this, data))
        }
      }

      if (!shouldWait) {
        return Promise.resolve(null)
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

    $invalidate (...names) {
      for (let name of names) {
        const derived = klass[$$derived][name]
        if (derived == null || !(derived instanceof DerivedValue.Cached)) {
          throw new Error(`$invalidate was called for a property that wasn't a cached derived value: ${name}`)
        }
        derived.clearCache(this)
      }
    },

    $clear (...names) {
      for (let name of names) {
        const derived = klass[$$derived][name]
        if (derived == null || !(derived instanceof DerivedValue.Cached)) {
          throw new Error(`$clear was called for a property that wasn't a cached derived value: ${name}`)
        }
        derived.clearCache(this, false)
      }
    },

    $clone (isNew) {
      let obj = Reflect.construct(klass, [this.$clean])
      let {Cached: CachedDerivedValue} = require('./derived')
      for (let name in klass[$$derived]) {
        let derived = klass[$$derived][name]
        if (derived instanceof CachedDerivedValue) {
          let value = this[derived.$$cache]
          if (Model.isInstance(value)) {
            derived.force(obj, value.$clone())
          } else if (value != null) {
            derived.force(obj, value)
          }
        }
      }
      if ('$isNew' in obj) {
        if (isNew != null) {
          obj.$isNew = isNew
        } else {
          obj.$isNew = this.$isNew
        }
      }
      if (this[$$tracking]) {
        obj.$startTracking()
      }
      if (this[$$validating]) {
        obj.$startValidating()
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

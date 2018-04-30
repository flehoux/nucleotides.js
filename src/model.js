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
const $$lazyData = Symbol('lazyData')
const $$changed = Symbol('changed')
const $$parentLocation = Symbol('parentLocation')
const $$validators = Symbol('validators')
const $$tracking = Symbol('tracking')
const $$validating = Symbol('validating')
const $$selfPromise = Symbol('self')

const Attribute = require('./attribute')
const DerivedValue = require('./derived')
const EventEmitter = require('./emitter')
const TransactionManager = require('./transaction')
const factory = require('./create')
const Protocol = require('./protocol')
const Difference = require('./difference')
const Mountable = require('./mixins/mountable')

let Model

class ModelDefinitionException extends Error {
  constructor (code, message, value) {
    super(message)
    this.code = code
    this.value = value
  }
}

const nestedEnsure = function (part, context) {
  const {resolvePromise} = require('..')
  if (context != null) {
    return context.$ensure(part).then(() => context[part])
  } else {
    return resolvePromise(null)
  }
}

let isArray = (!Array.isArray) ? function (arg) {
  return Object.prototype.toString.call(arg) === '[object Array]'
} : Array.isArray.bind(Array)

function generateModel (name) {
  const ValidationSummary = require('./validators/summary')

  let klass = factory(name, function (klass, args) {
    TransactionManager.call(this)
    this.constructor = klass

    this[$$data] = {}
    this.$destroy = this.$destroy.bind(this)

    return this.$performInTransaction({constructing: true}, () => {
      let arg0 = args[0]
      let returned
      if (arg0 && typeof arg0[$$constructor] === 'function') {
        const {args, [$$constructor]: ctor} = arg0
        returned = ctor.apply(this, args)
      } else {
        returned = klass[$$constructor].apply(this, args)
      }
      this.$startTracking()
      return returned
    })
  })

  klass.prototype = new TransactionManager()
  Mountable(klass)

  klass.initializer = function (initFn) {
    return function (...args) {
      return Reflect.construct(klass, [{[$$constructor]: initFn, args}])
    }
  }

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
      get () {
        return {model: this, collection: 'array'}
      }
    },
    Map: {
      get () {
        return {model: this, collection: 'map'}
      }
    },
    $validators: {
      get () {
        return klass[$$validators]
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
    },
    $selfPromise: {
      get () {
        if (this[$$selfPromise] == null) {
          this[$$selfPromise] = require('..').resolvePromise(this)
        }
        return this[$$selfPromise]
      }
    },
    $validators: {
      get () {
        return this[$$validators]
      }
    },
    $isValidating: {
      get () {
        return this[$$validating]
      }
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

  klass.hasAttribute = function (name) {
    return klass[$$attributes][name]
  }

  klass.derive = function (name, options, getter) {
    const derived = DerivedValue.create(name, options, getter)
    derived.augmentModel(klass)
    klass[$$derived][name] = derived
    return klass
  }

  klass.derived = function () {
    return klass[$$derived]
  }

  klass.hasDerived = function (name) {
    return klass[$$derived][name]
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

  klass.method('$rollback', function (setPristine = false) {
    if (!this.$isPristine) {
      let changeset = this.$difference.$getRevertChangeSet()
      changeset.$applyToObject(this)
      if (setPristine) {
        this.$setPristine()
      }
    }
    return this
  })

  klass.method('$setPristine', function (mixin) {
    if (!this.$isPristine) {
      this.$difference.$setPristine()
    }
    return this
  })

  ValidationSummary.extendModel(klass, '$errors', Symbol.for('error'))
  ValidationSummary.extendModel(klass, '$warnings', Symbol.for('warning'))
  ValidationSummary.extendModel(klass, '$notices', Symbol.for('notice'))

  klass.derive('$valid', function () { return this.$errors.$length === 0 })

  const cloneFn = klass.initializer(function (base, isNew) {
    for (let name in klass[$$attributes]) {
      klass.attribute(name).clone(base, this)
    }

    let {Cached: CachedDerivedValue} = require('./derived')
    for (let name in klass[$$derived]) {
      let derived = klass[$$derived][name]
      if (derived instanceof CachedDerivedValue && derived.options.clone !== false) {
        let value = base[derived.$$cache]
        if (Model.isInstance(value)) {
          derived.force(this, value.$clone())
        } else if (value != null) {
          derived.force(this, value)
        }
      }
    }
    if ('$isNew' in this) {
      if (isNew != null) {
        this.$isNew = isNew
      } else {
        this.$isNew = base.$isNew
      }
    }
    this.$setPristine()
    if (base[$$validating]) {
      this.$startValidating()
    }
  })

  klass.prototype.$clone = function (isNew) {
    return cloneFn(this, isNew)
  }

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
      if (this[$$validating]) return

      this[$$validators] = []
      this[$$validating] = true

      for (let validatorFactory of klass[$$validators]) {
        this[$$validators].push(validatorFactory())
      }

      this.$startTracking()
      this.$validate(new Set(Object.keys(this.constructor.attributes())), null, true)
      this.constructor.$emit('startValidating', this)
      this.$emit('startValidating')
    },

    $updateAttributes (data, options = {}) {
      if (Model.isInstance(data)) {
        data = data.$clean
      }
      this.$performInTransaction(() => {
        if ('isNew' in options && options.isNew != null) {
          this.$isNew = options.isNew
        }

        for (const attributeName in data) {
          if (klass.hasAttribute(attributeName)) {
            klass.attribute(attributeName).updateValue(this, data[attributeName], options)
          }
          if (options.force === true) {
            this.$didChange(attributeName)
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

    $invalidateDerivedValues (changeset, derivedValues = []) {
      let invalidated = []
      for (let derivedName in this.constructor[$$derived]) {
        let derivedValue = this.constructor[$$derived][derivedName]
        if (derivedValue.shouldUpdate(this.constructor, this, changeset)) {
          if (derivedValues.indexOf(derivedValue) === -1) {
            invalidated.push(derivedValue)
            changeset.$keys.add(derivedName)
          }
        }
      }
      if (invalidated.length !== 0) {
        derivedValues.push(...invalidated)
        this.$invalidateDerivedValues(changeset, derivedValues)
      } else {
        for (let derivedValue of derivedValues) {
          derivedValue.update(this, changeset)
        }
      }
    },

    $afterTransaction (tx) {
      let changeset
      if (this[$$changed] != null) {
        if (this[$$changed].size > 0 && !tx.constructing) {
          changeset = this.$difference.$compare(this[$$changed])
          if (changeset.$size > 0) {
            this.$invalidateDerivedValues(changeset, [])
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
      this.$startValidating()

      if (isArray(keys)) {
        keys = new Set(keys)
      } else if (!(keys instanceof Set)) {
        keys = new Set([keys])
      }

      for (let validator of this[$$validators]) {
        if ((constructing && validator.shouldValidateAtCreation) ||
            validator.shouldValidate(keys) ||
            keys.has(validator.constructor)) {
          promises.push(validator.runValidation(this, data))
        }
      }

      if (promises.length === 0) {
        return this.$selfPromise
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
        return this
      })
    },

    $ensure (...names) {
      const {allPromise} = require('..')
      const get = require('lodash.get')
      const promises = []

      for (name of names) {
        let promise
        if (isArray(name)) {
          for (let part of name) {
            if (promise != null) {
              promise = promise.then(nestedEnsure.bind(this, part))
            } else {
              promise = nestedEnsure(part, this)
            }
          }
        } else {
          const derived = klass[$$derived][name]
          if (derived == null) {
            if (typeof name === 'string' && name.indexOf('.') !== -1) {
              let value = get(this, name)
              if (value != null) {
                promise = this.$selfPromise
              } else {
                let symbol = Symbol.for(`Promise:${name}`)
                if (this[symbol] == null) {
                  this[symbol] = this.$ensure(name.split('.')).then(() => {
                    delete this[symbol]
                    return this
                  })
                }
                promise = this[symbol]
              }
            } else if (!(derived instanceof DerivedValue.Async)) {
              throw new Error(`$ensure was called for a property that wasn't an async derived value: ${name.toString()}`)
            }
          } else if (!(derived instanceof DerivedValue.Async)) {
            throw new Error(`$ensure was called for a property that wasn't an async derived value: ${name.toString()}`)
          } else {
            promise = derived.ensure(this)
          }
        }
        if (promise != null) {
          promises.push(promise)
        }
      }
      if (promises.length === 0) {
        return this.$selfPromise
      }
      if (promises.length === 1) {
        return promises[0]
      }
      return allPromise(promises).then(() => this)
    },

    $force (name, value) {
      const derived = klass[$$derived][name]
      if (derived == null || !(derived instanceof DerivedValue.Cached)) {
        throw new Error(`$force was called for a property that wasn't an cached derived value: ${name}`)
      }
      derived.force(this, value)
    },

    $invalidate (...names) {
      const {allPromise} = require('..')
      const promises = []

      for (let name of names) {
        const derived = klass[$$derived][name]
        if (derived == null || !(derived instanceof DerivedValue.Cached)) {
          throw new Error(`$invalidate was called for a property that wasn't a cached derived value: ${name}`)
        }
        derived.clearCache(this, true)
        if (derived instanceof DerivedValue.Async) {
          promises.push(derived.ensure(this))
        }
      }

      if (promises.length === 0) {
        return this.$selfPromise
      }
      return allPromise(promises).then(() => this)
    },

    $clear (...names) {
      for (let name of names) {
        const derived = klass[$$derived][name]
        if (derived == null || !(derived instanceof DerivedValue.Cached)) {
          throw new Error(`$clear was called for a property that wasn't a cached derived value: ${name}`)
        }
        derived.clearCache(this)
      }
    },

    $setParent (parent, name, optional = false) {
      if (this[$$parent] == null) {
        this[$$parent] = parent
        this[$$parentLocation] = name
        parent.$on('destroy', this.$destroy)
        if (parent.$mounted) {
          this.$mount()
        }
      } else if (!optional && this[$$parent] !== parent) {
        throw new Model.AncestryError('Cannot change an object\'s parent')
      }
    },

    $unsetParent () {
      if (this[$$parent] != null) {
        this[$$parent].$off('destroy', this.$destroy)
        delete this[$$parent]
        delete this[$$parentLocation]
        return true
      }
    },

    $removeFromParent (parent) {
      if (this[$$parent] === parent) {
        this.$unsetParent()
        this.$destroy()
      }
    },

    $addToCollection (collection) {
      if (this[$$collection] != null && this[$$collection] !== collection) {
        console.warn('Changing an object\'s containing collection')
        this.$removeFromCollection()
      }
      this[$$collection] = collection
      if (collection.$mounted) {
        this.$mount()
      }
      collection.$on('destroy', this.$destroy)
      if (collection.$parent) {
        this.$setParent(collection.$parent)
      }
    },

    $removeFromCollection () {
      if (this[$$collection] != null) {
        if (this[$$collection].$parent != null) {
          this.$unsetParent(this[$$collection].$parent)
        }
        if (this[$$collection].$mounted) {
          this.$unmount()
        }
        this[$$collection].$off('destroy', this.$destroy)
        delete this[$$collection]
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

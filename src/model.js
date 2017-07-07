'use strict'

const $$constructor = Symbol('construct')
const $$attributes = Symbol('attributes')
const $$data = Symbol('data')
const $$mixins = Symbol('mixins')
const $$isModel = Symbol('isModel')
const $$parents = Symbol('parents')
const $$referenceTracker = Symbol('referenceTracker')
const $$priority = Symbol.for('priority')

const Attribute = require('./attribute')
const DerivedProperty = require('./derived')
const makeEmitter = require('./emitter')
const Storage = require('./storage')

let Model

function ModelDefinitionException (code, message, value) {
  this.code = code
  this.message = message
  this.value = value
}

ModelDefinitionException.prototype = Object.create(Error.prototype)
ModelDefinitionException.prototype.constructor = ModelDefinitionException

function generateModel (name) {
  let klass = require('./create')(name, function (klass, args) {
    this[$$data] = {}
    this[$$parents] = {}
    this[$$referenceTracker] = {}

    klass.$emit('creating', this)
    klass[$$constructor].apply(this, args)
    klass.$emit('new', this)
    this.$on('change', function (diff) {
      for (let parentKey of this.$parents) {
        this[$$parents][parentKey].$childDidChange(this, diff)
      }
    })
  })

  klass[$$attributes] = {}
  klass[$$mixins] = []
  klass[$$isModel] = true

  Object.defineProperties(klass, {
    mixins: {
      value: klass[$$mixins],
      __proto__: null
    }
  })

  Object.defineProperties(klass.prototype, {
    $data: {
      get: function () {
        return this[$$data]
      }
    },
    $parents: {
      get: function () {
        return Object.getOwnPropertySymbols(this[$$parents])
      }
    }
  })

  makeEmitter(klass)
  makeEmitter(klass.prototype)

  klass[$$constructor] = function (data) {
    if (data == null) return

    for (let attributeName in klass[$$attributes]) {
      let attribute = klass[$$attributes][attributeName]
      if (data[attributeName] != null) {
        attribute.updateInTarget(this, data[attributeName])
      }
    }
  }

  klass.construct = function (fn) {
    if (fn instanceof Function) {
      klass[$$constructor] = fn
    }
    return klass
  }

  klass.attribute = function (name, type, options) {
    if (type == null && options == null) {
      return klass[$$attributes][name]
    } else {
      const newAttribute = new Attribute(name, type, options)
      newAttribute.augmentModel(klass)
      klass[$$attributes][name] = newAttribute
      return klass
    }
  }

  klass.attributes = function (attributes) {
    if (attributes == null) {
      return klass[$$attributes]
    } else {
      for (let name of Object.keys(attributes)) {
        let newAttribute = Attribute.shorthand(name, attributes[name])
        newAttribute.augmentModel(klass)
        klass[$$attributes][name] = newAttribute
      }
      return klass
    }
  }

  klass.derive = function (name, options, getter) {
    let derived = new DerivedProperty(name, options, getter)
    derived.augmentModel(klass)
    return klass
  }

  klass.set = function (name, value) {
    Object.defineProperty(klass, name, {value: value, __proto__: null})
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
      for (let methodName in methods) {
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
      for (let methodName in methods) {
        klass.classmethod(methodName, methods[methodName])
      }
    }
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

  klass.implement = function (operation, priority, fun) {
    if (Storage.$$operations.indexOf(operation) >= 0) {
      if (typeof priority === 'function') {
        fun = priority
        priority = fun[$$priority] || Storage.MEDIUM
      }
      if (typeof fun === 'function') {
        fun[$$priority] = priority
        if (!klass[operation]) {
          klass[operation] = [fun]
          Storage.augmentModel(klass, operation)
        } else {
          klass[operation].push(fun)
          klass[operation].sort((a, b) => b[$$priority] - a[$$priority])
        }
      }
    } else {
      if (typeof priority === 'function') {
        fun = priority
      }
      klass[operation] = fun
    }
    return klass
  }

  klass.derive('$clean', {cache: true}, function () {
    let data = {}
    for (let key in this.$data) {
      let value = this.$data[key]
      if (Model.isInstance(value)) {
        data[key] = value.$clean
      } else {
        data[key] = value
      }
    }
    return data
  })

  klass.prototype.$updateAttributes = function (data) {
    let difference = {}
    for (let attributeName in data) {
      if (attributeName in klass.attributes()) {
        let attribute = klass.attribute(attributeName)
        if (attribute.updateInTarget(this, data[attributeName])) {
          difference[attributeName] = this[attributeName]
        }
      }
    }
    if (Object.keys(difference).length > 0) {
      this.$didChange(difference)
    }
  }

  klass.prototype.$setTracker = function (name, symbol) {
    this[$$referenceTracker][name] = symbol
    this[$$referenceTracker][symbol] = name
  }

  klass.prototype.$tracker = function (ref) {
    if (typeof ref === 'string') {
      return this[$$referenceTracker][ref]
    } else if (typeof ref === 'symbol') {
      return this[$$referenceTracker][ref]
    }
  }

  klass.prototype.$addParent = function (parent, key) {
    let newInParent = !this[$$parents].hasOwnProperty(key)
    this[$$parents][key] = parent
    if (newInParent) {
      this.$emit('addedInObject', parent)
    }
  }

  klass.prototype.$removeParent = function (parent, key) {
    let existedInParent = this[$$parents].hasOwnProperty(key)
    delete this[$$parents][key]
    if (existedInParent) {
      this.$emit('removedFromObject', parent)
    }
  }

  klass.prototype.$childDidChange = function (child, diff) {
    for (let attributeName in klass.attributes()) {
      let attribute = klass.attribute(attributeName)
      if (Model.isModel(attribute.baseType, child) && attribute.constainsModelInstance(this, child)) {
        this.$didChange({[attribute.name]: diff})
      }
    }
  }

  klass.prototype.$didChange = function (difference) {
    this.$emit('change', difference)
    klass.$emit('change', this, difference)
  }

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
    }
  }
})

module.exports = Model

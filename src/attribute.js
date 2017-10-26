'use strict'

const $$type = Symbol('type')
const $$generator = Symbol('generator')

const Identifiable = require('./protocols/identifiable')
const EmittingArray = require('./emitting_array')

const GENERATORS = {
  identity (value) { return value },
  string (value) {
    if (value == null) return ''
    return value.toString()
  },
  number (value) {
    if (typeof value === 'number') {
      return value
    } else if (typeof value === 'string') {
      return parseFloat(value)
    }
  },
  boolean (value) {
    return !!value
  },
  object (value) {
    return Object.assign({}, value)
  },
  date (value) {
    if (value instanceof Date) {
      return value
    } else if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value)
    } else if (typeof value === 'object') {
      const { year, month, date, hours, minutes, seconds, milliseconds } = value
      if (value.utc === true) {
        return new Date(Date.UTC(year, month, date, hours, minutes, seconds, milliseconds))
      } else {
        return new Date(year, month, date, hours, minutes, seconds, milliseconds)
      }
    }
  },
  model (type) {
    const Model = require('./model')
    return function (value) {
      if (Model.isInstance(value, type)) {
        return value
      } else {
        return Reflect.construct(type, [value])
      }
    }
  }
}

class AttributeDefinitionException extends Error {
  constructor (code, message, value) {
    super(message)
    this.code = code
    this.value = value
  }
}

class Attribute {
  static create (name, type, options) {
    let typeDefinition = this.parseType(type)
    if (typeDefinition.model) {
      return Reflect.construct(NestedModelAttribute, [name, typeDefinition, options])
    } else {
      return Reflect.construct(this, [name, typeDefinition, options])
    }
  }

  static shorthand (name, options) {
    if (options != null && options.hasOwnProperty('type')) {
      let type = options.type
      return Attribute.create(name, type, options)
    } else {
      return Attribute.create(name, options)
    }
  }

  static parseType (type) {
    const Model = require('./model')
    let options = {collection: false}

    if (type instanceof Array) {
      if (type.length === 1) {
        if (Model.isModel(type[0])) {
          const {model, collection} = type[0].List
          Object.assign(options, {
            base: model,
            collection
          })
        } else {
          Object.assign(options, {
            collection: 'array',
            base: type[0]
          })
        }
      } else {
        throw new AttributeDefinitionException(
          'type',
          `Type for attribute ${this.name} can't be an array with multiple values`,
          type
        )
      }
    } else if (typeof type === 'function') {
      options.base = type
    } else if (type) {
      Object.assign(options, {
        generator: type.generator,
        base: type.base || type.model,
        collection: type.collection || false
      })
    }

    options.model = Model.isModel(options.base)
    options.generator = options.generator || this.generatorForBaseType(options.base)

    return options
  }

  static generatorForBaseType (type) {
    let Model = require('./model')
    if (type == null) {
      return GENERATORS.identity
    } else if (type === String) {
      return GENERATORS.string
    } else if (type === Number) {
      return GENERATORS.number
    } else if (type === Boolean) {
      return GENERATORS.boolean
    } else if (type === Object) {
      return GENERATORS.object
    } else if (type === Date) {
      return GENERATORS.date
    } else if (Model.isModel(type)) {
      return GENERATORS.model(type)
    }
  }

  static get DefinitionException () {
    return AttributeDefinitionException
  }

  static get baseTypes () {
    return [String, Number, Boolean, Date, Object, null]
  }

  static allowsBaseType (type) {
    let Model = require('./model')
    return this.baseTypes.indexOf(type) >= 0 || Model.isModel(type)
  }

  constructor (name, type, options = {}) {
    this.$$key = Symbol(`attributes:${name}`)
    this.name = name
    this.setType(type)
    this.parseOptions(options)
  }

  set baseType (typeClass) {
    if (this.hasOwnProperty($$type)) {
      throw new AttributeDefinitionException('baseType', `Base type for attribute ${this.name} has already been set`, typeClass)
    } else {
      this[$$type] = typeClass
    }
  }

  get baseType () {
    return this[$$type]
  }

  get generator () {
    return this[$$generator]
  }

  parseOptions (options) {
    options = Object.assign({}, options)

    let {
      require = false,
      initial,
      accept,
      encode
    } = options

    delete options.require
    delete options.initial
    delete options.accept
    delete options.encode

    Object.defineProperty(this, 'extra', {value: options})
    Object.defineProperty(this, 'require', {value: require})
    Object.defineProperty(this, 'initial', {value: initial})
    Object.defineProperty(this, 'accept', {value: accept})
    Object.defineProperty(this, 'encoder', {value: encode})
  }

  validate (target) {
    let errors = []
    let value = this.getSafeValue(target)
    let hadErrors = target.$errorStorage[this.$$key] != null
    if (this.require) {
      if (value == null) {
        errors.push({required: true})
      } else if (this.baseType === String && value === '') {
        errors.push({required: true})
      }
    }
    if (errors.length > 0) {
      target.$errorStorage[this.$$key] = errors
      if (!hadErrors) {
        target.$invalidate('$errors')
      }
    } else {
      delete target.$errorStorage[this.$$key]
      if (hadErrors) {
        target.$invalidate('$errors')
      }
    }
  }

  errorsOf (target) {
    return target.$errorStorage[this.$$key]
  }

  setType (typeDefinition) {
    const {base: type, collection, generator} = typeDefinition
    Object.defineProperties(this, {
      collection: {value: collection},
      baseType: {value: type}
    })
    this[$$generator] = generator
  }

  augmentModel (klass) {
    const attribute = this
    klass.$on('creating', function (object) {
      attribute.attachToTarget(object)
    })
    if (attribute.extra.searchable === true) {
      klass.set(require('./protocols/searchable').field, {
        key: attribute.name,
        unique: attribute.extra.unique === true
      })
    }
  }

  attachToTarget (target) {
    target.$lazyData[this.$$key] = {}
    Object.defineProperty(target, this.name, {
      enumerable: true,
      set: this.setterFor(target),
      get: this.getterFor(target)
    })
    this.validate(target)
  }

  getterFor (target) {
    let attribute = this
    return function () {
      if (target.$lazyData[attribute.$$key]) {
        attribute.initializeInTarget(this)
      }
      return attribute.getValue(this)
    }
  }

  getSafeValue (target) {
    if (target.$lazyData[this.$$key]) {
      return target.$lazyData[this.$$key].value
    } else {
      return this.getValue(target)
    }
  }

  setterFor (target) {
    let attribute = this
    return function (value) {
      if (this.$lazyData[attribute.$$key]) {
        attribute.initializeInTarget(this)
      }
      attribute.updateValue(this, value)
      attribute.validate(this)
    }
  }

  initializeInTarget (target) {
    let value
    let lazy = target.$lazyData[this.$$key]
    if (typeof this.initial === 'function') {
      value = this.initial()
    } else if (this.initial != null) {
      value = this.initial
    }
    delete target.$lazyData[this.$$key]
    target.$whileInitializing(() => {
      if (this.collection !== false) {
        this.initializeCollectionInTarget(target, value)
      } else if (value != null) {
        this.maybeUpdateInTarget(target, value)
      }
      if (lazy.value != null) {
        this.maybeUpdateInTarget(target, lazy.value)
      }
    })
  }

  createCollection () {
    let attribute = this
    let collection = EmittingArray.create()
    collection.$on('adding', function (event) {
      let {elements} = event
      event.elements = elements.map(function (element) {
        if (element != null) {
          return attribute.generator(element)
        }
      })
    })
    return collection
  }

  setupCollectionWatcher (collection, target) {
    let attribute = this
    let listener = function (operation, items) {
      target.$didChange({[attribute.name]: {[operation]: items}})
    }
    collection.$on('add', listener.bind(collection, 'added'))
    collection.$on('remove', listener.bind(collection, 'removed'))
  }

  initializeCollectionInTarget (target, value) {
    let collection

    collection = this.createCollection()
    target.$data[this.name] = collection

    this.maybeUpdateInTarget(target, value)
    this.setupCollectionWatcher(collection, target)
  }

  maybeUpdateInTarget (target, value, options) {
    if (target.$lazyData[this.$$key]) {
      target.$lazyData[this.$$key].value = value
      return false
    }
    if (this.collection === 'array') {
      this.updateArrayInTarget(target, value, options)
      return false
    } else if (this.collection === 'map') {
      this.updateMapInTarget(target, value, options)
      return false
    } else {
      let nextValue = this.generator(value)
      let oldValue = target.$data[this.name]
      if (oldValue !== nextValue) {
        this.updateInTarget(target, oldValue, nextValue, options)
        return true
      } else {
        return false
      }
    }
  }

  updateInTarget (target, oldValue, nextValue) {
    target.$data[this.name] = nextValue
  }

  updateArrayInTarget (target, value, options) {
    let currentItems = target.$data[this.name]
    let newItems
    if (value != null) {
      if (typeof value[Symbol.iterator] === 'function') {
        newItems = value
      } else {
        newItems = [value]
      }
    } else {
      newItems = []
    }
    currentItems.$updateAll(newItems, options)
  }

  updateMapInTarget (target, value, options) {
    target.$data[this.name].$updateAll(value || {}, options)
  }

  constainsModelInstance (parent, child) {
    if (this.collection === 'array') {
      return parent[this.name].includes(child)
    } else if (this.collection === 'map') {
      let coll = parent.$data[this.name]
      for (let key of Object.keys(coll)) {
        if (coll[key] === child) {
          return true
        }
      }
      return false
    } else {
      return parent.$data[this.name] === child
    }
  }

  encode (value) {
    if (this.encoder != null) {
      return this.encoder(value)
    }
    if (value == null) {
      return value
    }
    if (this.collection) {
      if (value.length === 0 && this.extra.emptyAsNull === true) {
        return null
      } else {
        return value.$clean
      }
    }
    return value
  }

  getEncodedValue (target) {
    if (target.$lazyData[this.$$key]) {
      return target.$lazyData[this.$$key].value
    }
    return this.encode(this.getValue(target))
  }

  getValue (target) {
    return target.$data[this.name]
  }

  updateValue (target, value) {
    if (this.maybeUpdateInTarget(target, value) && !target.collection) {
      target.$didChange({[this.name]: target[this.name]})
    }
  }
}

class NestedModelAttribute extends Attribute {
  createCollection () {
    return this.baseType.createCollection(this.collection)
  }

  attachToTarget (object) {
    super.attachToTarget(object)
    object.$setTracker(this.name, this.$$key)
  }

  setupCollectionWatcher (collection, object) {
    let attribute = this
    collection.$on('add', function (elements) {
      if (attribute.collection === 'array') {
        for (let item of elements) {
          item.$addParent(object, object.$tracker(attribute.name))
        }
      } else if (attribute.collection === 'map') {
        for (let key in elements) {
          elements[key].$addParent(object, object.$tracker(attribute.name))
        }
      }
    })
    collection.$on('remove', function (elements) {
      if (attribute.collection === 'array') {
        for (let item of elements) {
          item.$removeParent(object, object.$tracker(attribute.name))
        }
      } else if (attribute.collection === 'map') {
        for (let key in elements) {
          elements[key].$addParent(object, object.$tracker(attribute.name))
        }
      }
    })
    return super.setupCollectionWatcher(collection, object)
  }

  encode (value) {
    if (this.encoder != null) {
      return this.encoder(value)
    } else if (value == null) {
      return value
    } else {
      return value.$clean
    }
  }

  updateInTarget (object, oldValue, nextValue, options) {
    if (Identifiable.isEqual(oldValue, nextValue)) {
      oldValue.$updateAttributes(nextValue.$clean, options)
    } else {
      if (oldValue != null) {
        oldValue.$removeParent(object, object.$tracker(this.name))
      }
      super.updateInTarget(object, oldValue, nextValue)
      if (nextValue != null) {
        nextValue.$addParent(object, object.$tracker(this.name))
      }
    }
  }
}

module.exports = Attribute

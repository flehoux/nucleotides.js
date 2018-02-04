'use strict'

const $$type = Symbol('type')
const $$generator = Symbol('generator')

const Identifiable = require('./protocols/identifiable')
const EmittingArray = require('./emitting_array')
const Validators = require('./validators')

const GENERATORS = {
  identity (value) { return value },
  string (value) {
    if (value == null) return
    return value.toString()
  },
  symbol (value) {
    if (typeof value === 'symbol') {
      return value
    } else if (typeof value === 'string') {
      return Symbol.for(value)
    } else {
      return null
    }
  },
  number (value) {
    if (typeof value === 'number') {
      return value
    } else if (typeof value === 'string') {
      return parseFloat(value)
    }
  },
  boolean (value) {
    if (value === 'true') return true
    if (value === 'false') return false
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
        if (value.$parent != null) {
          return value
        } else {
          value = value.$clean
        }
      }
      return Reflect.construct(type, [value])
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
  static get isModel () { return false }

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
    } else if (type === Symbol) {
      return GENERATORS.symbol
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
    return [String, Symbol, Number, Boolean, Date, Object, null]
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

  clone (source, target) {
    this.setInitialValue(target, this.getEncodedValue(source))
  }

  parseOptions (options) {
    options = Object.assign({}, options)

    let {
      require = false,
      initial,
      accept,
      encode,
      regexp
    } = options

    if (this.baseType == null && encode == null) {
      throw new Error('You need to provide either a encoder or a type to an attribute')
    }

    delete options.require
    delete options.initial
    delete options.accept
    delete options.encode
    delete options.regexp

    Object.defineProperty(this, 'extra', {value: options})
    Object.defineProperty(this, 'require', {value: require})
    Object.defineProperty(this, 'initial', {value: initial})
    Object.defineProperty(this, 'accept', {value: accept})
    Object.defineProperty(this, 'encoder', {value: encode})
    Object.defineProperty(this, 'regexp', {value: regexp})
  }

  setType (typeDefinition) {
    const {base: type, collection, generator} = typeDefinition
    Object.defineProperties(this, {
      collection: {value: collection},
      baseType: {value: type}
    })
    this[$$generator] = generator
  }

  getEncodedValue (target) {
    let value
    let Model = require('./model')
    if (target.$lazyData[this.$$key]) {
      if (target.$lazyData[this.$$key].hasOwnProperty('value')) {
        value = target.$lazyData[this.$$key].value
        if (Model.isModel(this.baseType) && Model.isInstance(value)) {
          value = this.encode(value)
        } else if (this.baseType == null) {
          return this.encode(value)
        }
      } else {
        return this.initial
      }
      if (this.collection && value && value.$model) {
        return this.encode(value)
      }
      return value
    } else {
      value = this.getValue(target)
    }
    return this.encode(value)
  }

  getValue (target) {
    return target.$data[this.name]
  }

  setInitialValue (target, value) {
    this.maybeUpdateInTarget(target, value, {constructing: true})
  }

  updateValue (target, value) {
    this.maybeUpdateInTarget(target, value)
  }

  augmentModel (klass) {
    klass.$on('creating', (object) => {
      this.attachToTarget(object)
    })

    if (this.require === true) {
      klass.validate(Validators.Require.for(this.name))
    }
    if (this.accept && this.accept.length > 0) {
      klass.validate(Validators.AcceptedValues.for(this.name, this.accept))
    }
    if (this.baseType === String && this.regex instanceof RegExp) {
      klass.validate(Validators.RegularExpression.for(this.name, this.regexp))
    }

    if (this.extra.searchable === true) {
      klass.set(require('./protocols/searchable').field, {
        key: this.name,
        unique: this.extra.unique === true
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
  }

  getterFor (target) {
    let attribute = this
    return function () {
      if (this.$lazyData[attribute.$$key]) {
        attribute.initializeInTarget(this)
      }
      return attribute.getValue(this)
    }
  }

  setterFor (target) {
    let attribute = this
    return function (value) {
      if (this.$lazyData[attribute.$$key]) {
        attribute.initializeInTarget(this, value)
      } else {
        attribute.updateValue(this, value)
      }
    }
  }

  getSafeValue (target) {
    if (target.$lazyData[this.$$key]) {
      return target.$lazyData[this.$$key].value
    } else {
      return this.getValue(target)
    }
  }

  initializeInTarget (target, providedValue) {
    let value
    let lazy = target.$lazyData[this.$$key]
    if (providedValue != null) {
      value = providedValue
    } else if (typeof this.initial === 'function') {
      value = this.initial()
    } else if (this.initial != null) {
      value = this.initial
    }
    delete target.$lazyData[this.$$key]
    return target.$performInTransaction(() => {
      if (this.collection !== false) {
        this.initializeCollectionInTarget(target, value, {initializing: true})
      } else if (value != null) {
        this.maybeUpdateInTarget(target, value, {initializing: true})
      }
      if (providedValue == null && lazy.value != null) {
        this.maybeUpdateInTarget(target, lazy.value, {initializing: true})
      }
      if (providedValue != null) {
        target.$didChange(this.name)
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

  initializeCollectionInTarget (target, value, options) {
    let collection
    let listener = target.$didChange.bind(target, this.name)

    collection = this.createCollection()
    collection.$on({add: listener, remove: listener, update: listener})
    collection.$setParent(target)
    target.$data[this.name] = collection

    this.maybeUpdateInTarget(target, value, options)
    target.$on('destroy', collection.destroy.bind(collection))
  }

  maybeUpdateInTarget (target, value, options = {}) {
    return target.$performInTransaction(() => {
      if (target.$lazyData[this.$$key]) {
        if (options.constructing) {
          let oldValue = target.$lazyData[this.$$key].value
          if (oldValue !== value) {
            target.$lazyData[this.$$key].value = value
            target.$didChange(this.name)
          }
          return
        }
        this.initializeInTarget(target)
      }
      if (this.collection === 'array') {
        this.doUpdateArrayInTarget(target, value, options)
        if (!options.initializing) {
          target.$didChange(this.name)
        }
      } else if (this.collection === 'map') {
        this.doUpdateMapInTarget(target, value, options)
        if (!options.initializing) {
          target.$didChange(this.name)
        }
      } else {
        let nextValue = this.generator(value)
        let oldValue = target.$data[this.name]
        if (oldValue !== nextValue) {
          this.doUpdateInTarget(target, oldValue, nextValue, options)
          if (options.initializing && target.$difference) {
            target.$difference.$setInitial(this)
          } else {
            target.$didChange(this.name)
          }
        }
      }
    })
  }

  doUpdateInTarget (target, oldValue, nextValue) {
    target.$data[this.name] = nextValue
  }

  doUpdateArrayInTarget (target, value, options) {
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

  doUpdateMapInTarget (target, value, options) {
    target.$data[this.name].$updateAll(value || {}, options)
  }

  encode (value) {
    if (this.encoder != null) {
      return this.encoder(value)
    }
    if (this.baseType == null) {
      return null
    }
    if (value == null) {
      return value
    }
    if (this.collection) {
      if (value.length === 0 && this.extra.emptyAsNull === true) {
        return undefined
      } else {
        return value.$clean
      }
    }
    return value
  }
}

class NestedModelAttribute extends Attribute {
  static get isModel () { return true }

  clone (source, target) {
    if (source.$data.hasOwnProperty(this.name)) {
      if (this.collection) {
        this.initializeInTarget(target)
        target.$data[this.name].$updateAll(source.$data[this.name])
      } else {
        this.initializeInTarget(target, this.getValue(source))
      }
    } else {
      this.setInitialValue(target, this.getEncodedValue(source))
    }
  }

  createCollection () {
    return this.baseType.createCollection(this.collection)
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
        return undefined
      } else {
        return value.$clean
      }
    }
    return value.$clean
  }

  doUpdateInTarget (object, oldValue, nextValue, options) {
    if (Identifiable.isEqual(oldValue, nextValue)) {
      oldValue.$updateAttributes(nextValue.$clean, options)
    } else {
      if (oldValue != null) {
        oldValue.$destroy()
      }

      if (nextValue != null) {
        try {
          nextValue.$setParent(object, this.name)
          super.doUpdateInTarget(object, oldValue, nextValue)
        } catch (err) {
          if (err.constructor.name === 'AncestryError') {
            nextValue = nextValue.$clone()
            nextValue.$setParent(object, this.name)
            super.doUpdateInTarget(object, oldValue, nextValue)
          }
        }
      }
    }
  }
}

module.exports = Attribute

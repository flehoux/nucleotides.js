'use strict'

const $$type = Symbol('type')
const $$generator = Symbol('generator')

const Identifiable = require('./protocols/identifiable')
const EmittingArray = require('./emitting_array')

class AttributeDefinitionException extends Error {
  constructor (code, message, value) {
    super(message)
    this.code = code
    this.value = value
  }
}

class Attribute {
  constructor (name, type, options = {}) {
    this.name = name
    this.parseType(type)
    this.parseOptions(options)
  }

  static generatorForBaseType (attribute, type) {
    let Model = require('./model')
    if (type == null) {
      return value => value
    } else if (type === String) {
      return (value) => {
        if (value == null) return ''
        return value.toString()
      }
    } else if (type === Number) {
      return (value) => {
        if (typeof value === 'number') {
          return value
        } else if (typeof value === 'string') {
          return parseFloat(value)
        }
      }
    } else if (type === Boolean) {
      return (value) => !!value
    } else if (type === Date) {
      return function (value) {
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
      }
    } else if (Model.isModel(type)) {
      return function (...args) {
        if (Model.isInstance(args[0], type)) {
          return args[0]
        } else {
          return Reflect.construct(type, args)
        }
      }
    } else {
      throw new AttributeDefinitionException('type', `Attribute ${attribute.name} is being defined without a proper type`, type)
    }
  }

  static get DefinitionException () {
    return AttributeDefinitionException
  }

  static get baseTypes () {
    return [String, Number, Boolean, Date, null]
  }

  static allowsBaseType (type) {
    let Model = require('./model')
    return this.baseTypes.indexOf(type) >= 0 || Model.isModel(type)
  }

  static shorthand (name, options) {
    if (options != null && options.hasOwnProperty('type')) {
      let type = options.type
      return new Attribute(name, type, options)
    } else {
      return new Attribute(name, options)
    }
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

  get isModel () {
    let Model = require('./model')
    return Model.isModel(this.baseType)
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

    Object.defineProperty(this, 'require', {value: require})
    Object.defineProperty(this, 'initial', {value: initial})
    Object.defineProperty(this, 'accept', {value: accept})
    Object.defineProperty(this, 'encoder', {value: encode})

    delete options.require
    delete options.initial
    delete options.accept
    delete options.encode

    Object.defineProperty(this, 'extra', {value: options})
  }

  parseType (type) {
    let typeDefinition
    const Model = require('./model')

    if (type instanceof Array) {
      if (type.length === 1) {
        if (Model.isModel(type)) {
          type = type[0].List
        } else {
          type = {
            collection: 'array',
            model: type[0]
          }
        }
      } else {
        throw new AttributeDefinitionException(
          'type',
          `Type for attribute ${this.name} can't be an array with multiple values`,
          type
        )
      }
    }

    if (type == null) {
      Object.defineProperty(this, 'collection', {value: false})
      typeDefinition = null
    } else if (type.model && typeof type.collection === 'string') {
      Object.defineProperty(this, 'collection', {value: type.collection})
      typeDefinition = type.model
    } else {
      Object.defineProperty(this, 'collection', {value: false})
      typeDefinition = type
    }

    if (Attribute.allowsBaseType(typeDefinition)) {
      this.baseType = typeDefinition
      this[$$generator] = Attribute.generatorForBaseType(this, typeDefinition)
    } else if (Attribute.allowsBaseType(typeDefinition.base)) {
      this.baseType = typeDefinition.base
      if (typeof typeDefinition.generator === 'function') {
        this[$$generator] = typeDefinition.generator
      } else {
        this[$$generator] = Attribute.generatorForBaseType(this, typeDefinition)
      }
    }
  }

  augmentModel (klass) {
    const attribute = this
    const Searchable = require('./protocols/searchable')
    klass.$on('creating', function (object) {
      Object.defineProperty(object, attribute.name, {
        enumerable: true,
        set: function (value) {
          if (attribute.updateInTarget(this, value) && !this.collection) {
            this.$didChange({[attribute.name]: this[attribute.name]})
          }
        },
        get: function () {
          return this.$data[attribute.name]
        }
      })
      object.$setTracker(attribute.name, Symbol(`attributes:${attribute.name}`))
      attribute.initializeInTarget(object)
    })
    if (attribute.extra.searchable === true) {
      klass.set(Searchable.field, {
        key: attribute.name,
        unique: attribute.extra.unique === true
      })
    }
  }

  initializeInTarget (object) {
    let value
    if (typeof this.initial === 'function') {
      value = this.initial()
    } else if (this.initial != null) {
      value = this.initial
    }
    if (this.collection !== false) {
      this.initializeCollectionInTarget(object, value)
    } else if (value != null) {
      this.updateInTarget(object, value)
    }
  }

  initializeCollectionInTarget (object, value) {
    let collection
    let attribute = this

    if (this.isModel) {
      collection = this.baseType.createCollection(this.collection)
    } else {
      collection = EmittingArray.create()
      collection.$on('adding', function (event) {
        let {elements} = event
        event.elements = elements.map(function (element) {
          if (element != null) {
            return attribute.generator(element)
          }
        })
      })
    }

    object.$data[this.name] = collection
    if (this.isModel) {
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
    }

    this.updateInTarget(object, value)
    let listener = function (operation, items) {
      object.$didChange({[attribute.name]: {[operation]: items}})
    }
    collection.$on('add', listener.bind(collection, 'added'))
    collection.$on('remove', listener.bind(collection, 'removed'))
  }

  updateInTarget (object, value) {
    if (this.collection === 'array') {
      this.updateArrayInTarget(object, value)
      return false
    } else if (this.collection === 'map') {
      this.updateMapInTarget(object, value)
      return false
    } else {
      let nextValue = this.generator(value)
      if (object.$data[this.name] !== nextValue) {
        let oldValue = object.$data[this.name]
        if (this.isModel && Identifiable.isEqual(oldValue, nextValue)) {
          oldValue.$updateAttributes(nextValue.$clean)
        } else {
          if (this.isModel && oldValue != null) {
            oldValue.$removeParent(object, object.$tracker(this.name))
          }
          object.$data[this.name] = nextValue
          if (this.isModel && nextValue != null) {
            nextValue.$addParent(object, object.$tracker(this.name))
          }
        }
        return true
      } else {
        return false
      }
    }
  }

  updateArrayInTarget (object, value) {
    let currentItems = object.$data[this.name]
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
    currentItems.$updateAll(newItems)
  }

  updateMapInTarget (object, value) {
    object.$data[this.name].$updateAll(value || {})
  }

  constainsModelInstance (parent, child) {
    if (this.collection === 'array') {
      return parent.$data[this.name].includes(child)
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
    if (this.isModel) {
      return value.$clean
    }
    return value
  }
}

module.exports = Attribute

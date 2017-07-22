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
    if (type === String) {
      return (value) => value.toString()
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
    return [String, Number, Boolean, Date]
  }

  static allowsBaseType (type) {
    let Model = require('./model')
    return this.baseTypes.indexOf(type) >= 0 || Model.isModel(type)
  }

  static shorthand (name, options) {
    if (options.hasOwnProperty('type')) {
      let type = options.type
      delete options.type
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
    const {
      require = false,
      initial,
      accept
    } = options
    Object.defineProperty(this, 'require', {value: require})
    Object.defineProperty(this, 'initial', {value: initial})
    Object.defineProperty(this, 'accept', {value: accept})

    delete options.require
    delete options.initial
    delete options.accept
    Object.defineProperty(this, 'extra', {value: options})
  }

  parseType (type) {
    let typeDefinition
    if (type instanceof Array) {
      if (type.length === 1) {
        Object.defineProperty(this, 'collection', {value: true})
        typeDefinition = type[0]
      } else {
        throw new AttributeDefinitionException('type', 'Type for attribute ' + this.name + ' can\'t be an array with multiple values', type)
      }
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
    Object.defineProperty(klass.prototype, this.name, {
      set: function (value) {
        if (attribute.updateInTarget(this, value) && !this.collection) {
          this.$didChange({[attribute.name]: this[attribute.name]})
        }
      },
      get: function () {
        return this.$data[attribute.name]
      }
    })
    klass.$on('creating', function (object) {
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
    if (this.collection) {
      this.initializeArrayInTarget(object, value)
    } else if (value != null) {
      this.updateInTarget(object, value)
    }
  }

  initializeArrayInTarget (object, value) {
    const Collection = require('./collection')
    let array
    let attribute = this

    if (this.isModel) {
      array = Collection.create(this.baseType)
    } else {
      array = EmittingArray.create()
      array.$on('adding', function (event) {
        let {elements} = event
        event.elements = elements.map(function (element) {
          if (element != null) {
            return attribute.generator(element)
          }
        })
      })
    }

    object.$data[this.name] = array
    if (this.isModel) {
      array.$on('add', function (elements) {
        for (let item of elements) {
          item.$addParent(object, object.$tracker(attribute.name))
        }
      })
      array.$on('remove', function (elements) {
        for (let item of elements) {
          item.$removeParent(object, object.$tracker(attribute.name))
        }
      })
    }

    this.updateInTarget(object, value)
    let listener = function (operation, items) {
      object.$didChange({[attribute.name]: {[operation]: items}})
    }
    array.$on('add', listener.bind(array, 'added'))
    array.$on('remove', listener.bind(array, 'removed'))
  }

  updateInTarget (object, value) {
    if (this.collection) {
      this.updateArrayInTarget(object, value)
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

  constainsModelInstance (parent, child) {
    if (this.collection) {
      return parent.$data[this.name].includes(child)
    } else {
      return parent.$data[this.name] === child
    }
  }
}

module.exports = Attribute

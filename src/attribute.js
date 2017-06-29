'use strict'

const $$type = Symbol('type')
const $$generator = Symbol('generator')

function AttributeDefinitionException (code, message, value) {
  this.code = code
  this.message = message
  this.value = value
}

function generatorForBaseType (type) {
  let Model = require('./model')
  if (type === String) {
    return (value) => value.toString()
  } else if (type === Number) {
    return (value) => parseFloat(value)
  } else if (type === Boolean) {
    return (value) => !!value
  } else if (type === Date) {
    return function (value) {
      if (typeof value === 'string' || typeof value === 'number') {
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
  }
}

class Attribute {
  constructor (name, type, options = {}) {
    this.name = name
    this.parseType(type)
    this.parseOptions(options)
  }

  static get baseTypes () {
    return [String, Number, Boolean, Date]
  }

  static allowsBaseType (type) {
    let Model = require('./model')
    return this.baseTypes.indexOf(type) >= 0 || Model.isModel(type)
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
    const {require, initial, accept} = options
    Object.defineProperty(this, 'require', {value: require})
    Object.defineProperty(this, 'initial', {value: initial})
    Object.defineProperty(this, 'accept', {value: accept})
  }

  parseType (type) {
    let typeDefinition
    if (type instanceof Array) {
      if (type.length === 1) {
        Object.defineProperty(this, 'collection', {value: true})
        typeDefinition = type[0]
      } else {
        throw new AttributeDefinitionException('type', `Type for attribute ${this.name} can't be an array with multiple values`, type)
      }
    } else {
      Object.defineProperty(this, 'collection', {value: false})
      typeDefinition = type
    }

    if (Attribute.allowsBaseType(typeDefinition)) {
      this.baseType = typeDefinition
      this[$$generator] = generatorForBaseType(typeDefinition)
    } else if (Attribute.allowsBaseType(typeDefinition.base)) {
      this.baseType = typeDefinition.base
      if (typeof typeDefinition.generator === 'function') {
        this[$$generator] = typeDefinition.generator
      } else {
        this[$$generator] = generatorForBaseType(typeDefinition)
      }
    }
  }

  maybeUpdate (object, value) {
    let realValue = this.generator(value)
    if (object.$data[this.name] !== realValue) {
      object.$data[this.name] = realValue
      return true
    } else {
      return false
    }
  }

  augmentModel (klass) {
    let attribute = this

    Object.defineProperty(klass.prototype, this.name, {
      set: function (value) {
        if (attribute.maybeUpdate(this, value)) {
          let difference = { [attribute.name]: this[attribute.name] }
          this.$emit('change', difference)
          klass.$emit('change', this, difference)
        }
      },
      get: function () {
        return this.$data[attribute.name]
      }
    })

    klass.$on('new', function (object) {
      if (object.$data[attribute.name] == null) {
        attribute.initializeIn(object)
      }
    })
  }

  initializeIn (object) {
    if (typeof this.initial === 'function') {
      object.$data[this.name] = this.initial()
    } else if (this.initial != null) {
      object.$data[this.name] = this.initial
    } else {
      object.$data[this.name] = null
    }
  }
}

Attribute.shorthand = function (name, options) {
  if (options.hasOwnProperty('type')) {
    let type = options.type
    delete options.type
    return new Attribute(name, type, options)
  } else {
    return new Attribute(name, options)
  }
}

Attribute.DefinitionException = AttributeDefinitionException

module.exports = Attribute

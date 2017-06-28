'use strict'

const __type = Symbol('type')
const __generator = Symbol('generator')

function FieldDefinitionException (code, message, value) {
  this.code = code
  this.message = message
  this.value = value
}

function generatorForBaseType (type) {
  if (type === String) {
    return (value) => value.toString()
  } else if (type === Number) {
    return (value) => parseFloat(value)
  } else if (type === Boolean) {
    return (value) => !!value
  } else if (type === Date) {
    return (value) => {
      if (typeof value === 'string' || typeof value === 'number') {
        return new Date(value)
      } else if (typeof value === 'object') {
        const { year, month, date, hours, minutes, seconds, milliseconds } = value
        return new Date(year, month, date, hours, minutes, seconds, milliseconds)
      }
    }
  }
}

class Field {
  constructor (name, type, options = {}) {
    this.name = name
    this.parseType(type)
    this.parseOptions(options)
  }

  static get baseTypes () {
    return [String, Number, Boolean, Date]
  }

  static allowsBaseType (type) {
    return this.baseTypes.indexOf(type) >= 0
  }

  set baseType (typeClass) {
    if (this.hasOwnProperty(__type)) {
      throw new FieldDefinitionException('baseType', `Base type for field ${this.name} has already been set`, typeClass)
    } else {
      this[__type] = typeClass
    }
  }

  get baseType () {
    return this[__type]
  }

  get generator () {
    return this[__generator]
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
        throw new FieldDefinitionException('type', `Type for field ${this.name} can't be an array with multiple values`, type)
      }
    } else {
      Object.defineProperty(this, 'collection', {value: false})
      typeDefinition = type
    }

    if (Field.allowsBaseType(typeDefinition)) {
      this.baseType = typeDefinition
      this[__generator] = generatorForBaseType(typeDefinition)
    } else if (Field.allowsBaseType(typeDefinition.base)) {
      this.baseType = typeDefinition.base
      if (typeof typeDefinition.generator === 'function') {
        this[__generator] = typeDefinition.generator
      } else {
        this[__generator] = generatorForBaseType(typeDefinition)
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
    let field = this

    Object.defineProperty(klass.prototype, this.name, {
      set: function (value) {
        if (field.maybeUpdate(this, value)) {
          let difference = { [field.name]: this[field.name] }
          this.$emit('change', difference)
          klass.$emit('change', this, difference)
        }
      },
      get: function () {
        return this.$data[field.name]
      }
    })

    klass.$on('new', function (object) {
      if (object.$data[field.name] == null) {
        field.initializeIn(object)
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

Field.shorthand = function (name, options) {
  if (options.hasOwnProperty('type')) {
    let type = options.type
    delete options.type
    return new Field(name, type, options)
  } else {
    return new Field(name, options)
  }
}

Field.DefinitionException = FieldDefinitionException

module.exports = Field

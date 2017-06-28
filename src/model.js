'use strict';

const __constructor = Symbol('construct')
const __fields = Symbol('fields')
const __data = Symbol('data')

const Field = require('./field')
const emitter = require('./emitter')

module.exports = function Model (name) {
  const klass = function (...args) {
    this[__data] = {}
    klass[__constructor].apply(this, args)
    for (let fieldName in klass[__fields]) {
      if (this.$data[fieldName] == null) {
        let field = klass[__fields][fieldName]
        field.initializeIn(this)
      }
    }
    klass.$emit("new", this)
  }

  Object.defineProperty(klass, 'name', {value: name, __proto__: null})
  Object.defineProperty(klass.prototype, '$data', {get: function () { return this[__data] }})

  emitter(klass)
  emitter(klass.prototype)

  klass[__constructor] = function (data) {
    if (data == null) return

    for (let fieldName in klass[__fields]) {
      if (data[fieldName] != null) {
        this[fieldName] = data[fieldName]
      }
    }
  }
  klass[__fields] = {}

  klass.construct = function (fn) {
    if (fn instanceof Function) {
      klass[__constructor] = fn
    }
    return klass
  }

  klass.field = function(name, type, options) {
    const newField = new Field(name, type, options)
    newField.augmentModel(klass)
    klass[__fields][name] = newField
    return klass
  }

  klass.fields = function(fields) {
    if (fields == null) {
      return klass[__fields]
    } else {
      for (let name of Object.keys(fields)) {
        let newField = Field.shorthand(name, fields[name])
        newField.augmentModel(klass)
        klass[__fields][name] = newField
      }
      return klass
    }
  }

  return klass
}

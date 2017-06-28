'use strict'

function DerivedDefinitionException (code, message, value) {
  this.code = code
  this.message = message
  this.value = value
}

class DerivedProperty {
  constructor (name, options, getter) {
    if (typeof options === 'function') {
      getter = options
      options = {}
    }

    if (getter == null) {
      throw new DerivedDefinitionException('unacceptable', `No getter function provided for derived property ${name}`)
    }

    this.getter = getter
    this.options = options
    this.name = name
    this.storage = Symbol('storage')
  }

  cache (object) {
    object[this.storage] = this.getter.call(object)
  }

  clearCache (object) {
    delete object[this.storage]
  }

  augmentModel (klass) {
    let derived = this

    if (this.options.cached === false) {
      Object.defineProperty(klass.prototype, derived.name, {
        get: function () {
          return derived.getter.call(this)
        }
      })
    } else {
      if (this.options.eager !== false) {
        klass.$on('new', (object) => { derived.cache(object) })
      }

      Object.defineProperty(klass.prototype, derived.name, {
        get: function () {
          if (derived.options.eager === false) {
            derived.cache(this)
          }
          if (this.hasOwnProperty([derived.storage])) {
            return this[derived.storage]
          }
        }
      })

      if (this.options.cached === true) {
        klass.$on('change', function (object) {
          if (this.options.eager === true) {
            derived.cache(this)
          } else {
            derived.clearCache(this)
          }
        })
      } else {
        klass.$on('change', function (object, difference) {

        })
      }
    }
  }
}

module.exports = DerivedProperty

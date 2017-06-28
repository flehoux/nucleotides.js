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

    this.prepareDefaults()
  }

  prepareDefaults () {
    if (this.options == null) {
      this.options = {}
    }

    if (this.options.cached == null) {
      this.options.cached = false
    }

    if (this.options.eager == null) {
      this.options.eager = false
    }
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
          if (this.hasOwnProperty(derived.storage)) {
            return this[derived.storage]
          } else {
            if (derived.options.eager === false) {
              derived.cache(this)
            }
            return this[derived.storage]
          }
        }
      })

      if (this.options.cached === true) {
        klass.$on('change', function (object) {
          if (derived.options.eager === true) {
            derived.cache(object)
          } else {
            derived.clearCache(object)
          }
        })
      } else if (this.options.cached && this.options.cached.length > 0) {
        klass.$on('change', function (object, difference) {
          for (let fieldName of derived.options.cached) {
            if (fieldName in difference) {
              if (derived.options.eager === true) {
                derived.cache(object)
              } else {
                derived.clearCache(object)
              }
              return;
            }
          }
        })
      }
    }
  }
}

module.exports = DerivedProperty

'use strict'

class DerivedDefinitionException extends Error {
  constructor (code, message, value) {
    super(message)
    this.code = code
    this.value = value
  }
}

class DerivedValue {
  static get DefinitionException () {
    return DerivedDefinitionException
  }

  static create (name, options, getter) {
    if (typeof options === 'function') {
      getter = options
      options = {}
    }
    if (options.async === true) {
      return new AsyncDerivedValue(name, options, getter)
    }
    if (options.cached != null && options.cache !== false) {
      return new CachedDerivedValue(name, options, getter)
    }
    return new DerivedValue(name, options, getter)
  }

  constructor (name, options, getter) {
    if (getter == null) {
      throw new DerivedDefinitionException('unacceptable', `No getter function provided for derived property ${name}`)
    }
    this.getter = getter
    this.options = options
    this.name = name
    this.prepareDefaults()
  }

  prepareDefaults () {
    if (this.options == null) {
      this.options = {}
    }
  }

  augmentModel (klass) {
    let derived = this
    Object.defineProperty(klass.prototype, this.name, {
      get: function () {
        return derived.getter.call(this)
      }
    })
  }
}

class CachedDerivedValue extends DerivedValue {
  constructor (name, options, getter) {
    super(name, options, getter)
    this.$$cache = Symbol('cache')
  }

  prepareDefaults () {
    super.prepareDefaults()

    if (this.options.cached == null) {
      this.options.cached = false
    }

    if (this.options.eager == null) {
      this.options.eager = false
    }
  }

  cache (object) {
    object[this.$$cache] = this.getter.call(object)
  }

  clearCache (object) {
    delete object[this.$$cache]
  }

  augmentModel (klass) {
    let derived = this
    if (this.options.eager !== false) {
      klass.$on('new', (object) => { derived.cache(object) })
    }

    Object.defineProperty(klass.prototype, derived.name, {
      get: function () {
        if (this.hasOwnProperty(derived.$$cache)) {
          return this[derived.$$cache]
        } else {
          if (derived.options.eager === false) {
            derived.cache(this)
          }
          return this[derived.$$cache]
        }
      }
    })

    if (Array.isArray(this.options.source) && this.options.source.length > 0) {
      klass.$on('change', function (object, difference) {
        for (let attributeName of derived.options.source) {
          if (attributeName in difference) {
            if (derived.options.eager === true) {
              derived.cache(object)
            } else {
              derived.clearCache(object)
            }
            return
          }
        }
      })
    } else if (this.options.source == null || this.options.source === 'all') {
      klass.$on('change', function (object) {
        if (derived.options.eager === true) {
          derived.cache(object)
        } else {
          derived.clearCache(object)
        }
      })
    }
  }
}

class AsyncDerivedValue extends CachedDerivedValue {
  constructor (name, options, getter) {
    super(name, options, getter)
    this.$$promise = Symbol('promise')
  }

  clearCache (object) {
    let loaded = object.hasOwnProperty(this.$$cache)
    delete object[this.$$cache]
    delete object[this.$$promise]
    if (loaded) {
      this.ensure(object)
    }
  }

  augmentModel (klass) {
    let derived = this
    if (this.options.eager !== false) {
      klass.$on('new', (object) => { derived.ensure(object) })
    }

    Object.defineProperty(klass.prototype, derived.name, {
      get: function () {
        return this[derived.$$cache]
      }
    })

    if (Array.isArray(this.options.source) && this.options.source.length > 0) {
      klass.$on('change', function (object, difference) {
        for (let attributeName of derived.options.source) {
          if (attributeName in difference) {
            derived.clearCache(object)
            return
          }
        }
      })
    } else if (this.options.source === 'all') {
      klass.$on('change', function (object, difference) {
        derived.clearCache(object)
      })
    }
  }

  ensure (object) {
    let derived = this
    if (object.hasOwnProperty(derived.$$promise)) {
      return object[derived.$$promise]
    }
    let result = this.getter.call(object)
    if (typeof result.then === 'function') {
      object[derived.$$promise] = result.then(function (value) {
        object[derived.$$cache] = value
        object.$emit('resolved', derived.name, value)
        object.constructor.$emit('resolved', object, derived.name, value)
        return object
      })
      return object[derived.$$promise]
    } else {
      throw new DerivedDefinitionException('unacceptable', 'Getter function did not return a Promise instance', result)
    }
  }
}

DerivedValue.Cached = CachedDerivedValue
DerivedValue.Async = AsyncDerivedValue

module.exports = DerivedValue

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

  maybeUpdate () {}
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

  force (object, value) {
    object[this.$$cache] = value
  }

  augmentModel (klass) {
    let derived = this
    if (this.options.eager !== false) {
      klass.$on('new', (object) => {
        derived.cache(object)
      })
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
  }

  maybeUpdate (klass, object, changeset) {
    if (Array.isArray(this.options.source) && this.options.source.length > 0) {
      for (let attributeName of this.options.source) {
        if (changeset.$keys.has(attributeName)) {
          this.update(object)
          return
        }
      }
    } else if (this.options.source == null || this.options.source === 'all') {
      this.update(object)
    }
  }

  update (object) {
    if (this.options.eager === true) {
      this.cache(object)
    } else {
      this.clearCache(object)
    }
  }
}

class AsyncDerivedValue extends CachedDerivedValue {
  constructor (name, options, getter) {
    super(name, options, getter)
    this.$$promise = Symbol('promise')
  }

  clearCache (object, reensure = true) {
    let loaded = object.hasOwnProperty(this.$$cache)
    delete object[this.$$promise]
    if (loaded && reensure) {
      this.ensure(object)
    }
  }

  force (object, value) {
    object[this.$$promise] = Promise.resolve(value)
    super.force(object, value)
    object.$emit('resolved', this.name, value)
    object.constructor.$emit('resolved', object, this.name, value)
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
  }

  update (object) {
    this.clearCache(object)
  }

  fetched (object) {
    return object.hasOwnProperty(this.$$cache)
  }

  ensure (object) {
    let derived = this
    if (object.hasOwnProperty(derived.$$promise)) {
      return object[derived.$$promise]
    }
    let result = this.getter.call(object)
    if (result == null) {
      return null
    } else if (typeof result.then === 'function') {
      object[derived.$$promise] = result.then(function (value) {
        object[derived.$$cache] = value
        object.$emit('resolved', derived.name, value)
        object.constructor.$emit('resolved', object, derived.name, value)
        return object
      })
      return object[derived.$$promise]
    } else {
      const {resolvePromise} = require('..')
      object[derived.$$promise] = resolvePromise(result)
      return object[derived.$$promise]
    }
  }
}

DerivedValue.Cached = CachedDerivedValue
DerivedValue.Async = AsyncDerivedValue

module.exports = DerivedValue

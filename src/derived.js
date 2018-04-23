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

  shouldUpdate () {
    return false
  }
}

class CachedDerivedValue extends DerivedValue {
  constructor (name, options, getter) {
    super(name, options, getter)
    this.$$cache = Symbol('cache')
    this.$$invalidated = Symbol('invalidated')
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

  cache (object, changeset) {
    this.force(object, this.getter.call(object, object[this.$$cache], changeset))
  }

  clearCache (object) {
    this.update(object)
  }

  force (object, value) {
    if (this.options.model && object[this.$$cache] != null) {
      object[this.$$cache].$removeFromParent(object)
    }
    object[this.$$cache] = value
    if (this.options.model && value != null) {
      value.$setParent(object, this.name, true)
    }
    delete object[this.$$invalidated]
    object.$emit('resolved', this.name, value)
    object.constructor.$emit('resolved', object, this.name, value)
  }

  augmentModel (klass) {
    let derived = this
    if (this.options.eager !== false) {
      klass.$on('new', (object) => {
        derived.cache(object)
      })
    }

    klass.$on('mount', function (object) {
      if (object[this.$$cache] != null) {
        object[this.$$cache].$mount()
      }
    })

    Object.defineProperty(klass.prototype, derived.name, {
      get () {
        if (!this.hasOwnProperty(derived.$$invalidated) && this.hasOwnProperty(derived.$$cache)) {
          return this[derived.$$cache]
        } else {
          derived.cache(this)
          return this[derived.$$cache]
        }
      }
    })
  }

  shouldUpdate (klass, object, changeset) {
    if (Array.isArray(this.options.source) && this.options.source.length > 0) {
      for (let attributeName of this.options.source) {
        if (changeset.$keys.has(attributeName)) {
          return true
        }
      }
    } else if (this.options.source == null || this.options.source === 'all') {
      return true
    }
    return false
  }

  update (object, changeset) {
    if (this.options.eager === true) {
      this.cache(object, changeset)
    } else if (object.hasOwnProperty(this.$$cache)) {
      object[this.$$invalidated] = true
    } else {
      delete object[this.$$cache]
    }
  }
}

class AsyncDerivedValue extends CachedDerivedValue {
  constructor (name, options, getter) {
    super(name, options, getter)
    this.$$promise = Symbol('promise')
  }

  clearCache (object, reensure = false) {
    if (reensure && object.hasOwnProperty(this.$$cache)) {
      this.ensure(object, null, true)
    } else {
      delete object[this.$$cache]
      delete object[this.$$promise]
    }
  }

  force (object, value, setPromise = true) {
    if (setPromise) {
      object[this.$$promise] = Promise.resolve(value)
    }
    super.force(object, value)
  }

  augmentModel (klass) {
    let derived = this
    if (this.options.eager !== false) {
      klass.$on('new', (object) => { derived.ensure(object) })
    }

    Object.defineProperty(klass.prototype, derived.name, {
      get () {
        return this[derived.$$cache]
      }
    })
  }

  update (object, changeset) {
    if (this.fetched(object) && this.options.reensure !== false) {
      this.ensure(object, changeset, true)
    } else {
      this.clearCache(object)
    }
  }

  fetched (object) {
    return object.hasOwnProperty(this.$$cache)
  }

  ensure (object, changeset, force = false) {
    let derived = this
    if (!force && object.hasOwnProperty(derived.$$promise)) {
      return object[derived.$$promise]
    }
    let result = this.getter.call(object, object[this.$$cache], changeset)
    const {resolvePromise} = require('..')
    object[derived.$$promise] = resolvePromise(result).then(function (value) {
      derived.force(object, value, false)
      return object
    })
    return object[derived.$$promise]
  }
}

DerivedValue.Cached = CachedDerivedValue
DerivedValue.Async = AsyncDerivedValue

module.exports = DerivedValue

const EventEmitter = require('./emitter')
const $$parent = Symbol('parent')
const $$parentProperty = Symbol('parentProperty')

class EmittingArray extends Array {
  static get [Symbol.species] () {
    return EmittingArray
  }

  static create (...args) {
    return Reflect.construct(this, args)
  }

  constructor (...args) {
    super(...args)
    EventEmitter.mixin(this)

    this.destroy = this.destroy.bind(this)
  }

  $setParent (object, name, optional = false) {
    if (this[$$parent] == null) {
      this[$$parent] = object
      this[$$parentProperty] = name
      this[$$parent].$on('destroy', this.destroy)
    } else if (!optional && this[$$parent] !== object) {
      throw new Error('Attempt to bind collection to another parent')
    }
  }

  $unsetParent () {
    if (this[$$parent] != null) {
      this[$$parent].$off('destroy', this.destroy)
      delete this[$$parent]
      return true
    }
  }

  $removeFromParent (parent) {
    if (this[$$parent] === parent) {
      this.$unsetParent()
      this.destroy()
    }
  }

  $didChange (object, event = 'update') {
    if (this.hasOwnProperty($$parent) && this.hasOwnProperty($$parentProperty)) {
      return this.$parent.$performInTransaction(() => {
        this.$parent.$didChange(this[$$parentProperty])
      })
    }
    this.$emit(event, object)
  }

  get $parent () {
    return this[$$parent]
  }

  destroy () {
    this.$maybeEmit('destroy')
    this.$off()
    delete this[$$parent]
  }

  prepareContext (elements, cb) {
    let perform = () => {
      if (typeof elements === 'function') {
        cb = elements
        elements = []
      }
      if (elements.length === 0) {
        return cb(elements)
      }
      let event = {elements, reason: null, canceled: false}
      this.$maybeEmit('adding', event)
      if (!event.canceled) {
        return cb(event.elements)
      } else {
        throw new Error(event.reason)
      }
    }
    if (this.$parent != null) {
      return this.$parent.$performInTransaction(perform)
    } else {
      return perform()
    }
  }

  push (...args) {
    return this.prepareContext(args, (elements) => {
      let result = super.push(...elements)
      this.$maybeEmit('add', elements)
      return result
    })
  }

  unshift (...args) {
    return this.prepareContext(args, (elements) => {
      let result = super.unshift(...elements)
      this.$maybeEmit('add', elements)
      return result
    })
  }

  splice (start, deleteCount, ...newElements) {
    return this.prepareContext(newElements, (newElements) => {
      let removed = []
      if (deleteCount !== 0) {
        if (deleteCount == null) {
          removed = super.slice(start)
        } else {
          removed = super.slice(start, start + deleteCount)
        }
      }
      let result = super.splice(start, deleteCount, ...newElements)
      if (removed.length > 0) {
        this.$maybeEmit('remove', new Array(...removed))
      }
      if (newElements.length > 0) {
        this.$maybeEmit('add', newElements)
      }
      return result
    })
  }

  shift () {
    return this.prepareContext(() => {
      var result = super.shift()
      if (result != null) {
        this.$maybeEmit('remove', [result])
      }
      return result
    })
  }

  pop () {
    return this.prepareContext(() => {
      var result = super.pop()
      if (result != null) {
        this.$maybeEmit('remove', [result])
      }
      return result
    })
  }

  fill (value, start, end) {
    return this.prepareContext([value], (newElements) => {
      let removed = this.slice(start, end)
      let result = super.fill(newElements[0], start, end)
      if (removed.length > 0) {
        this.$maybeEmit('remove', removed)
        this.$maybeEmit('add', newElements)
      }
      return result
    })
  }

  $clear (options) {
    this.operationOptions = options
    let result = this.splice(0, this.length)
    delete this.operationOptions
    return result
  }

  $updateAll (items, options) {
    this.operationOptions = options
    this.splice(0, this.length, ...items)
    delete this.operationOptions
  }

  $maybeEmit (event, elements) {
    this.$emit(`internal:${event}`, elements)
    if (this.operationOptions == null || !this.operationOptions.initializing) {
      if (event === 'remove' || event === 'add') {
        this.$didChange(elements, event)
      } else {
        this.$emit(event, elements)
      }
    }
  }

  get $clean () {
    return new Array(...this)
  }
}

module.exports = EmittingArray

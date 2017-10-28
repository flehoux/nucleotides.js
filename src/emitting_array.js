const EventEmitter = require('./emitter')
const $$parent = Symbol('parent')

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
  }

  $setParent (object) {
    if (this[$$parent] == null) {
      this[$$parent] = object
    } else if (this[$$parent] !== object) {
      throw new Error('Attempt to bind collection to another parent')
    }
  }

  get $parent () {
    return this[$$parent]
  }

  destroy () {
    this.$emit('destroy')
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
      this.$emit('adding', event)
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
      this.$emit('add', elements)
      return result
    })
  }

  unshift (...args) {
    return this.prepareContext(args, (elements) => {
      let result = super.unshift(...elements)
      this.$emit('add', elements)
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
        this.$emit('remove', new Array(...removed))
      }
      if (newElements.length > 0) {
        this.$emit('add', newElements)
      }
      return result
    })
  }

  shift () {
    return this.prepareContext(() => {
      var result = super.shift()
      if (result != null) {
        this.$emit('remove', [result])
      }
      return result
    })
  }

  pop () {
    return this.prepareContext(() => {
      var result = super.pop()
      if (result != null) {
        this.$emit('remove', [result])
      }
      return result
    })
  }

  fill (value, start, end) {
    return this.prepareContext([value], (newElements) => {
      let removed = this.slice(start, end)
      let result = super.fill(newElements[0], start, end)
      if (removed.length > 0) {
        this.$emit('remove', removed)
        this.$emit('add', newElements)
      }
      return result
    })
  }

  $clear () {
    return this.splice(0, this.length)
  }

  $updateAll (items) {
    this.splice(0, this.length, ...items)
  }

  get $clean () {
    return new Array(...this)
  }
}

module.exports = EmittingArray

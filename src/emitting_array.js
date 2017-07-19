const makeEmitter = require('./emitter')

let EmittingArray = function () {}
const $$isAdding = Symbol('isAdding')

Object.assign(EmittingArray, {
  create: function (...args) {
    let newArray = new EmittingArray()
    newArray.push(...args)
    return new Proxy(newArray, this.proxyHandler)
  },
  proxyHandler: {
    deleteProperty: function (target, property) {
      const isInapplicableType = (typeof property !== 'string' && typeof property !== 'number')
      if (isInapplicableType || parseFloat(property).toString() !== property || target[$$isAdding]) {
        delete target[property]
        return true
      }
      delete target[property]
      target.$emit('remove', [target[property]])
      return true
    },
    set: function (target, property, value) {
      const isInapplicableType = (typeof property !== 'string' && typeof property !== 'number')
      if (isInapplicableType || parseFloat(property).toString() !== property || target[$$isAdding]) {
        target[property] = value
        return true
      }
      let oldValue = target[property]
      if (target.indexOf(value) >= 0) {
        target[property] = value
        return true
      }
      let [newValue] = target.prepareElements([value])
      if (newValue !== oldValue) {
        target[property] = newValue
        if (oldValue != null) {
          target.$emit('remove', [oldValue])
        }
        if (newValue != null) {
          target.$emit('add', [newValue])
        }
      }
      return true
    }
  }
})

Object.defineProperty(EmittingArray, Symbol.species, {
  get: function () {
    return EmittingArray
  }
})

EmittingArray.prototype = Object.create(Array.prototype)

Object.assign(EmittingArray.prototype, {
  prepareElements: function (elements) {
    if (elements.length === 0) return elements
    let event = {elements, reason: null, canceled: false}
    this.$emit('adding', event)
    if (!event.canceled) {
      return event.elements
    } else {
      throw new Error(event.reason)
    }
  },

  preventTrigger: function (cb) {
    this[$$isAdding] = true
    let res = cb()
    this[$$isAdding] = false
    return res
  },

  push: function (...args) {
    let elements = this.prepareElements(args)
    let result = this.preventTrigger(() => Array.prototype.push.call(this, ...elements))
    this.$emit('add', elements)
    return result
  },

  unshift: function (...args) {
    let elements = this.prepareElements(args)
    let result = this.preventTrigger(() => Array.prototype.unshift.call(this, ...elements))
    this.$emit('add', elements)
    return result
  },

  splice: function (start, deleteCount, ...newElements) {
    let removed = []
    newElements = this.prepareElements(newElements)
    if (deleteCount !== 0) {
      if (deleteCount == null) {
        removed = this.slice(start)
      } else {
        removed = this.slice(start, start + deleteCount)
      }
    }
    let result = this.preventTrigger(() => Array.prototype.splice.call(this, start, deleteCount, ...newElements))
    if (removed.length > 0) {
      this.$emit('remove', removed)
    }
    if (newElements.length > 0) {
      this.$emit('add', newElements)
    }
    return result
  },

  shift: function () {
    var result = this.preventTrigger(() => Array.prototype.shift.call(this))
    if (result != null) {
      this.$emit('remove', [result])
    }
    return result
  },

  pop: function () {
    var result = this.preventTrigger(() => Array.prototype.pop.call(this))
    if (result != null) {
      this.$emit('remove', [result])
    }
    return result
  },

  fill: function (value, start, end) {
    let newElements = this.prepareElements([value])
    let removed = this.slice(start, end)
    let result = this.preventTrigger(() => Array.prototype.fill.call(this, newElements[0], start, end))
    if (removed.length > 0) {
      this.$emit('remove', removed)
      this.$emit('add', newElements)
    }
    return result
  },

  $clear: function () {
    return this.splice(0, this.length)
  },

  $updateAll: function (items) {
    this.splice(0, this.length, ...items)
  }
})

makeEmitter(EmittingArray.prototype)

module.exports = EmittingArray

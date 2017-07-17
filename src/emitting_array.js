const makeEmitter = require('./emitter')

let EmittingArray = function () {}

Object.assign(EmittingArray, {
  create: function (...args) {
    let newArray = new EmittingArray()
    let proxied = new Proxy(newArray, this.proxyHandler)
    proxied.push(...args)
    return proxied
  },
  proxyHandler: {
    set: function (target, property, value) {
      const isInapplicableType = (typeof property !== 'string' && typeof property !== 'number')
      if (isInapplicableType || parseFloat(property).toString() !== property) {
        target[property] = value
        return true
      }
      let oldValue = target[property]
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

  push: function (...args) {
    let elements = this.prepareElements(args)
    let result = Array.prototype.push.call(this, ...elements)
    this.$emit('add', elements)
    return result
  },

  unshift: function (...args) {
    let elements = this.prepareElements(args)
    let result = Array.prototype.unshift.call(this, ...elements)
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
    let result = Array.prototype.splice.call(this, start, deleteCount, ...newElements)
    if (removed.length > 0) {
      this.$emit('remove', removed)
    }
    if (newElements.length > 0) {
      this.$emit('add', newElements)
    }
    return result
  },

  shift: function () {
    var result = Array.prototype.shift.call(this)
    if (result != null) {
      this.$emit('remove', [result])
    }
    return result
  },

  pop: function () {
    var result = Array.prototype.pop.call(this)
    if (result != null) {
      this.$emit('remove', [result])
    }
    return result
  },

  fill: function (value, start, end) {
    let newElements = this.prepareElements([value])
    let removed = this.slice(start, end)
    let result = Array.prototype.fill.call(this, newElements[0], start, end)
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

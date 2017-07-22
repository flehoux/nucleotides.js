const makeEmitter = require('./emitter')

const $$isAdding = Symbol('isAdding')
const $$array = Symbol('array')
const $$maxLength = Symbol('maxLength')

let EmittingArray = function () {
  this[$$array] = []
  this[$$maxLength] = 0
}

Object.assign(EmittingArray, {
  create: function (...args) {
    let newArray = new EmittingArray()
    makeEmitter(newArray)
    newArray.$on('add', () => { newArray.length = newArray.$safe.length })
    newArray.$on('remove', () => { newArray.length = newArray.$safe.length })
    newArray.push(...args)
    return new Proxy(newArray, this.proxyHandler)
  },
  proxyHandler: {
    deleteProperty: function (target, property) {
      const isInapplicableType = (typeof property !== 'string' && typeof property !== 'number')
      let array
      if (isInapplicableType || parseFloat(property).toString() !== property) {
        delete target[property]
        return true
      }
      array = target[$$array]
      delete array[property]
      target.$emit('remove', [target[property]])
      return false
    },
    set: function (target, property, value) {
      const isInapplicableType = (typeof property !== 'string' && typeof property !== 'number')
      if (isInapplicableType || parseFloat(property).toString() !== property) {
        target[property] = value
        return true
      }
      let oldValue = target[$$array][property]
      if (target[$$array].indexOf(value) >= 0) {
        target[$$array][property] = value
        return true
      }
      let [newValue] = target.prepareElements([value])
      if (newValue !== oldValue) {
        target[$$array][property] = newValue
        if (oldValue != null) {
          target.$emit('remove', [oldValue])
        }
        if (newValue != null) {
          target.$emit('add', [newValue])
        }
      }
      return true
    },
    get: function (target, property) {
      const isInapplicableType = (typeof property !== 'string' && typeof property !== 'number')
      if (isInapplicableType || parseFloat(property).toString() !== property) {
        return target[property]
      } else {
        return target[$$array][property]
      }
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
  [Symbol.iterator]: function () {
    return this[$$array][Symbol.iterator]()
  },

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

  sort: function (...args) {
    this[$$array].sort(...args)
    return this
  },

  indexOf: function (item) {
    return this[$$array].indexOf(item)
  },

  lastIndexOf: function (item) {
    return this[$$array].lastIndexOf(item)
  },

  join: function (delimiter) {
    return this[$$array].join(delimiter)
  },

  preventTrigger: function (cb) {
    this[$$isAdding] = true
    let res = cb()
    this[$$isAdding] = false
    return res
  },

  slice: function (n) {
    return EmittingArray.create(...this[$$array].slice(0))
  },

  push: function (...args) {
    let elements = this.prepareElements(args)
    let result = this[$$array].push(...elements)
    this.$emit('add', elements)
    return result
  },

  unshift: function (...args) {
    let elements = this.prepareElements(args)
    let result = this[$$array].unshift(...elements)
    this.$emit('add', elements)
    return result
  },

  splice: function (start, deleteCount, ...newElements) {
    let removed = []
    newElements = this.prepareElements(newElements)
    if (deleteCount !== 0) {
      if (deleteCount == null) {
        removed = this[$$array].slice(start)
      } else {
        removed = this[$$array].slice(start, start + deleteCount)
      }
    }
    let result = this[$$array].splice(start, deleteCount, ...newElements)
    if (removed.length > 0) {
      this.$emit('remove', removed)
    }
    if (newElements.length > 0) {
      this.$emit('add', newElements)
    }
    return result
  },

  shift: function () {
    var result = this[$$array].shift()
    if (result != null) {
      this.$emit('remove', [result])
    }
    return result
  },

  pop: function () {
    var result = this[$$array].pop()
    if (result != null) {
      this.$emit('remove', [result])
    }
    return result
  },

  fill: function (value, start, end) {
    let newElements = this.prepareElements([value])
    let removed = this.slice(start, end)
    let result = this[$$array].fill(newElements[0], start, end)
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

Object.defineProperties(EmittingArray.prototype, {
  $clean: {
    get: function () {
      return Array.from(this)
    }
  },
  $safe: {
    get: function () {
      return this[$$array]
    }
  },
  length: {
    get: function () {
      return this[$$array].length
    },
    set: function (newLength) {
      if (newLength > this[$$maxLength]) {
        let i = this[$$maxLength]
        while (i < newLength) {
          Object.defineProperty(this, i.toString(), {
            get: function () {
              return this[$$array][i]
            },
            set: function (value) {
              let oldValue = this[$$array][i]
              if (this[$$array].indexOf(value) >= 0) {
                this[$$array][i] = value
                return true
              }
              let [newValue] = this.prepareElements([value])
              if (newValue !== oldValue) {
                this[$$array][i] = newValue
                if (oldValue != null) {
                  this.$emit('remove', [oldValue])
                }
                if (newValue != null) {
                  this.$emit('add', [newValue])
                }
              }
            }
          })
          i = i + 1
        }
        this[$$maxLength] = newLength
      }
    }
  }
})

module.exports = EmittingArray

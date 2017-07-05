const makeEmitter = require('./emitter')

class EmittingArray extends Array {
  static get [Symbol.species] () {
    return EmittingArray
  }

  static create (...args) {
    let newArray = Reflect.construct(this, args)
    return new Proxy(newArray, this.proxyHandler)
  }

  static get proxyHandler () {
    return {
      set: function (target, property, value) {
        if (typeof property !== 'number') {
          target[property] = value
          return true
        }
        let oldValue = target[property]
        value = this.prepareElements([value])[0]
        if (value !== oldValue) {
          target[property] = value
          if (oldValue != null) {
            target.$emit('remove', [oldValue])
          }
          if (value != null) {
            target.$emit('add', [value])
          }
        }
        return true
      }
    }
  }

  prepareElements (elements) {
    if (elements.length === 0) return elements
    let event = {elements, reason: null, canceled: false}
    this.$emit('adding', event)
    if (!event.canceled) {
      return event.elements
    } else {
      throw new Error(event.reason)
    }
  }

  push (...args) {
    let elements = this.prepareElements(args)
    let result = super.push(...elements)
    this.$emit('add', elements)
    return result
  }

  unshift (...args) {
    let elements = this.prepareElements(args)
    let result = super.unshift(...elements)
    this.$emit('add', elements)
    return result
  }

  splice (start, deleteCount, ...newElements) {
    let removed = []
    newElements = this.prepareElements(newElements)
    if (deleteCount !== 0) {
      if (deleteCount == null) {
        removed = this.slice(start)
      } else {
        removed = this.slice(start, start + deleteCount)
      }
    }
    let result = super.splice(start, deleteCount, ...newElements)
    if (removed.length > 0) {
      this.$emit('remove', removed)
    }
    if (newElements.length > 0) {
      this.$emit('add', newElements)
    }
    return result
  }

  shift () {
    var result = super.shift()
    if (result != null) {
      this.$emit('remove', [result])
    }
    return result
  }

  pop () {
    var result = super.pop()
    if (result != null) {
      this.$emit('remove', [result])
    }
    return result
  }

  fill (value, start, end) {
    let newElements = this.prepareElements([value])
    let removed = this.slice(start, end)
    let result = super.fill(newElements[0], start, end)
    if (removed.length > 0) {
      this.$emit('remove', removed)
      this.$emit('add', newElements)
    }
    return result
  }

  clear () {
    return this.splice(0, this.length)
  }
}

makeEmitter(EmittingArray.prototype)

module.exports = EmittingArray

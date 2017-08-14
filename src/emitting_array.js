const makeEmitter = require('./emitter')

class EmittingArray extends Array {
  static get [Symbol.species] () {
    return EmittingArray
  }

  static create (...args) {
    return Reflect.construct(this, args)
  }

  constructor (...args) {
    super(...args)
    makeEmitter(this)
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

  sort (...args) {
    super.sort(...args)
    return this
  }

  indexOf (item) {
    return super.indexOf(item)
  }

  lastIndexOf (item) {
    return super.lastIndexOf(item)
  }

  join (delimiter) {
    return super.join(delimiter)
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

const makeEmitter = require('./emitter')

class EmittingArray extends Array {
  static get [Symbol.species] () {
    return EmittingArray
  }

  static create (...args) {
    let newArray = Reflect.construct(this, args)
    return new Proxy(newArray, {
      set: function (target, property, value) {
        let oldValue = target[property]
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
    })
  }

  push (...args) {
    let result = super.push(...args)
    this.$emit('add', args)
    return result
  }

  unshift (...args) {
    let result = super.unshift(...args)
    this.$emit('add', args)
    return result
  }

  splice (start, deleteCount, ...args) {
    let removed = []
    if (deleteCount !== 0) {
      if (deleteCount == null) {
        removed = this.slice(start)
      } else {
        removed = this.slice(start, start + deleteCount)
      }
    }
    let result = super.splice(start, deleteCount, ...args)
    if (removed.length > 0) {
      this.$emit('remove', removed)
    }
    if (args.length > 0) {
      this.$emit('add', args)
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
    let removed = this.slice(start, end)
    let result = super.fill(value, start, end)
    if (removed.length > 0) {
      this.$emit('remove', removed)
      this.$emit('add', [value])
    }
    return result
  }

  clear () {
    return this.splice(0, this.length)
  }

  pushUnique (...args) {
    for (let item of args) {
      if (this.indexOf(item) === -1) {
        this.push(item)
      }
    }
  }
}

makeEmitter(EmittingArray.prototype)

module.exports = EmittingArray

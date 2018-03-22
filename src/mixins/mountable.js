const $$count = Symbol('mountCount')

module.exports = Base => {
  Base.prototype.$mount = function () {
    if (!this.hasOwnProperty($$count) || this[$$count] === 0) {
      this[$$count] = 1
      this.$emit('mount')
      if (typeof this.constructor.$emit === 'function') {
        this.constructor.$emit('mount', this)
      }
    } else {
      this[$$count] += 1
    }
    return this
  }

  Base.prototype.$unmount = function () {
    if (this.hasOwnProperty($$count)) {
      if (this[$$count] === 1) {
        delete this[$$count]
        this.$emit('unmount')
        if (typeof this.constructor.$emit === 'function') {
          this.constructor.$emit('unmount', this)
        }
      } else if (this[$$count] > 1) {
        this[$$count] -= 1
      }
    }
    return this
  }
}

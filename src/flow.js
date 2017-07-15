module.exports = class Flow {
  constructor (functions, ...args) {
    if (functions == null) {
      throw new Error(`${this.constructor.name} object can't be created without a list of functions as first argument`)
    }
    this.stack = functions
    this.args = args
    this.result = null
  }

  run () {
    if (this.length > 0) {
      return this.head(this, ...this.args)
    }
  }

  next (...args) {
    if (this.last) {
      return null
    } else {
      return this.nextFlow(args).run()
    }
  }

  nextFlow (args) {
    if (args.length === 0) {
      args = this.args
    }
    return new Flow(this.stack.slice(1), ...args)
  }

  get length () {
    return this.stack.length
  }

  get last () {
    return this.length === 1
  }

  get isEmpty () {
    return this.length === 0
  }

  get head () {
    return this.stack[0]
  }
}

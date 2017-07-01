const $$resolver = Symbol('resolve')
const $$rejector = Symbol('reject')
const $$bind = Symbol('bind')
const $$next = Symbol('next')
const $$flow = Symbol('flow')

class Flow {
  constructor (functions, ...args) {
    if (functions == null) {
      throw new Error("A Flow object can't be created without a list of functions as first argument")
    }
    this.stack = functions
    this.args = args
    this.result = null
    this.promise = new Promise((resolve, reject) => {
      this[$$resolver] = resolve
      this[$$rejector] = reject
    })
    .then(value => {
      this.result = {status: Flow.successCode, value: value}
      return value
    })
    .catch(reason => {
      this.result = {status: Flow.errorCode, reason: reason}
      throw reason
    })
    this.promise[$$flow] = this
  }

  static get successCode () {
    return Symbol.for('success')
  }

  static get errorCode () {
    return Symbol.for('error')
  }

  run () {
    if (this.length > 0) {
      let result = this.head(this, ...this.args)
      if (result instanceof Promise) {
        this[$$bind](result)
      }
      return this.promise
    }
  }

  next (...args) {
    if (this.last) {
      return new Promise(function (resolve) { resolve(null) })
    } else {
      let flow = this[$$next](args)
      flow.run()
      return flow.promise
    }
  }

  resolve (value) {
    if (!(value instanceof Promise)) {
      this.result = {status: Flow.successCode, value: value}
    }
    this[$$resolver](value)
  }

  reject (reason) {
    this.result = {status: Flow.errorCode, reason: reason}
    this[$$rejector](reason)
  }

  [$$next] (args) {
    if (args.length === 0) {
      args = this.args
    }
    return new Flow(this.stack.slice(1), ...args)
  }

  [$$bind] (promise) {
    if (this.promise !== promise) {
      if (promise.hasOwnProperty($$flow)) {
        let subflow = promise[$$flow]
        if (subflow.completed) {
          if (subflow.successful) {
            this.resolve(subflow.resolved)
          } else {
            this.reject(subflow.reason)
          }
          return
        }
      }
      promise.then(
        (value) => this.resolve(value),
        (reason) => this.reject(reason)
      )
    }
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

  get completed () {
    return (this.result != null) && (this.result.status !== null)
  }

  get successful () {
    return this.completed && (this.result.status === Flow.successCode)
  }

  get failed () {
    return this.completed && (this.result.status === Flow.errorCode)
  }

  get reason () {
    if (this.failed) {
      return this.result.reason
    }
  }

  get resolved () {
    if (this.successful) {
      return this.result.value
    }
  }
}

module.exports = Flow

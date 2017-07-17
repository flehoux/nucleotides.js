const $$resolver = Symbol('resolve')
const $$rejector = Symbol('reject')
const $$bind = Symbol('bind')
const $$flow = Symbol('flow')

const Flow = require('./flow')

class AsyncFlow extends Flow {
  constructor (functions, ...args) {
    super(functions, ...args)
    this.result = null
    this.promise = new Promise((resolve, reject) => {
      this[$$resolver] = resolve
      this[$$rejector] = reject
    })
    .then(value => {
      this.result = {status: AsyncFlow.successCode, value: value}
      return value
    })
    .catch(reason => {
      this.result = {status: AsyncFlow.errorCode, reason: reason}
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

  continue (...args) {
    if (this.last) {
      return Promise.resolve(null)
    } else {
      let flow = this.nextFlow(args)
      flow.run()
      return flow.promise
    }
  }

  continueAsync (...args) {
    let flow = this
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(flow.continue(...args))
      })
    })
  }

  resolve (value) {
    if (!(value instanceof Promise)) {
      this.result = {status: AsyncFlow.successCode, value: value}
    }
    this[$$resolver](value)
  }

  resolveAsync (value) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(value)
      })
    })
  }

  reject (reason) {
    this.result = {status: AsyncFlow.errorCode, reason: reason}
    this[$$rejector](reason)
  }

  nextFlow (args) {
    if (args.length === 0) {
      args = this.args
    }
    return new AsyncFlow(this.stack.slice(1), ...args)
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

  get completed () {
    return (this.result != null) && (this.result.status !== null)
  }

  get successful () {
    return this.completed && (this.result.status === AsyncFlow.successCode)
  }

  get failed () {
    return this.completed && (this.result.status === AsyncFlow.errorCode)
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

module.exports = AsyncFlow

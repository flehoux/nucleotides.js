const $$resolver = Symbol('resolve')
const $$rejector = Symbol('reject')
const $$flow = Symbol('flow')

const Flow = require('./flow')

function bindToPromise (promise) {
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

function isPromiseLike (arg) {
  if (arg == null) {
    return false
  }
  return ['then', 'catch'].every((name) => typeof arg[name] === 'function')
}

const index = require('..')
const {createPromise, resolvePromise} = index

class AsyncFlow extends Flow {
  constructor (functions, ...args) {
    super(functions, ...args)
    this.result = null
    this.promise = createPromise((resolve, reject) => {
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
    Object.defineProperty(this.promise, '$flow', {
      get: function () { return this[$$flow] }
    })
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
      if (isPromiseLike(result)) {
        bindToPromise.call(this, result)
      }
    } else {
      this[$$resolver]()
    }
    return this.promise
  }

  continue (...args) {
    if (this.last) {
      return resolvePromise(null)
    } else {
      let flow = this.nextFlow(args)
      flow.run()
      return flow.promise
    }
  }

  continueAsync (...args) {
    let flow = this
    return createPromise(function (resolve) {
      setTimeout(function () {
        resolve(flow.continue(...args))
      })
    })
  }

  resolve (value) {
    if (!isPromiseLike(value)) {
      this.result = {status: AsyncFlow.successCode, value: value}
    }
    this[$$resolver](value)
  }

  resolveAsync (value) {
    return createPromise(function (resolve) {
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

const EventEmitter = require('./emitter')
const $$stack = Symbol('stack')

class Transaction {
  constructor (properties, endCb) {
    this._endCb = endCb
    this.attached = []
    if (typeof properties === 'object') {
      for (let key of Object.getOwnPropertyNames(properties)) {
        this[key] = properties[key]
      }
    }
  }
  end () {
    this._endCb(this)
    for (let tx of this.attached) {
      tx.end()
    }
  }
  attach (tx) {
    this.attached.push(tx)
  }
}

class TransactionManager extends EventEmitter {
  constructor () {
    super()
    this[$$stack] = new Set()
  }

  $beforeTransaction (tx) {
    this.$emit('transaction:start', tx)
  }

  $afterTransaction (...rest) {
    this.$emit('transaction:end', ...rest)
  }

  $pushTransaction (properties) {
    let tx = new Transaction(properties, (tx) => {
      this[$$stack].delete(tx)
      if (this[$$stack].size === 0) {
        this.$afterTransaction(tx)
      }
    })
    if (this[$$stack].size === 0) {
      this.$beforeTransaction(tx)
    }
    this[$$stack].add(tx)
    return tx
  }

  $performInTransaction (properties, fn) {
    if (typeof properties === 'function') {
      fn = properties
      properties = {}
    }
    let tx = this.$pushTransaction(properties)
    let res
    try {
      res = fn()
    } catch (err) {
      throw err
    } finally {
      tx.end()
    }
    return res
  }
}

EventEmitter.mixin(TransactionManager, true)

module.exports = TransactionManager

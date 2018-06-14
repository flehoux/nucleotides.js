const BaseEventEmitter = require('wolfy87-eventemitter')
const $$emitter = Symbol('emitter')
const $$bound = Symbol('bound')

class EventEmitter {
  constructor () { this.$prepareEmitter() }
}

const mixin = {
  $emit (name, ...args) {
    this[$$emitter].emit(name, ...args)
  },
  $on (nameOrObject, cb) {
    if (typeof nameOrObject === 'string') {
      cb[$$bound] = cb.bind(this)
      this[$$emitter].addListener(nameOrObject, cb[$$bound])
    } else if (typeof nameOrObject === 'object') {
      for (let eventName in nameOrObject) {
        let cb = nameOrObject[eventName]
        cb[$$bound] = cb.bind(this)
        nameOrObject[eventName] = cb[$$bound]
      }
      this[$$emitter].addListeners(nameOrObject)
    }
  },
  $once (name, cb) {
    cb[$$bound] = cb.bind(this)
    this[$$emitter].addOnceListener(name, cb[$$bound])
  },
  $off (name, cb) {
    if (name == null) {
      this[$$emitter].removeAllListeners()
    } else if (cb == null) {
      this[$$emitter].removeEvent(name)
    } else {
      this[$$emitter].removeListener(name, cb[$$bound])
    }
  },
  $prepareEmitter () {
    if (!this.hasOwnProperty($$emitter)) {
      this[$$emitter] = new BaseEventEmitter()
    }
  },
  $$getEmitter () {
    return this[$$emitter]
  }
}

EventEmitter.mixin = function (object, toClass) {
  if (typeof object === 'function' && toClass !== true) {
    Object.assign(object.prototype, mixin)
  } else if (typeof object === 'object' || toClass === true) {
    Object.assign(object, mixin)
    object.$prepareEmitter()
  }
}

EventEmitter.mixin(EventEmitter)

module.exports = EventEmitter

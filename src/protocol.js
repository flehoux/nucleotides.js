'use strict'

const $$methods = Symbol('methods')
const $$values = Symbol('values')
const $$requirements = Symbol('requirements')
const $$protocols = Symbol.for('protocols')
const $$priority = Symbol.for('priority')

const factory = require('./create')
const makeEmitter = require('./emitter')

class ProtocolError extends Error {
  constructor (message, key) {
    super(message)
    this.key = key
  }
}

function generateProtocol (name) {
  function constructor (data) {
    if (typeof data === 'object') {
      for (let key in data) {
        this[key] = data[key]
      }
    }
  }

  let protocol = factory(name, function (protocol, args) {
    constructor.apply(this, args)
  })

  protocol[$$methods] = {}
  protocol[$$values] = {}
  protocol[$$requirements] = new Set()

  const uniqueKey = Symbol('key')

  Object.defineProperty(protocol, '$$key', {
    value: uniqueKey,
    __proto__: null
  })

  makeEmitter(protocol)
  makeEmitter(protocol.prototype)

  const identity = () => {}

  protocol.requires = function (otherProtocol) {
    protocol[$$requirements].add(otherProtocol)
    return protocol
  }

  protocol.method = function (name, hook = identity) {
    protocol[$$methods][name] = {
      hook,
      protocol,
      symbol: Symbol(`${protocol.name}.${name}`)
    }
    Object.defineProperty(protocol, name, {
      get: function () { return this[$$methods][name] }
    })
    return protocol
  }

  protocol.value = function (name, options, hook = identity) {
    if (typeof options === 'function') {
      hook = options
      options = {}
    }
    if (options == null) {
      options = {}
    }
    protocol[$$values][name] = {
      hook,
      options,
      protocol,
      symbol: Symbol(`Value: ${name}`)
    }
    Object.defineProperty(protocol, name, {
      get: function () { return this[$$values][name] }
    })
    return protocol
  }

  protocol.values = function () {
    return protocol[$$values]
  }

  protocol.hasValueFor = function (object, name) {
    const Model = require('./model')
    if (protocol[$$values][name] == null) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define value ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[$$values][name].symbol] != null
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[$$values][name].symbol] != null
    }
  }

  protocol.valueFor = function (object, name) {
    const Model = require('./model')
    if (protocol[$$values][name] == null) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define value ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[$$values][name].symbol]
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[$$values][name].symbol]
    }
  }

  protocol.hasImplementationsFor = function (object, name) {
    const Model = require('./model')
    if (protocol[$$methods][name] == null) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define method ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[$$methods][name].symbol] != null
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[$$methods][name].symbol] != null
    }
  }

  protocol.implementationsFor = function (object, name) {
    const Model = require('./model')
    if (protocol[$$methods][name] == null) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define method ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[$$methods][name].symbol]
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[$$methods][name].symbol]
    }
  }

  protocol.implementationFor = function (object, name) {
    const Model = require('./model')
    if (protocol[$$methods][name] == null) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define method ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[$$methods][name].symbol][0]
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[$$methods][name].symbol][0]
    }
  }

  protocol.getMiddleware = function (target, name, ...args) {
    const Flow = require('./flow')
    let fns = this.implementationsFor(target, name).map((fn) => fn.bind(target))
    const flow = new Flow(fns, ...args)
    return flow
  }

  protocol.getAsyncMiddleware = function (target, name, ...args) {
    const AsyncFlow = require('./async_flow')
    let fns = this.implementationsFor(target, name).map((fn) => fn.bind(target))
    const flow = new AsyncFlow(fns, ...args)
    return flow
  }

  protocol.call = function (target, name, ...args) {
    this.implementationFor(target, name).call(target, ...args)
  }

  protocol.callAll = function (target, name, ...args) {
    let impls = this.implementationsFor(target, name)
    for (let impl of impls) {
      impl.call(target, ...args)
    }
  }

  protocol.augmentModel = function (model) {
    if (!protocol.supportedBy(model)) {
      for (let requirement of protocol[$$requirements]) {
        requirement.augmentModel(model)
      }
      for (let valueName in protocol.values()) {
        let defaultValue = protocol[valueName].options.default
        if (defaultValue != null) {
          let key = protocol[$$values][valueName].symbol
          model[key] = defaultValue
          protocol[$$values][valueName].hook.call(protocol, model)
        }
      }
      model[$$protocols][protocol.$$key] = Reflect.construct(protocol, [])
      protocol.$emit('implemented', model)
    }
  }

  protocol.supportedBy = function (model) {
    return model[$$protocols][protocol.$$key] != null
  }

  protocol.augmentModelWithValue = function (model, item, value) {
    this.augmentModel(model)
    const {hook, symbol, options} = item
    if (options.accumulate === true) {
      if (model[symbol] == null) {
        model[symbol] = [value]
      } else {
        model[symbol].push(value)
      }
      hook.call(protocol, model, value)
    } else {
      const isNew = model[symbol] == null
      model[symbol] = value
      if (isNew) {
        hook.call(protocol, model, value)
      }
    }
  }

  protocol.augmentModelWithImplementation = function (model, item, fn) {
    this.augmentModel(model)
    const {hook, symbol} = item
    const isNew = model[symbol] == null
    if (isNew) {
      model[symbol] = [fn]
      hook.call(protocol, model)
    } else {
      model[symbol].push(fn)
      model[symbol].sort((a, b) => b[$$priority] - a[$$priority])
    }
  }

  return protocol
}

function Protocol (...args) {
  return generateProtocol(...args)
}

Protocol.Error = ProtocolError

Protocol.augmentModelWithValue = function (model, item, value) {
  const {protocol} = item
  protocol.augmentModelWithValue(model, item, value)
}

Protocol.augmentModelWithImplementation = function (model, item, priority, fn) {
  const {protocol} = item
  if (typeof priority === 'function') {
    fn = priority
    fn[$$priority] = 500
  }
  protocol.augmentModelWithImplementation(model, item, fn)
}

module.exports = Protocol

'use strict'

const $$protocols = Symbol.for('protocols')
const $$delegates = Symbol.for('delegates')
const $$priority = Symbol.for('priority')

const $$methods = Symbol('methods')
const $$values = Symbol('values')
const $$requirements = Symbol('requirements')
const $$supportedBy = Symbol('supportedBy')

const factory = require('./create')
const EventEmitter = require('./emitter')

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
    this.$prepareEmitter()
    constructor.apply(this, args)
  })

  protocol[$$supportedBy] = new Set()
  protocol[$$methods] = new Set()
  protocol[$$values] = new Set()
  protocol[$$requirements] = new Set()

  const uniqueKey = Symbol('key')

  Object.defineProperty(protocol, '$$key', {
    value: uniqueKey,
    __proto__: null
  })

  EventEmitter.mixin(protocol, true)
  EventEmitter.mixin(protocol)

  const identity = () => {}

  protocol.require = function (otherProtocol) {
    protocol[$$requirements].add(otherProtocol)
    return protocol
  }

  protocol.method = function (name, options, hook = identity) {
    let defaultImpl
    if (typeof options === 'function') {
      hook = options
      options = null
    }
    if (options == null) {
      options = {mode: 'single'}
    }
    if (typeof options.whenSet === 'function') {
      hook = options.whenSet
    }
    if (typeof options.default === 'function') {
      defaultImpl = options.default
    }
    let method
    if (options.mode === 'single') {
      method = function (target, ...args) {
        return protocol.call(target, name, ...args)
      }
    } else if (options.mode === 'all') {
      method = function (target, ...args) {
        return protocol.callAll(target, name, ...args)
      }
    } else if (options.mode === 'flow') {
      method = function (target, ...args) {
        return protocol.getMiddleware(target, name, ...args).run()
      }
    } else if (options.mode === 'async_flow') {
      method = function (target, ...args) {
        return protocol.getAsyncMiddleware(target, name, ...args).run()
      }
    }
    Object.assign(method, {
      hook,
      defaultImpl,
      protocol,
      options,
      key: name,
      symbol: Symbol(`${protocol.name}.${name}`),
      flowAll: function (...args) {
        let impls = []
        for (let model of protocol.supportingModels()) {
          for (let impl of protocol.implementationsFor(model, name)) {
            impls.push(impl.bind(model))
          }
        }
        if (options.mode === 'async_flow') {
          const AsyncFlow = require('./async_flow')
          return new AsyncFlow(impls, ...args)
        } else {
          const Flow = require('./flow')
          return new Flow(impls, ...args)
        }
      }
    })
    protocol[$$methods].add(name)
    Object.defineProperty(protocol, name, {value: method, writable: false})
    return protocol
  }

  protocol.value = function (name, options, hook = identity) {
    let defaultValue
    if (typeof options === 'function') {
      hook = options
      options = {}
    }
    if (options == null) {
      options = {}
    }
    if (typeof options.whenSet === 'function') {
      hook = options.whenSet
    }
    if (typeof options.default === 'function') {
      defaultValue = options.default
    }
    let accessor = function (target) {
      return protocol.valueFor(target, name, defaultValue)
    }
    Object.assign(accessor, {
      hook,
      defaultValue,
      options,
      protocol,
      key: name,
      symbol: Symbol(`Value: ${name}`)
    })
    protocol[$$values].add(name)
    Object.defineProperty(protocol, name, {
      value: accessor
    })
    return protocol
  }

  protocol.values = function () {
    return protocol[$$values]
  }

  protocol.methods = function () {
    return protocol[$$methods]
  }

  protocol.supportingModels = function () {
    return protocol[$$supportedBy]
  }

  protocol.modelFor = function (object) {
    const Model = require('./model')
    if (Model.isModel(object)) {
      return object
    } else if (Model.isInstance(object)) {
      return object.constructor
    } else {
      throw new TypeError('Tried to use an object that is neither a nucleotides Model, nor an instance of a Model.', )
    }
  }

  protocol.contextFor = function (target) {
    let model = this.modelFor(target)
    let getter = model[$$delegates][this.$$key]
    if (typeof getter === 'function') {
      return this.contextFor(getter.call(target))
    } else if (typeof getter === 'string') {
      return this.contextFor(target[getter])
    } else {
      return target
    }
  }

  protocol.hasValueFor = function (object, name) {
    if (!protocol[$$values].has(name)) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define value ${name}`, name)
    }
    let context = this.modelFor(this.contextFor(object))
    return context[protocol[name].symbol] != null
  }

  protocol.valueFor = function (object, name, defaultValue) {
    if (!protocol[$$values].has(name)) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define value ${name}`, name)
    }
    let context = this.modelFor(this.contextFor(object))
    if (context.hasOwnProperty(protocol[name].symbol)) {
      return context[protocol[name].symbol]
    }
    return defaultValue
  }

  protocol.hasImplementationsFor = function (object, name) {
    if (!protocol[$$methods].has(name)) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define method ${name}`, name)
    }
    let context = this.modelFor(this.contextFor(object))
    return context[protocol[name].symbol] != null
  }

  protocol.implementationsFor = function (object, name) {
    if (!protocol[$$methods].has(name)) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define method ${name}`, name)
    }
    let impls
    let context = this.modelFor(this.contextFor(object))
    impls = context[protocol[name].symbol]
    if (impls == null || impls.length === 0) {
      if (typeof protocol[name].defaultImpl === 'function') {
        return [protocol[name].defaultImpl]
      }
      throw new ProtocolError(`Model ${context.name} does not implement method ${name} of protocol ${protocol.name}`, name)
    }
    return impls
  }

  protocol.implementationFor = function (object, name) {
    return this.implementationsFor(object, name)[0]
  }

  protocol.getMiddleware = function (target, name, ...args) {
    const Flow = require('./flow')
    const Mixin = require('./mixin')
    let fns
    let context = this.contextFor(target)
    fns = this.implementationsFor(context, name)
    const flow = new Flow(fns.map((fn) => fn.bind(context)), ...args)
    return flow
  }

  protocol.getAsyncMiddleware = function (target, name, ...args) {
    const AsyncFlow = require('./async_flow')
    const Mixin = require('./mixin')
    let fns
    let context
    context = this.contextFor(target)
    fns = this.implementationsFor(context, name)
    const flow = new AsyncFlow(fns.map((fn) => fn.bind(context)), ...args)
    return flow
  }

  protocol.call = function (target, name, ...args) {
    const Mixin = require('./mixin')
    let impl
    let context
    context = this.contextFor(target)
    impl = this.implementationFor(context, name)
    return impl.call(context, ...args)
  }

  protocol.callAll = function (target, name, ...args) {
    const Mixin = require('./mixin')
    let context = this.contextFor(target)
    let impls = this.implementationsFor(context, name)
    for (let impl of impls) {
      if (impl.call(context, ...args) === false) {
        break
      }
    }
  }

  protocol.augmentModel = function (model) {
    if (!protocol.supportedBy(model)) {
      for (let requirement of protocol[$$requirements]) {
        requirement.augmentModel(model)
      }
      for (let valueName of protocol.values()) {
        let defaultValue = protocol[valueName].options.default
        if (defaultValue != null) {
          let key = protocol[valueName].symbol
          model[key] = defaultValue
          protocol[valueName].hook.call(protocol, model)
        }
      }
      protocol[$$supportedBy].add(model)
      model[$$protocols][protocol.$$key] = Reflect.construct(protocol, [])
      protocol.$emit('implement', model)
    }
  }

  protocol.supportedBy = function (object) {
    let context = this.modelFor(this.contextFor(object))
    return context[$$protocols][protocol.$$key] != null
  }

  protocol.delegateOnModel = function (model, getter) {
    model[$$delegates][this.$$key] = getter
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
    priority = null
  }
  fn[$$priority] = priority || 500
  protocol.augmentModelWithImplementation(model, item, fn)
}

module.exports = Protocol

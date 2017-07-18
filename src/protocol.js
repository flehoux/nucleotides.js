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

  protocol[$$methods] = new Set()
  protocol[$$values] = new Set()
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

  protocol.method = function (name, options, hook = identity) {
    if (typeof options === 'function') {
      hook = options
      options = null
    }
    if (options == null) {
      options = {mode: 'single'}
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
      protocol,
      options,
      key: name,
      symbol: Symbol(`${protocol.name}.${name}`)
    })
    protocol[$$methods].add(name)
    Object.defineProperty(protocol, name, {value: method})
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
    let accessor = function (target) {
      const Model = require('./model')
      if (Model.isInstance(target)) {
        return protocol.valueFor(target.constructor, name)
      } else if (Model.isModel(target)) {
        return protocol.valueFor(target, name)
      }
    }
    Object.assign(accessor, {
      hook,
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

  protocol.hasValueFor = function (object, name) {
    const Model = require('./model')
    if (!protocol[$$values].has(name)) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define value ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[name].symbol] != null
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[name].symbol] != null
    }
  }

  protocol.valueFor = function (object, name) {
    const Model = require('./model')
    if (!protocol[$$values].has(name)) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define value ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[name].symbol]
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[name].symbol]
    }
  }

  protocol.hasImplementationsFor = function (object, name) {
    const Model = require('./model')
    if (!protocol[$$methods].has(name)) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define method ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[name].symbol] != null
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[name].symbol] != null
    }
  }

  protocol.hasImplementationFromMixin = function (object, mixin, name) {
    let hasImplementations = this.hasImplementationsFor(object, name)
    if (hasImplementations) {
      let funs = this.implementationsFor(object, name)
      for (let fn of funs) {
        let fnMixin = fn[Symbol.for('mixin')]
        if (fnMixin == null) {
          continue
        } else {
          if (mixin === fnMixin || mixin === fnMixin.constructor) {
            return true
          }
        }
      }
    }
    return false
  }

  protocol.implementationsFor = function (object, name) {
    const Model = require('./model')
    if (!protocol[$$methods].has(name)) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define method ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[name].symbol]
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[name].symbol]
    }
  }

  protocol.implementationFor = function (object, name) {
    const Model = require('./model')
    if (!protocol[$$methods].has(name)) {
      throw new ProtocolError(`Protocol ${protocol.name} does not define method ${name}`, name)
    }
    if (Model.isModel(object)) {
      return object[protocol[name].symbol][0]
    } else if (Model.isInstance(object)) {
      return object.constructor[protocol[name].symbol][0]
    }
  }

  protocol.implementationForMixin = function (target, mixin, name) {
    let funs = this.implementationsFor(target, name)
    for (let fn of funs) {
      let fnMixin = fn[Symbol.for('mixin')]
      if (fnMixin == null) {
        continue
      } else {
        if (mixin === fnMixin || mixin === fnMixin.constructor) {
          return fn
        }
      }
    }
  }

  protocol.getMiddleware = function (target, name, ...args) {
    const Flow = require('./flow')
    const Mixin = require('./mixin')
    let fns
    if (target instanceof Mixin) {
      let mixin = target
      target = name
      name = args[0]
      args = args.slice(1)
      fns = [this.implementationForMixin(target, mixin, name)]
    } else {
      fns = this.implementationsFor(target, name)
    }
    const flow = new Flow(fns.map((fn) => fn.bind(target)), ...args)
    return flow
  }

  protocol.getAsyncMiddleware = function (target, name, ...args) {
    const AsyncFlow = require('./async_flow')
    const Mixin = require('./mixin')
    let fns
    if (target instanceof Mixin) {
      let mixin = target
      target = name
      name = args[0]
      args = args.slice(1)
      fns = [this.implementationForMixin(target, mixin, name)]
    } else {
      fns = this.implementationsFor(target, name)
    }
    const flow = new AsyncFlow(fns.map((fn) => fn.bind(target)), ...args)
    return flow
  }

  protocol.call = function (target, name, ...args) {
    const Mixin = require('./mixin')
    let impl
    if (target instanceof Mixin) {
      let mixin = target
      target = name
      name = args[0]
      args = args.slice(1)
      impl = this.implementationForMixin(target, mixin, name)
    } else {
      impl = this.implementationFor(target, name)
    }
    return impl.call(target, ...args)
  }

  protocol.callAll = function (target, name, ...args) {
    const Mixin = require('./mixin')
    if (target instanceof Mixin) {
      let mixin = target
      target = name
      name = args[0]
      args = args.slice(1)
      this.implementationForMixin(target, mixin, name).call(target, ...args)
    } else {
      let impls = this.implementationsFor(target, name)
      for (let impl of impls) {
        impl.call(target, ...args)
      }
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
          let key = protocol[valueName].symbol
          model[key] = defaultValue
          protocol[valueName].hook.call(protocol, model)
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

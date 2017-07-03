const $$isNew = Symbol('isNew')

function createFlowFor (key, ...args) {
  const Flow = require('./flow')
  return new Flow(this[Storage[key]], ...args)
}

function ensureInstance (response) {
  let value
  if (response instanceof Storage.Success) {
    value = response.result
  } else {
    value = response
  }
  if (!(value instanceof this)) {
    value = Reflect.construct(this, [value])
  }
  if (response instanceof Storage.Success) {
    value.$response = response
  }
  value.$isNew = false
  return value
}

function ensureListOfInstance (response) {
  let result = []
  let values
  if (response instanceof Storage.Success) {
    values = response.result
  } else {
    values = response
  }
  for (let item of values) {
    result.push(ensureInstance.call(this, item))
  }
  if (response instanceof Storage.Success) {
    result.$response = response
  }
  return result
}

function doFindOne (...args) {
  let flow = createFlowFor.call(this, '$$findOne', ...args)
  let promise = flow.run()
  if (flow.successful) {
    let result = ensureInstance.call(this, flow.resolved)
    promise = Promise.resolve(result)
    promise.$result = result
    return promise
  } else {
    return promise.then(ensureInstance.bind(this))
  }
}

function doFindMany (...args) {
  let flow = createFlowFor.call(this, '$$findMany', ...args)
  let promise = flow.run()
  if (flow.successful) {
    let result = ensureListOfInstance.call(this, flow.resolved)
    promise = Promise.resolve(result)
    promise.$result = result
    return promise
  } else {
    return promise.then(ensureListOfInstance.bind(this))
  }
}

function doDelete () {
  return createFlowFor.call(this.constructor, '$$remove', this).run()
}

function doCreate (...args) {
  let options = args.pop()
  if (options.autoSave == null) {
    args.push(options)
    options = {autoSave: true}
  }
  let object = Reflect.construct(this, args)
  if (options.autoSave === true) {
    let promise = object.save().then(function () {
      return object
    })
    promise.$result = object
    return promise
  }
  return object
}

function doSave () {
  let promise = createFlowFor.call(this.constructor, '$$store', this).run()
  return promise.then(() => {
    this.$isNew = false
    this.$emit('saved')
    this.constructor.$emit('saved', this)
  })
}

class Success {
  constructor (code, result, data, origin) {
    this.code = code
    this.result = result
    this.data = data
    this.origin = origin
  }
}

class Failure {
  constructor (code, message, data, origin) {
    this.code = code
    this.message = message
    this.data = data
    this.origin = origin
  }
}

const Storage = {
  Success,
  Failure,
  $$findOne: Symbol.for('findOne'),
  $$findMany: Symbol.for('findMany'),
  $$store: Symbol.for('store'),
  $$remove: Symbol.for('remove'),
  $$operations: [
    Symbol.for('findOne'),
    Symbol.for('findMany'),
    Symbol.for('store'),
    Symbol.for('remove')
  ],

  LOW: 250,
  MEDIUM: 500,
  HIGH: 1000,

  augmentModel: function (klass, operation) {
    var switcher = {
      [Storage.$$findOne]: () => {
        klass.findOne = doFindOne
      },
      [Storage.$$findMany]: () => {
        klass.findMany = doFindMany
      },
      [Storage.$$remove]: () => {
        klass.prototype.remove = doDelete
      },
      [Storage.$$store]: () => {
        klass.create = doCreate
        klass.prototype.save = doSave

        Object.defineProperty(klass.prototype, '$isNew', {
          get: function () {
            return this[$$isNew] == null || this[$$isNew] === true
          },
          set: function (isNew) {
            this[$$isNew] = (isNew === true)
          }
        })
      }
    }
    switcher[operation]()
  }
}

module.exports = Storage

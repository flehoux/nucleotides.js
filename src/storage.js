const $$isNew = Symbol('isNew')

function createFlowFor (fns, ...args) {
  const Flow = require('./flow')
  fns = fns.map((fn) => fn.bind(this))
  return new Flow(fns, ...args)
}

function ensureInstance (response) {
  let value
  if (response instanceof Success) {
    value = response.result
  } else {
    value = response
  }
  if (!(value instanceof this)) {
    value = Reflect.construct(this, [value])
  }
  if (response instanceof Success) {
    value.$response = response
  }
  value.$isNew = false
  return value
}

function ensureListOfInstance (response) {
  const Collection = require('./collection')
  let result = Collection.create(this)
  let values
  if (response instanceof Success) {
    values = response.result
  } else {
    values = response
  }
  result.push(...values)
  if (response instanceof Success) {
    result.$response = response
  }
  return result
}

function doFindOne (...args) {
  let flow = createFlowFor.call(this, this[Storage.$$findOne], ...args)
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
  let flow = createFlowFor.call(this, this[Storage.$$findMany], ...args)
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

function doDelete (...args) {
  return createFlowFor.call(this, this.constructor[Storage.$$remove], ...args).run()
}

function doCreate (...args) {
  let options = args.pop()
  if (options.autoSave == null) {
    args.push(options)
    options = {autoSave: true}
  }
  let object = Reflect.construct(this, args)
  if (options.autoSave === true) {
    let promise = object.save().then(function (resp) {
      return object
    })
    promise.$result = object
    return promise
  }
  return object
}

function doSave (...args) {
  let promise = createFlowFor.call(this, this.constructor[Storage.$$store], ...args).run()
  return promise.then((resp) => {
    this.$isNew = false
    this.$emit('saved')
    this.constructor.$emit('saved', this)

    let res = ensureInstance.call(this.constructor, resp)
    this.$response = res.$response
    return this
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

  $$idKey: Symbol.for('idKey'),
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
  },
  idFor: function (object, defaultKey = 'id') {
    const Model = require('./model')
    if (Model.isInstance(object)) {
      return object[this.idKeyFor(object, defaultKey)]
    }
  },
  idKeyFor: function (object, defaultKey = 'id') {
    const Model = require('./model')
    if (Model.isInstance(object)) {
      return object[this.$$idKey] || object.constructor[this.$$idKey] || defaultKey
    } else if (Model.isModel(object)) {
      return object[this.$$idKey] || defaultKey
    }
  }
}

module.exports = Storage

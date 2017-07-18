const Protocol = require('../protocol')
const Identifiable = require('./identifiable')
const Storable = require('./storable')
const $$isNew = Symbol('isNew')

function ensureInstance (response, model) {
  if (response == null) {
    return
  }
  let value
  const Model = require('../model')
  if (response instanceof Success) {
    value = response.result
  } else {
    throw new Protocol.Error('AsyncFlow did not return a Queryable.Success object')
  }
  if (value == null) {
    return
  }
  if (Model.isModel(model) && !(value instanceof model)) {
    value = Storable.decode(model, value)
  }
  if (Model.isInstance(value)) {
    value.$isNew = false
  }
  if (typeof value === 'object') {
    value.$response = response
  }
  return value
}

function ensureListOfInstance (response, model) {
  const Collection = require('../collection')
  const Model = require('../model')
  let result = Collection.create(model)
  let values
  if (response instanceof Success) {
    values = response.result
  } else {
    throw new Protocol.Error('AsyncFlow did not return a Queryable.Success object')
  }
  if (!Array.isArray(values)) {
    values = []
  }
  values = values.map((value) => {
    if (Model.isModel(model) && !(value instanceof model)) {
      return Storable.decode(model, value)
    } else {
      return value
    }
  })
  result.push(...values)
  result.$response = response
  return result
}

function doFindOne (...args) {
  let promise = Queryable.findOne(this, ...args)
  let flow = promise.$flow
  if (flow.successful) {
    let result = ensureInstance(flow.resolved, this)
    promise = Promise.resolve(result)
    promise.$result = result
    return promise
  } else {
    return promise.then((response) => ensureInstance(response, this))
  }
}

function doFindMany (...args) {
  let promise = Queryable.findMany(this, ...args)
  let flow = promise.$flow
  if (flow.successful) {
    let result = ensureListOfInstance(flow.resolved, this)
    promise = Promise.resolve(result)
    promise.$result = result
    return promise
  } else {
    return promise.then((response) => ensureListOfInstance(response, this))
  }
}

function doDelete (...args) {
  return Queryable.remove(this, ...args)
}

function doCreate (...args) {
  let options = args.pop()
  if (options.autoSave == null) {
    args.push(options)
    options = {autoSave: true}
  }
  let object = Reflect.construct(this, args)
  if (options.autoSave === true) {
    let promise = object.$save().then(function (resp) {
      return object
    })
    promise.$result = object
    return promise
  }
  return object
}

function doSave (...args) {
  let promise = Queryable.store(this, ...args)
  return promise.then((resp) => {
    this.$isNew = false
    this.$emit('saved')
    this.constructor.$emit('saved', this)

    let res = ensureInstance.call(this.constructor, resp)
    if (res != null) {
      this.$response = res.$response
    }
    return this
  })
}

class Success {
  constructor (result, code, data, origin) {
    this.code = code
    this.result = result
    this.data = data
    this.origin = origin
  }
}

class Failure {
  constructor (message, code, data, origin) {
    this.code = code
    this.message = message
    this.data = data
    this.origin = origin
  }
}

const Queryable = Protocol('Queryable')
  .require(Identifiable)
  .method('findOne', {mode: 'async_flow'}, function (model) {
    model.findOne = doFindOne
  })
  .method('findMany', {mode: 'async_flow'}, function (model) {
    model.findMany = doFindMany
  })
  .method('remove', {mode: 'async_flow'}, function (model) {
    model.prototype.$remove = doDelete
  })
  .method('store', {mode: 'async_flow'}, function (model) {
    model.create = doCreate
    model.prototype.$save = doSave
    Object.defineProperty(model.prototype, '$isNew', {
      get: function () {
        return this[$$isNew] == null || this[$$isNew] === true
      },
      set: function (isNew) {
        this[$$isNew] = (isNew === true)
      }
    })
  })

Object.assign(Queryable, {
  Success,
  Failure,

  LOW_PRIORITY: 250,
  MEDIUM_PRIORITY: 500,
  HIGH_PRIORITY: 1000
})

module.exports = Queryable

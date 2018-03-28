const Protocol = require('../protocol')
const Identifiable = require('./identifiable')
const Storable = require('./storable')
const CollectablePromise = require('../collectable_promise')
const $$isNew = Symbol('isNew')
const {rejectPromise, resolvePromise} = require('../..')

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
    throw new Failure('Object not found', 404, response)
  }
  if (Model.isModel(model) && !(value instanceof model)) {
    value = Storable.decode(model, value)
  }
  if (Model.isInstance(value)) {
    value[$$isNew] = false
  }
  if (typeof value === 'object') {
    value.$response = response
  }
  return value
}

function ensureListOfInstance (response, model) {
  const Model = require('../model')
  let result = model.createCollection('array', [])
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
    if (Model.isModel(model)) {
      let object = value
      if (!(object instanceof model)) {
        object = Storable.decode(model, object)
      }
      object[$$isNew] = false
      return object
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
    let result
    try {
      result = ensureInstance(flow.resolved, this)
    } catch (err) {
      return rejectPromise(err)
    }
    promise = resolvePromise(result)
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
    promise = resolvePromise(result)
    promise.$result = result
  } else {
    promise = promise.then((response) => {
      let result = ensureListOfInstance(response, this)
      promise.$result = result
      return result
    })
  }
  return new CollectablePromise(promise, this)
}

function doDelete (...args) {
  return Queryable.remove(this, ...args).then((resp) => {
    this.constructor.$emit('removed', this)
    return resp
  })
}

function doNew (...args) {
  let object = Reflect.construct(this, args)
  object.$isNew = true
  return object
}

function doCreate (...args) {
  let object = this.new(args)
  let promise = object.$save().then(function (resp) {
    return object
  })
  promise.$result = object
  return promise
}

function doSave (...args) {
  let promise = Queryable.store(this, ...args)
  return promise.then((resp) => {
    if (this.$isNew) {
      this.$isNew = false
      this.constructor.$emit('created', this)
    }
    this.$emit('saved')
    this.constructor.$emit('saved', this)

    let res
    if (resp != null) {
      try {
        res = ensureInstance.call(this.constructor, resp)
      } catch (err) {
        if (err instanceof Failure && err.code === 404) {
          return this
        }
        throw err
      }
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
    model.new = doNew
    model.create = doCreate
    model.prototype.$save = doSave
    Object.defineProperty(model.prototype, '$isNew', {
      get: function () {
        return this[$$isNew] === true
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

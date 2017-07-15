const Protocol = require('../protocol')
const Identifiable = require('./identifiable')
const Storable = require('./storable')
const $$isNew = Symbol('isNew')

function ensureInstance (response) {
  let value
  const Model = require('../model')
  if (response instanceof Success) {
    value = response.result
  } else {
    value = response
  }
  if (Model.isModel(this) && !(value instanceof this)) {
    value = Storable.decode(this, value)
  }
  if (response instanceof Success) {
    value.$response = response
  }
  value.$isNew = false
  return value
}

function ensureListOfInstance (response) {
  const Collection = require('../collection')
  const Model = require('../model')
  let result = Collection.create(this)
  let values
  if (response instanceof Success) {
    values = response.result
  } else {
    values = response
  }
  values = values.map(function (value) {
    if (Model.isModel(this) && !(value instanceof this)) {
      return Storable.decode(this, value)
    } else {
      return value
    }
  })
  result.push(...values)
  if (response instanceof Success) {
    result.$response = response
  }
  return result
}

function doFindOne (...args) {
  let flow = Queryable.getAsyncMiddleware(this, 'findOne', ...args)
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
  let flow = Queryable.getAsyncMiddleware(this, 'findMany', ...args)
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
  return Queryable.getAsyncMiddleware(this, 'remove', ...args).run()
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
  let promise = Queryable.getAsyncMiddleware(this, 'store', ...args).run()
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

const Queryable = Protocol('Queryable')
  .requires(Identifiable)
  .method('findOne', function (model) {
    model.findOne = doFindOne
  })
  .method('findMany', function (model) {
    model.findMany = doFindMany
  })
  .method('remove', function (model) {
    model.prototype.$remove = doDelete
  })
  .method('store', function (model) {
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

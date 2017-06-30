const $$isNew = Symbol('isNew')

function createFlowFor (key, ...args) {
  const Model = require('./Model')
  const Flow = require('./flow')
  return new Flow(this[Model[key]], ...args)
}

function ensureInstance (value) {
  if (!(value instanceof this)) {
    value = Reflect.construct(this, [value])
  }
  value.$isNew = false
  return value
}

function ensureListOfInstance (values) {
  let result = []
  for (let item of values) {
    result.push(ensureInstance.call(this, item))
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
  promise.then(() => { this.$isNew = false })
  return promise
}

module.exports = function addStorageCapabilities (klass, operation) {
  let Model = require('./Model')
  var switcher = {
    [Model.$$findOne]: () => {
      klass.findOne = doFindOne
    },
    [Model.$$findMany]: () => {
      klass.findMany = doFindMany
    },
    [Model.$$remove]: () => {
      klass.prototype.remove = doDelete
    },
    [Model.$$store]: () => {
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

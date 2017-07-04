const {Mixin, Storage} = require('../..')
const [GET, POST, PUT, DELETE] = ['GET', 'POST', 'PUT', 'DELETE']

function buildRequest (mixin, method, object) {
  let url
  if (typeof mixin.baseUrl === 'function') {
    url = mixin.baseUrl.call(object, mixin, method)
  } else if (typeof mixin.baseUrl === 'string') {
    if (method !== POST) {
      url = mixin.baseUrl + object[mixin.idKey]
    }
  }
  let options = Object.assign({url, method}, mixin.options)
  return mixin.$http(options)
}

function normalizeAngularResponse (mixin, model, response, generate = false) {
  if (response.status < 400) {
    let result
    if (generate) {
      if (response.data != null && response.data instanceof Array) {
        result = response.data.map((object) => {
          return Reflect.construct(model, [object])
        })
      } else {
        result = Reflect.construct(model, [response.dataa])
      }
    } else {
      result = response.data
    }
    return new Storage.Success(response.status, result, response, mixin)
  } else {
    return new Storage.Failure(response.status, response.data, response, mixin)
  }
}

function store (mixin, flow) {
  if (this.$isNew) {
    buildRequest(mixin, POST, this).then(
      (response) => {
        mixin.flow.resolve(normalizeAngularResponse(mixin, null, response))
      },
      (response) => {
        mixin.flow.reject(normalizeAngularResponse(mixin, null, response))
      }
    )
  } else {
    buildRequest(mixin, PUT, this).then(
      (response) => {
        mixin.flow.resolve(normalizeAngularResponse(mixin, null, response))
      },
      (response) => {
        mixin.flow.reject(normalizeAngularResponse(mixin, null, response))
      }
    )
  }
}

function remove (mixin, flow) {
  buildRequest(mixin, DELETE, this).then(
    (response) => {
      mixin.flow.resolve(normalizeAngularResponse(mixin, null, response))
    },
    (response) => {
      mixin.flow.reject(normalizeAngularResponse(mixin, null, response))
    }
  )
}

function findOne (mixin, flow, arg) {
  if (arg === null) {
    throw new Mixin.Error('You need to provide a key that will be used to find a single object', mixin)
  }
  if (typeof arg === 'number') {
    arg = arg.toString()
  }
  if (typeof arg === 'string' && mixin.idKey) {
    arg = {[mixin.idKey]: arg}
  }
  buildRequest(mixin, GET, arg).then(
    (response) => {
      flow.resolve(normalizeAngularResponse(mixin, this, response, true))
    },
    (response) => {
      flow.reject(normalizeAngularResponse(mixin, this, response))
    }
  )
}

function findMany (mixin, flow, params = {}) {
  let url = mixin.baseUrl
  if (params === null) {
    params = {}
  } else if (typeof params === 'string') {
    url = url + params
  }
  buildRequest(mixin, GET, params, {url}).then(
    (response) => {
      flow.resolve(normalizeAngularResponse(mixin, this, response, true))
    },
    (response) => {
      flow.reject(normalizeAngularResponse(mixin, this, response))
    }
  )
}

module.exports = Mixin('AngularHTTPService')
  .construct(function (options) {
    let {$http, url, id} = options
    if ($http == null || typeof $http !== 'object') {
      throw new Mixin.Error('The AngularHTTPService mixin requires the \'$http\' option', this)
    }
    if (url == null) {
      throw new Mixin.Error('The AngularHTTPService mixin requires the \'url\' option', this)
    } else if (typeof url === 'string') {
      if (url.slice(-1) !== '/') {
        url = url + '/'
      }
      if (id == null) {
        id = 'id'
      }
    }
    this.$http = $http
    this.baseUrl = url
    this.idKey = id
    delete options.$http
    delete options.url
    delete options.id
    this.options = options
  })
  .implement(Storage.$$store, store)
  .implement(Storage.$$remove, remove)
  .implement(Storage.$$findOne, findOne)
  .implement(Storage.$$findMany, findMany)

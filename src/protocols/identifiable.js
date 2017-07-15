const Protocol = require('../protocol')

const Identifiable = Protocol('Identifiable')
  .method('buildUrl')
  .value('idKey', {default: 'id'}, function (klass) {
    Object.defineProperty(klass.prototype, '$id', {
      get: function () {
        return Identifiable.idFor(this)
      }
    })
    Object.defineProperty(klass, '$idKey', {
      get: function () {
        return Identifiable.idKeyFor(this)
      }
    })
  })
  .value('url', function (klass) {
    Object.defineProperty(klass, '$url', {
      get: function () {
        return Identifiable.urlFor(klass)
      }
    })
    Object.defineProperty(klass.prototype, '$url', {
      get: function () {
        return Identifiable.urlFor(this)
      }
    })
  })

Object.assign(Identifiable, {
  isEqual: function (itemA, itemB) {
    if ((itemA == null || itemB == null) && itemA !== itemB) {
      return false
    } else if (itemA.constructor !== itemB.constructor) {
      return false
    } else if (this.hasValueFor(itemA, 'idKey') && this.hasValueFor(itemA, 'idKey')) {
      return this.idFor(itemA) === this.idFor(itemB)
    } else {
      return false
    }
  },
  idFor: function (object, defaultKey = 'id') {
    const Model = require('../model')
    if (Model.isInstance(object)) {
      return object[this.idKeyFor(object, defaultKey)]
    }
  },
  idKeyFor: function (object, defaultKey = 'id') {
    const Model = require('../model')
    if (Model.isInstance(object)) {
      return Identifiable.valueFor(object.constructor, 'idKey')
    } else if (Model.isModel(object)) {
      return Identifiable.valueFor(object, 'idKey')
    }
  },
  urlFor: function (object, method) {
    const url = Identifiable.call(object, 'buildUrl', method)
    if (url != null) {
      return url
    }
    const Model = require('../model')
    if (Model.isInstance(object)) {
      let components = [this.urlFor(object.constructor)]
      if (object.$parent != null && Identifiable.hasValueFor(object.$parent, 'url')) {
        components.unshift(object.$parent.$url)
      }
      if (method !== 'POST') {
        components.push(Identifiable.idFor(object))
      }
      return components.join('/')
    } else {
      let model = object
      let basis = Identifiable.valueFor(model, 'url')
      if (basis == null) {
        throw new Error(`Tried to get URL for model without 'Identifiable.url' set: ${model.name}`)
      }
      return basis
    }
  }
})

module.exports = Identifiable

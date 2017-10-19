const Protocol = require('../protocol')

const Identifiable = Protocol('Identifiable')
  .method('buildUrl')
  .value('idKey', {default: 'id'}, function (klass) {
    Object.defineProperty(klass.prototype, '$id', {
      get: function () {
        return Identifiable.idFor(this)
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
      return object[this.idKey(object, defaultKey)]
    }
  },
  urlFor: function (object, method, value) {
    const Model = require('../model')
    if (Model.isModel(object) && object.implements(Identifiable.buildUrl)) {
      return Identifiable.buildUrl(object, method)
    } else if (Model.isInstance(object) && object.constructor.implements(Identifiable.buildUrl)) {
      return Identifiable.buildUrl(object, method)
    }
    if (Model.isInstance(object)) {
      let components = [this.urlFor(object.constructor)]
      if (object.$parentUrl != null) {
        components.unshift(object.$parentUrl)
      }
      if (method !== 'POST') {
        components.push(encodeURIComponent(Identifiable.idFor(object)))
      }
      if (method === 'POST' && object.id != null) {
        components.push(encodeURIComponent(Identifiable.idFor(object)))
      }
      return components.join('/')
    } else {
      let model = object
      let components = [Identifiable.url(model)]
      if (components[0] == null) {
        throw new Error(`Tried to get URL for model without 'Identifiable.url' set: ${model.name}`)
      }
      if (value != null) {
        components.push(value[Identifiable.idKey(model)])
      }
      return components.join('/')
    }
  }
})

module.exports = Identifiable

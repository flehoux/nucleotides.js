'use strict'

const $$model = Symbol('Model')
const $$map = Symbol('map')
const $$keyGetter = Symbol('keyGetter')

const EmittingArray = require('./emitting_array')
const Model = require('./model')

const $$prepareElement = Symbol.for('Collection.prepareElement')
const $$prepareCollection = Symbol.for('Collection.prepareElement')

class Collection extends EmittingArray {
  static get [Symbol.species] () {
    return Collection
  }

  static get $$prepareElement () {
    return $$prepareElement
  }

  static get $$prepareCollection () {
    return $$prepareCollection
  }

  static create (model, ...args) {
    let newArray = Reflect.construct(this, [])
    newArray.$on('adding', newArray.transformElements)
    newArray.$model = model
    newArray.push(...args)
    return new Proxy(newArray, this.proxyHandler)
  }

  constructor () {
    super()
    this[$$map] = {}
  }

  transformElements (event) {
    let {elements} = event
    let newElements = []
    for (let element of elements) {
      if (!(element instanceof this.$model)) {
        element = Reflect.construct(this.$model, [element])
      }
      let result = this[$$prepareElement](element)
      if (Model.isInstance(result, element.constructor)) {
        element = result
      }
      newElements.push(element)
    }
    event.elements = newElements
  }

  set $model (modelClass) {
    if (this.$model != null) {
      throw new Error("A Collection can't have its associated model changed.")
    }
    if (Model.isModel(modelClass)) {
      this[$$model] = modelClass
      this[$$prepareCollection]()
    }
  }

  get $model () {
    return this[$$model]
  }

  get $byKey () {
    return this[$$map]
  }

  get $clean () {
    let results = []
    for (let item of this) {
      results.push(item.$clean)
    }
    return results
  }

  [$$keyGetter] (object) {
    let idKey = this.$model.$idKey
    return object[idKey]
  }

  [$$prepareCollection] () {
    if (typeof this.$model[$$prepareCollection] === 'function') {
      this.$model[$$prepareCollection].call(this)
    }
    if (this.$model.$idKey != null) {
      this.$on('add', function (elements) {
        for (let element of elements) {
          let key = this[$$keyGetter](element)
          this[$$map][key] = element
        }
      })
      this.$on('remove', function (elements) {
        for (let element of elements) {
          let key = this[$$keyGetter](element)
          delete this[$$map][key]
        }
      })
    }
  }

  [$$prepareElement] (element) {
    if (typeof this.$model[$$prepareElement] === 'function') {
      this.$model[$$prepareElement].call(this, element)
    }
  }

  get (id) {
    if (id != null && typeof id === 'object') {
      id = this[$$keyGetter](id)
    }
    return this[$$map][id]
  }

  has (id) {
    if (id != null && typeof id === 'object') {
      id = this[$$keyGetter](id)
    }
    return this[$$map][id] != null
  }

  replace (object) {
    let existing = this.get(object)
    if (existing != null) {
      let idx = this.indexOf(existing)
      this.splice(idx, 1, object)
    }
  }

  put (object) {
    let existing = this.get(object)
    if (existing != null) {
      let idx = this.indexOf(existing)
      this.splice(idx, 1, object)
    } else {
      this.push(object)
    }
  }

  remove (object) {
    let existing = this.get(object)
    if (existing != null) {
      let idx = this.indexOf(existing)
      this.splice(idx, 1)
    }
  }

  update (object, upsert = false) {
    let existing = this.get(object)
    if (existing != null) {
      if (Model.isInstance(object)) {
        object = object.$clean
      } else {
        existing.$updateAttributes(object)
      }
    } else if (upsert) {
      this.push(object)
    }
  }
}

module.exports = Collection

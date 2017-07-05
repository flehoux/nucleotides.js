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

  constructor () {
    super()
    this[$$map] = {}
  }

  static create (model, ...args) {
    let newArray = Reflect.construct(this, [])
    newArray.$on('adding', newArray.transformElements)
    newArray.model = model
    newArray.push(...args)
    return new Proxy(newArray, this.proxyHandler)
  }

  transformElements (event) {
    let {elements} = event
    let newElements = []
    for (let element of elements) {
      if (element instanceof this.model) {
        this[$$prepareElement](element)
        newElements.push(element)
      } else {
        element = Reflect.construct(this.model, [element])
        this[$$prepareElement](element)
        newElements.push(element)
      }
    }
    event.elements = newElements
  }

  set model (modelClass) {
    if (this.model != null) {
      throw new Error("A Collection can't have its associated model changed.")
    }
    if (Model.isModel(modelClass)) {
      let coll = this
      this[$$model] = modelClass
      this[$$prepareCollection]()
      if (modelClass.$idKey != null) {
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
        var listener = function (object, diff) {
          let idx = coll.indexOf(coll.get(object))
          if (idx >= 0) {
            coll.$emit('change', {[idx]: diff})
          }
        }
        modelClass.$on('change', listener)
        this.$on('unmount', function () {
          modelClass.$off('change', listener)
        })
      }
    }
  }

  get model () {
    return this[$$model]
  }

  get byKey () {
    return this[$$map]
  }

  [$$keyGetter] (object) {
    let idKey = this.model.$idKey
    return object[idKey]
  }

  [$$prepareCollection] () {
    if (typeof this.model[$$prepareCollection] === 'function') {
      this.model[$$prepareCollection].call(this)
    }
  }

  [$$prepareElement] (element) {
    if (typeof this.model[$$prepareElement] === 'function') {
      this.model[$$prepareElement].call(this, element)
    }
  }

  get (id) {
    if (id != null && typeof id === 'object') {
      id = this[$$keyGetter](id)
    }
    return this[$$map][id]
  }

  replace (object) {
    let id = this[$$keyGetter](object)
    let existing = this[$$map][id]
    if (existing != null) {
      let idx = this.indexOf(existing)
      this.splice(idx, 1, object)
    }
  }

  put (object) {
    let id = this[$$keyGetter](object)
    let existing = this[$$map][id]
    if (existing != null) {
      let idx = this.indexOf(existing)
      this.splice(idx, 1, object)
    } else {
      this.push(object)
    }
  }

  remove (object) {
    let id = this[$$keyGetter](object)
    let existing = this[$$map][id]
    if (existing != null) {
      let idx = this.indexOf(existing)
      this.splice(idx, 1)
    }
  }
}

module.exports = Collection

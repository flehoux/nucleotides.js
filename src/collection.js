'use strict'

const $$model = Symbol('Model')
const $$map = Symbol('map')
const $$keyGetter = Symbol('keyGetter')

const EmittingArray = require('./emitting_array')
const Model = require('./model')

class ModelCollection extends EmittingArray {
  static get [Symbol.species] () {
    return ModelCollection
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
        newElements.push(element)
      } else {
        newElements.push(Reflect.construct(this.model, [element]))
      }
    }
    event.elements = newElements
  }

  set model (modelClass) {
    if (this.model != null) {
      throw new Error("A ModelCollection can't have its associated model changed.")
    }
    if (Model.isModel(modelClass)) {
      this[$$model] = modelClass
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

  get (id) {
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

module.exports = ModelCollection

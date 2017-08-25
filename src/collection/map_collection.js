'use strict'

const $$model = Symbol('Model')
const $$map = Symbol.for('map')
const $$key = Symbol('key')
const $$set = Symbol('set')
const $$filters = Symbol('filters')
const $$transforms = Symbol('transforms')

const makeEmitter = require('../emitter')
const Model = require('../model')
const Collectable = require('../protocols/collectable')
const Identifiable = require('../protocols/identifiable')

class MapCollection {
  static create (model, data = {}) {
    let coll = new MapCollection()

    let removeValue = function (target, property) {
      let oldValue = target[property]
      if (oldValue == null) {
        return
      }

      let listenerKey = target.$key
      delete target[property]
      oldValue.$off('change', oldValue[listenerKey])
      delete oldValue[listenerKey]
      target.$emit('remove', {[property]: oldValue})
    }

    let proxy = new Proxy(coll, {
      set: function (target, property, value, receiver) {
        let event = {
          elements: {[property]: value},
          reason: null,
          canceled: false
        }
        target.$emit('adding', event)
        if (!event.canceled) {
          let newValue = event.elements[property]
          let listenerKey = target.$key
          removeValue(target, property)
          target[property] = newValue
          target.$emit('add', {[property]: newValue})
          newValue[listenerKey] = function (diff) {
            target.$emit('change', {[property]: diff})
          }
          newValue.$on('change', newValue[listenerKey])
          return true
        } else {
          throw new Error(event.reason)
        }
      },
      deleteProperty: function (target, property) {
        removeValue(target, property)
        return true
      }
    })

    coll.$model = model
    for (let k of Object.keys(data)) {
      proxy[k] = data[k]
    }
    return proxy
  }

  constructor () {
    this[$$key] = Symbol('key')
    this[$$set] = new Set()
    this[$$filters] = []
    this[$$transforms] = []
    this.$on('add', item => this[$$set].add(item))
    this.$on('remove', item => this[$$set].delete(item))
    this.$on('adding', this.transformElements.bind(this))
  }

  get [$$map] () {
    return this
  }

  get $set () {
    return this[$$set]
  }

  get $key () {
    return this[$$key]
  }

  get $byKey () {
    return this
  }

  get $clean () {
    let results = {}
    for (let key of Object.keys(this)) {
      results[key] = this[key].$clean
    }
    return results
  }

  transformElements (event) {
    let {elements} = event
    let newElements = {}
    for (let key in elements) {
      let element = elements[key]
      if (!(element instanceof this.$model)) {
        element = Reflect.construct(this.$model, [element])
      }
      let result = this.prepareElement(element)
      if (Model.isInstance(result, element.constructor)) {
        element = result
      }
      let shouldAdd = true
      for (let filter of this[$$filters]) {
        if (!filter(element)) {
          shouldAdd = false
          break
        }
      }
      if (!shouldAdd) {
        continue
      }
      for (let transform of this[$$transforms]) {
        element = transform(element)
      }
      newElements[key] = element
    }
    event.elements = newElements
  }

  set $model (modelClass) {
    if (this.$model != null) {
      throw new Error("A Collection can't have its associated model changed.")
    }
    if (Model.isModel(modelClass)) {
      this[$$model] = modelClass
      this.prepareCollection()
    }
  }

  get $model () {
    return this[$$model]
  }

  prepareCollection () {
    if (this.$model.implements(Collectable.prepareCollection)) {
      Collectable.prepareCollection(this.$model, this)
    }
  }

  prepareElement (element) {
    if (this.$model.implements(Collectable.prepareElement)) {
      Collectable.prepareElement(this.$model, this, element)
    }
  }

  $get (id) {
    if (id != null && typeof id === 'object') {
      id = id[Identifiable.idKey(this.$model)]
    }
    return this[id]
  }

  $has (id) {
    if (id != null && typeof id === 'object') {
      id = id[Identifiable.idKey(this.$model)]
    }
    return this[id] != null
  }

  $replace (object) {
    let key = Identifiable.idFor(object)
    if (key != null) {
      this[key] = object
    }
    return this
  }

  $put (object) {
    return this.$replace(object)
  }

  $remove (object) {
    let key = Identifiable.idFor(object)
    if (key != null) {
      delete this[key]
    }
    return this
  }

  $update (object, upsert = false) {
    let existing = this.$get(object)
    if (existing != null) {
      if (Model.isInstance(object)) {
        object = object.$clean
      }
      existing.$updateAttributes(object)
    } else if (upsert) {
      this.$put(object)
    }
    return this
  }

  $updateAll (items) {
    let newKeys = new Set(Object.keys(items))
    let oldKeys = new Set(Object.keys(this))

    let commonKeys = new Set()
    let removedKeys = new Set()
    let addedKeys = new Set()

    for (let key of oldKeys) {
      if (newKeys.has(key)) {
        commonKeys.add(key)
      } else {
        removedKeys.add(key)
      }
    }

    for (let key of newKeys) {
      if (!oldKeys.has(key)) {
        addedKeys.add(key)
      }
    }

    for (let key of commonKeys) {
      this[key].$updateAttributes(items[key])
    }

    for (let key of removedKeys) {
      delete this[key]
    }

    for (let key of addedKeys) {
      this[key] = items[key]
    }
  }

  $addTransform (fn) {
    if (this[$$transforms].indexOf(fn) < 0) {
      this[$$transforms].push(fn)
    }
    return this
  }

  $removeTransform (fn) {
    let indx = this[$$transforms].indexOf(fn)
    if (indx >= 0) {
      this[$$transforms].splice(indx, 1)
    }
    return this
  }

  $addFilter (fn) {
    if (this[$$filters].indexOf(fn) < 0) {
      this[$$filters].push(fn)
    }
    return this
  }

  $removeFilter (fn) {
    let indx = this[$$filters].indexOf(fn)
    if (indx >= 0) {
      this[$$filters].splice(indx, 1)
    }
    return this
  }
}

makeEmitter(MapCollection.prototype)

module.exports = MapCollection

'use strict'

const transformWarnMessage = 'The return of a collection transform was not a model instance, so it was discarded. Please only return model instances from collection transforms.'

const $$model = Symbol('Model')
const $$map = Symbol.for('map')
const $$key = Symbol('key')
const $$filters = Symbol('filters')
const $$transforms = Symbol('transforms')

const EmittingArray = require('../emitting_array')
const Model = require('../model')
const Collectable = require('../protocols/collectable')
const Identifiable = require('../protocols/identifiable')

class ArrayCollection extends EmittingArray {
  static get [Symbol.species] () {
    return ArrayCollection
  }

  static create (model, ...args) {
    let coll = new ArrayCollection()
    coll.$model = model
    coll.push(...args)
    return coll
  }

  constructor (...args) {
    super(...args)
    this[$$key] = Symbol('key')
    this[$$filters] = []
    this[$$transforms] = []
    this.$on('adding', this.transformElements.bind(this))
    this.$on('add', function (elements) {
      let listenerKey = this[$$key]
      for (let element of elements) {
        element[listenerKey] = (diff) => {
          this.$emit('change', {[this.indexOf(element)]: diff})
        }
        element.$on('change', element[listenerKey])
      }
    })
    this.$on('remove', function (elements) {
      let listenerKey = this[$$key]
      for (let element of elements) {
        element.$off('change', element[listenerKey])
      }
    })
    this[$$map] = {}
  }

  slice (n) {
    let newColl = ArrayCollection.create(this.$model)
    newColl.push(...super.slice(n))
    return newColl
  }

  filter (...args) {
    let newColl = ArrayCollection.create(this.$model)
    newColl.push(...super.filter(...args))
    return newColl
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

  transformElements (event) {
    let {elements} = event
    let newElements = []
    for (let element of elements) {
      if (!(element instanceof this.$model)) {
        element = Reflect.construct(this.$model, [element])
      }
      let result = this.prepareElement(element)
      if (Model.isInstance(result, element.constructor)) {
        element = result
      }
      if (!this.$passesFilters(element)) {
        continue
      }
      element = this.$transformElement(element)
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
    if (this.$model.hasValue(Identifiable.idKey)) {
      this.$on('add', function (elements) {
        for (let element of elements) {
          let key = Identifiable.idFor(element)
          this[$$map][key] = element
        }
      })
      this.$on('remove', function (elements) {
        for (let element of elements) {
          let key = Identifiable.idFor(element)
          delete this[$$map][key]
        }
      })
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
    return this[$$map][id]
  }

  $has (id) {
    if (id != null && typeof id === 'object') {
      id = Identifiable.idFor(id)
    }
    return this[$$map][id] != null
  }

  $replace (object) {
    let existing = this.$get(object)
    if (existing != null) {
      let idx = this.indexOf(existing)
      this.splice(idx, 1, object)
    }
    return this
  }

  $put (object) {
    let existing = this.$get(object)
    if (existing != null) {
      let idx = this.indexOf(existing)
      this.splice(idx, 1, object)
    } else {
      this.push(object)
    }
    return this
  }

  $remove (object) {
    let existing = this.$get(object)
    if (existing != null) {
      let idx = this.indexOf(existing)
      this.splice(idx, 1)
    }
    return this
  }

  $update (object, options = {}) {
    let existing = this.$get(object)
    if (existing != null) {
      if (Model.isInstance(object)) {
        object = object.$clean
      }
      existing.$updateAttributes(object, options)
      if (!this.$passesFilters(existing)) {
        this.$remove(existing)
      }
    } else if (options.upsert === true) {
      this.push(object)
    }
    return this
  }

  $updateAll (items, options) {
    let currentItems = this.slice(0)
    let newItems = []
    for (let item of items) {
      let currentItem = this.$get(item)
      if (currentItem != null) {
        let idx = currentItems.indexOf(currentItem)
        currentItems.splice(idx, 1)
        if (Model.isInstance(item)) {
          item = item.$clean
        }
        currentItem.$updateAttributes(item, options)
        idx = items.indexOf(item)
        items.splice(idx, 1, currentItem)
      } else {
        newItems.push(item)
      }
    }
    for (let item of this) {
      let idx = items.indexOf(item)
      if (idx === -1) {
        this.splice(idx, 1)
      }
    }
    this.push(...newItems)
    this.sort(function (a, b) {
      return items.indexOf(a) - items.indexOf(b)
    })
    return this
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

  $transformElement (element) {
    for (let transform of this[$$transforms]) {
      let newElement = transform(element)
      if (Model.isInstance(newElement)) {
        element = newElement
      } else {
        console.warn(transformWarnMessage, newElement, transform)
      }
    }
    return element
  }

  get $transforms () {
    return this[$$transforms].slice(0)
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

  get $filters () {
    return this[$$filters].slice(0)
  }

  $passesFilters (element) {
    let passed = true
    for (let filter of this[$$filters]) {
      if (!filter(element)) {
        passed = false
        break
      }
    }
    return passed
  }
}

module.exports = ArrayCollection

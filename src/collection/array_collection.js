'use strict'

const transformWarnMessage = 'The return of a collection transform was not a model instance, so it was discarded. ' +
  'Please only return model instances from collection transforms.'

const $$model = Symbol('Model')
const $$map = Symbol.for('map')
const $$filters = Symbol('filters')
const $$transforms = Symbol('transforms')

const $$doUpdateAll = Symbol('doUpdateAll')
const $$doUpdate = Symbol('doUpdate')

const EmittingArray = require('../emitting_array')
const Model = require('../model')
const Collectable = require('../protocols/collectable')
const Identifiable = require('../protocols/identifiable')
const get = require('lodash.get')

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
    this[$$filters] = []
    this[$$transforms] = []
    this.$on('adding', this.$$transformElements.bind(this))
    this.$on('add', function (elements) {
      for (let element of elements) {
        element.$addToCollection(this)
      }
    })
    this[$$map] = {}
  }

  slice (n) {
    let newCollection = ArrayCollection.create(this.$model)
    let items = Array.prototype.slice.call(this, n).map(item => item.$clone())
    if (newCollection.$model == null) {
      if (items.length !== 0) {
        newCollection.$model = items[0].constructor
      } else if (this.$model != null) {
        newCollection.$model = this.$model
      }
    }
    newCollection.push(...items)
    return newCollection
  }

  filter (fn, thisArg) {
    let newCollection = ArrayCollection.create(this.$model)
    let items = []
    for (let item of super.filter(fn, thisArg)) {
      items.push(item.$clone())
    }
    newCollection.push(...items)
    for (let filterFn of this.$filters) {
      newCollection.$addFilter(filterFn)
    }
    newCollection.$addFilter(fn)
    return newCollection
  }

  get $byKey () {
    return this[$$map]
  }

  get $clean () {
    let results = []
    for (let item of this) {
      results.push(require('../protocols/storable').encode(item))
    }
    return results
  }

  set $model (modelClass) {
    if (this.$model != null) {
      throw new Error("A Collection can't have its associated model changed.")
    }
    if (Model.isModel(modelClass)) {
      this[$$model] = modelClass
      this.$$prepareCollection()
    }
  }

  get $model () {
    return this[$$model]
  }

  $get (id) {
    if (id != null && typeof id === 'object') {
      id = get(id, Identifiable.idKey(this.$model))
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

  [$$doUpdate] (object, options) {
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

  $update (object, options = {}) {
    if (this.$parent) {
      return this.$parent.$performInTransaction(() => {
        this[$$doUpdate](object, options)
      })
    } else {
      this[$$doUpdate](object, options)
    }
  }

  [$$doUpdateAll] (items, options) {
    if (items.length === 0) {
      if (this.length > 0) {
        this.splice(0, this.length)
      }
      return this
    }
    if (Identifiable.idKey(this.$model) == null) {
      let removed = []
      for (let item of this) {
        if (items.indexOf(item) === -1) {
          removed.push(item)
        }
      }
      for (let item of removed) {
        this.splice(this.indexOf(item), 1)
      }
      for (let item of items) {
        if (this.indexOf(item) === -1) {
          this.push(item)
        }
      }
    } else {
      items = [...items]
      let currentItems = [...this]
      let newItems = []
      for (let item of items) {
        let currentItem = this.$get(item)
        if (currentItem != null) {
          let idx = currentItems.indexOf(currentItem)
          currentItems.splice(idx, 1)
          let newData = (Model.isInstance(item)) ? item.$clean : item
          currentItem.$updateAttributes(newData, options)
          idx = items.indexOf(item)
          items.splice(idx, 1, currentItem)
        } else {
          newItems.push(item)
        }
      }
      for (let item of this) {
        let idx = items.indexOf(item)
        if (idx === -1) {
          this.splice(this.indexOf(item), 1)
        }
      }
      this.push(...newItems)
      let transformedNewItems = this.$$safeSlice(-1 * newItems.length)
      for (let i = 0; i < newItems.length; i++) {
        items.splice(items.indexOf(newItems[i]), 1, transformedNewItems[i])
      }
    }
    this.sort(function (a, b) {
      return items.indexOf(a) - items.indexOf(b)
    })
  }

  $updateAll (items, options) {
    if (this.$parent) {
      this.$parent.$performInTransaction(() => {
        this[$$doUpdateAll](items, options)
      })
    } else {
      this[$$doUpdateAll](items, options)
    }
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

  $$prepareCollection () {
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

  $$transformElements (event) {
    let {elements} = event
    let newElements = []
    for (let element of elements) {
      if (element instanceof this.$model && element.$collection != null && element.$collection !== this) {
        element = element.$clone()
      }
      if (!(element instanceof this.$model)) {
        element = Reflect.construct(this.$model, [element])
      }
      let result = this.$$prepareElement(element)
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

  $$prepareElement (element) {
    if (this.$model.implements(Collectable.prepareElement)) {
      Collectable.prepareElement(this.$model, this, element)
    }
  }

  $$safeSlice (...args) {
    return Array.prototype.slice.call(this, ...args)
  }
}

module.exports = ArrayCollection

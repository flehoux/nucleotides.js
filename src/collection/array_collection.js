'use strict'

const $$model = Symbol('Model')
const $$map = Symbol.for('map')
const $$key = Symbol('key')

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
    this.$on('adding', event => { this.transformElements(event) })
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
    return ArrayCollection.create(this.$model, ...super.slice(0))
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

  $update (object, upsert = false) {
    let existing = this.$get(object)
    if (existing != null) {
      if (Model.isInstance(object)) {
        object = object.$clean
      }
      existing.$updateAttributes(object)
    } else if (upsert) {
      this.push(object)
    }
    return this
  }

  $updateAll (items) {
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
        currentItem.$updateAttributes(item)
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
}

module.exports = ArrayCollection

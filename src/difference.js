const isEqual = require('lodash.isequal')
const $$current = Symbol('current')
const $$changes = Symbol('changes')
const $$difference = Symbol('difference')

class ChangeSet {
  constructor (changes, difference) {
    this[$$changes] = changes
    this[$$difference] = difference
    let keys = new Set()
    for (let [attribute, value] of changes) {
      keys.add(attribute.name)
      Object.defineProperty(this, attribute.name, {
        enumerable: true,
        value: {
          currentValue: value,
          isInitialValue: () => {
            let initialValue = difference.$initialData.get(attribute.$$key)
            return isEqual(initialValue, value)
          }
        }
      })
    }
    Object.defineProperty(this, '$keys', {value: keys})
    Object.defineProperty(this, '$size', {value: keys.size})
  }

  $applyToObject (object, options = {}) {
    object.$performInTransaction(() => {
      for (let [attribute, value] of this[$$changes]) {
        attribute.updateValue(object, value, options)
        if (options.force) {
          object.$didChange(attribute.name)
        }
      }
    })
  }
}

class Difference {
  constructor (object, excluded) {
    const Model = require('./model')
    if (!Model.isInstance(object)) {
      throw new Error('Difference can only be instantiated with a Model instance')
    }

    this.$object = object
    this.$attributesByName = new Map()
    this.$attributesByKey = new Map()
    let initial = new Map()

    for (let name in object.constructor.attributes()) {
      if (Array.isArray(excluded) && excluded.indexOf(name)) continue

      let attribute = object.constructor.attribute(name)
      this.$attributesByName.set(name, attribute)
      this.$attributesByKey.set(attribute.$$key, attribute)
      initial.set(attribute.$$key, attribute.getEncodedValue(object))
    }

    Object.defineProperty(this, '$initialData', {
      configurable: false,
      value: initial
    })

    Object.defineProperty(this, '$delta', {
      configurable: false,
      value: new Map()
    })

    this.$destroyFn = this.$destroy.bind(this)
    this.$object.$on('destroy', this.$destroyFn)
  }

  $compare (forcedChanged) {
    let changes = new Map()
    for (let [key, attribute] of this.$attributesByKey) {
      let currentValue = attribute.getEncodedValue(this.$object)
      if (this.$delta.has(key)) {
        if (isEqual(currentValue, this.$initialData.get(key))) {
          this.$delta.delete(key)
          changes.set(attribute, currentValue)
        } else if (!isEqual(currentValue, this.$delta.get(key))) {
          this.$delta.set(key, currentValue)
          changes.set(attribute, currentValue)
        }
      } else if (!isEqual(currentValue, this.$initialData.get(key))) {
        this.$delta.set(key, currentValue)
        changes.set(attribute, currentValue)
      }
      if (!changes.has(attribute) && forcedChanged && forcedChanged.has(attribute.name)) {
        changes.set(attribute, currentValue)
      }
    }
    if (changes.size > 0) {
      this.$invalidate()
    }
    return new ChangeSet(changes, this)
  }

  $apply (changeset, options) {
    let appliedChanges = changeset[$$changes]
    let changes = new Map()
    for (let [attribute, newValue] of appliedChanges) {
      let key = attribute.$$key
      if (this.$delta.has(key)) {
        if (isEqual(newValue, this.$initialData.get(key))) {
          this.$delta.delete(key)
          changes.set(attribute, newValue)
        } else if (!isEqual(newValue, this.$delta.get(key))) {
          this.$delta.set(key, newValue)
          changes.set(attribute, newValue)
        }
      } else if (!isEqual(newValue, this.$initialData.get(key))) {
        this.$delta.set(key, newValue)
        changes.set(attribute, newValue)
      }
    }
    if (changes.size > 0) {
      this.$invalidate()
    }
    changeset = new ChangeSet(changes, this)
    changeset.$applyToObject(this.$object, options)
    return changeset
  }

  $applyToInitial (changeset, options = {}) {
    if (!(changeset instanceof ChangeSet)) {
      changeset = this.$compareWithInitial(changeset)
    }
    let appliedChanges = changeset[$$changes]
    let changes = new Map()
    for (let [attribute, newValue] of appliedChanges) {
      let key = attribute.$$key
      if (!isEqual(newValue, this.$initialData.get(key))) {
        this.$initialData.set(key, newValue)
        if (!this.$delta.has(key)) {
          changes.set(attribute, newValue)
        }
      }
    }
    if (changes.size > 0) {
      this.$invalidate()
    }
    changeset = new ChangeSet(changes, this)
    options.force = true
    changeset.$applyToObject(this.$object, options)
    for (let attribute of changeset[$$changes].keys()) {
      this.$setInitial(attribute)
    }
    return changeset
  }

  $setInitial (attribute) {
    const newValue = attribute.getEncodedValue(this.$object)
    const key = attribute.$$key
    this.$initialData.set(attribute.$$key, newValue)
    if (isEqual(newValue, this.$initialData.get(key))) {
      this.$delta.delete(key)
    }
    this.$invalidate()
  }

  $invalidate () {
    delete this[$$current]
  }

  $getRevertChangeSet () {
    let changes = new Map()
    for (let key of this.$delta.keys()) {
      changes.set(this.$attributesByKey.get(key), this.$initialData.get(key))
    }
    return new ChangeSet(changes, this)
  }

  $getChangeSet () {
    let changes = new Map()
    for (let [key, value] of this.$delta) {
      changes.set(this.$attributesByKey.get(key), value)
    }
    return new ChangeSet(changes, this)
  }

  $compareWithInitial (newData) {
    let changes = new Map()
    for (let [key, attribute] of this.$attributesByKey) {
      let newValue = newData[attribute.name]
      if (!isEqual(newValue, this.$initialData.get(key))) {
        changes.set(attribute, newValue)
      }
    }
    return new ChangeSet(changes, this)
  }

  get $currentData () {
    if (this[$$current] == null) {
      let current = {}
      for (let [key, attribute] of this.$attributesByKey) {
        if (this.$delta.has(key)) {
          current[attribute.name] = this.$delta.get(key)
        } else {
          current[attribute.name] = this.$initialData.get(key)
        }
      }
      this[$$current] = current
    }
    return this[$$current]
  }

  get $isPristine () {
    return this.$delta.size === 0
  }

  $setPristine () {
    let currentData = this.$currentData
    this.$initialData.clear()
    for (let name in currentData) {
      this.$initialData.set(this.$attributesByName.get(name).$$key, currentData[name])
    }
    this.$delta.clear()
  }

  $destroy () {
    this.$initialData.clear()
    this.$delta.clear()
    this.$object.$off('destroy', this.$destroyFn)
  }
}

module.exports = Difference

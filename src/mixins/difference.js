const {Mixin} = require('../..')
const deepDiff = require('deep-diff')
const cloneDeep = require('lodash.clonedeep')
const $$difference = Symbol('difference')

class Difference {
  constructor (object, excluded) {
    this.$object = object
    this.$excluded = excluded
    Object.defineProperty(this, '$before', {
      configurable: false,
      value: cloneDeep(object.$clean)
    })

    this.$diffs = []
    this.$keys = new Set()
    this.$destroyFn = this.$destroy.bind(this)
    this.$object.$on('destroy', this.$destroyFn)
  }

  $addDiff (diffs) {
    let object = this.$object
    diffs = diffs.filter((diff) => {
      let key = diff.path[0]
      return this.$excluded.indexOf(key) === -1
    })
    for (let diff of diffs) {
      let key = diff.path[0]
      if (!this.$keys.has(key)) {
        this.$keys.add(key)
        Object.defineProperty(this, key, {
          enumerable: true,
          configurable: true,
          get () {
            return object.$clean[key]
          }
        })
      }
    }
    this.$diffs = this.$diffs.concat(diffs)
  }

  get $isPristine () {
    return this.$diffs.length === 0
  }

  get $after () {
    let newData = cloneDeep(this.$before)
    for (let diff of this.$diffs) {
      deepDiff.applyChange(newData, null, diff)
    }
    return newData
  }

  $filter (diffs) {
    return diffs.filter((diff) => !this.$keys.has(diff.path[0]))
  }

  $destroy () {
    for (let key of this.$keys) {
      delete this[key]
    }
    this.$object.$off('destroy', this.$destroyFn)
    delete this.$object
    delete this.$diffs
  }
}

const DifferenceMixin = Mixin('DifferenceMixin')
  .construct(function (options = {}) {
    let {exclude = []} = options
    this.excluded = exclude
  })
  .method('$setPristine', function (mixin) {
    if (this[$$difference] != null) {
      this[$$difference].$destroy()
      delete this[$$difference]
    }
  })
  .derive('$isPristine', function () {
    return this[$$difference] == null || this.$difference.$isPristine
  })
  .derive('$difference', function (mixin) {
    if (this[$$difference] == null) {
      this[$$difference] = new Difference(this, mixin.excluded)
    }
    return this[$$difference]
  })
  .method('$applyDelta', function (mixin, source, delta, skipDifference) {
    if (skipDifference) {
      delta = this.$difference.$filter(delta)
    }

    if (delta.length > 0) {
      let deltaKeys = delta.map((diff) => diff.path[0])
      let changedData = {}
      for (let deltaKey of deltaKeys) {
        changedData[deltaKey] = source.$clean[deltaKey]
      }
      changedData = cloneDeep(changedData)
      for (let diff of delta) {
        deepDiff.applyChange(changedData, null, diff)
      }

      let originalExcluded
      if (skipDifference) {
        // Temporarily exclude changed data keys so the following
        // update doesn't end up polluting $difference
        originalExcluded = this.$difference.$excluded
        this.$difference.$excluded = originalExcluded.concat(deltaKeys)
      }
      this.$updateAttributes(changedData)

      if (skipDifference) {
        // Put back original configured excluded keys
        this.$difference.$excluded = originalExcluded
      }
    }
  })
  .method('$fork', function () {
    let forked = this.$clone(this.$isNew)
    forked.$setPristine()
    let original = this

    Object.defineProperty(forked, '$original', { get () { return original } })
    Object.defineProperty(forked, '$forked', { get () { return true } })

    let applyDeltaFn = function (diff) {
      forked.$applyDelta(this, diff, true)
    }
    let rollbackFn = forked.$rollback.bind(forked)

    this.$on('update', applyDeltaFn)
    this.$on('rollback', rollbackFn)

    forked.$on('destroy', function () {
      original = null
      this.$off('update', applyDeltaFn)
      this.$off('rollback', rollbackFn)
    })

    return forked
  })
  .method('$rollback', function (mixin, originalData) {
    if (originalData == null) {
      originalData = this.$difference.$before
    }
    this.$emit('rollback', originalData)
    this.$updateAttributes(originalData, {})
    this.$setPristine()
  })
  .method('$commitChanges', function () {
    if (this.$original != null || !this.$isPristine) {
      this.$original.$applyDelta(this, this.$difference.$diffs)
      this.$setPristine()
    }
  })

DifferenceMixin.$on('use', function (mixin, model) {
  model.$on('new', (object) => object.$setPristine())
  model.$on('saved', (object) => object.$setPristine())
  model.$on('update', function (object, diff) {
    object.$difference.$addDiff(diff)
  })
})

module.exports = DifferenceMixin

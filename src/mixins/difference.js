const {Mixin} = require('../..')
const $$difference = Symbol('difference')
const $$discardFn = Symbol('discard')

const DifferenceMixin = Mixin('DifferenceMixin')
  .construct(function (options = {}) {
    let {exclude = []} = options
    this.excluded = exclude
  })
  .method('$setPristine', function () {
    this[$$difference] = {}
  })
  .method('$fork', function () {
    let forked = this.$clone(this.$isNew)
    let original = this
    Object.defineProperty(forked, '$original', { get () { return original } })
    Object.defineProperty(forked, '$forked', { get () { return true } })
    let cb = function (diff) {
      let changes = {}
      for (let key in diff) {
        if (!forked.$difference.hasOwnProperty(key)) {
          changes[key] = this.$clean[key]
        }
      }
      forked.$updateAttributes(changes, {broadcasted: true})
    }
    this.$on('change', cb)
    forked[$$discardFn] = () => {
      original = null
      this.$off('change', cb)
      delete this[$$discardFn]
    }
    return forked
  })
  .method('$discard', function () {
    if (typeof this[$$discardFn] === 'function') {
      this[$$discardFn]()
    }
  })
  .method('$rollback', function () {
    this.$updateAttributes(this.$original.$clean, {broadcasted: true})
    this.$setPristine()
  })
  .method('$commitChanges', function () {
    if (this.$original != null || !this.$isPristine) {
      let changes = {}
      for (let key in this.$difference) {
        changes[key] = this.$clean[key]
      }
      this.$original.$updateAttributes(changes)
      this.$setPristine()
    }
  })
  .derive('$isPristine', function () {
    return Object.keys(this[$$difference]).length === 0
  })
  .derive('$difference', function () {
    if (this[$$difference] == null) {
      this[$$difference] = {}
    }
    return this[$$difference]
  })

DifferenceMixin.prototype.mergeDifference = function (model, object, difference, delta, options) {
  let excluded = this.excluded
  if (options != null && options.broadcasted === true) {
    return
  }
  for (let attrName of excluded) {
    delete delta[attrName]
  }
  for (let key in delta) {
    difference[key] = model.attribute(key).getEncodedValue(object)
  }
}

DifferenceMixin.$on('use', function (mixin, model) {
  model.$on('new', (object) => object.$setPristine())
  model.$on('saved', (object) => object.$setPristine())
  model.$on('change', function (object, diff, options) {
    mixin.mergeDifference(this, object, object.$difference, diff, options)
  })
})

module.exports = DifferenceMixin

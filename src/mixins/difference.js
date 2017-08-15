const {Mixin} = require('../..')
const $$difference = Symbol('difference')

const DifferenceMixin = Mixin('DifferenceMixin')
  .construct(function (options = {}) {
    let {exclude = []} = options
    this.excluded = exclude
  })
  .method('$setPristine', function () {
    this[$$difference] = {}
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

DifferenceMixin.prototype.mergeDifference = function (model, object, previousDifference, diff, options) {
  let excluded = this.excluded
  if (options != null && options.broadcasted === true) {
    return
  }
  for (let attrName of excluded) {
    delete diff[attrName]
  }
  for (let key in diff) {
    let attribute = model.attribute(key)
    if (attribute.collection) {
      previousDifference[key] = object[key].$clean
    } else {
      if (attribute.isModel) {
        previousDifference[key] = object[key].$clean
      } else {
        previousDifference[key] = diff[key]
      }
    }
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

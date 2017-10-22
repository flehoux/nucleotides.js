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

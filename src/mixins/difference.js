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
  .method('$rollback', function () {
    let oldValues = {}
    for (let key in this[$$difference]) {
      oldValues[key] = this[$$difference][key]['oldValue']
    }
    this.$updateAttributes(oldValues)
    this.$setPristine()
  })

DifferenceMixin.prototype.createDifference = function (model, object, previousDifference, diff) {
  let excluded = this.excluded
  for (let attrName of excluded) {
    delete diff[attrName]
  }
  for (let key in diff) {
    if (previousDifference[key] == null) {
      let attribute = model.attribute(key)
      previousDifference[key] = {}
      if (attribute.collection) {
        previousDifference[key]['oldValue'] = diff[key].$clean
      } else if (attribute.isModel) {
        previousDifference[key]['oldValue'] = diff[key].$clean
      } else {
        previousDifference[key]['oldValue'] = diff[key]
      }
    }
  }
}

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
    if (previousDifference[key] == null) {
      previousDifference[key] = {}
    }
    if (attribute.collection) {
      previousDifference[key]['newValue'] = object[key].$clean
    } else if (attribute.isModel) {
      previousDifference[key]['newValue'] = object[key].$clean
    } else {
      previousDifference[key]['newValue'] = diff[key]
    }
  }
}

DifferenceMixin.$on('use', function (mixin, model) {
  model.$on('new', (object) => object.$setPristine())
  model.$on('saved', (object) => object.$setPristine())
  model.$on('willChange', function (object, diff) {
    mixin.createDifference(this, object, object.$difference, diff)
  })
  model.$on('change', function (object, diff, options) {
    mixin.mergeDifference(this, object, object.$difference, diff, options)
  })
})

module.exports = DifferenceMixin

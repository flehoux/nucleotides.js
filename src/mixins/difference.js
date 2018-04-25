const {Mixin} = require('../..')
const $$skippingRebound = Symbol('skippingRebound')

const DifferenceMixin = Mixin('DifferenceMixin')
  .method('$fork', function () {
    let forked = this.$clone(this.$isNew)
    let original = this

    forked.$startTracking()
    original.$startTracking()

    Object.defineProperties(forked, {
      $original: {
        get () { return original }
      },
      $forked: {
        get () { return original != null }
      }
    })

    let applyDeltaFn = function (changeset) {
      if (original != null && changeset.$size > 0 && forked[$$skippingRebound] !== true) {
        forked.$difference.$applyToInitial(changeset)
      }
    }

    this.$on('update', applyDeltaFn)

    forked.$on('destroy', function () {
      original = null
      this.$off('update', applyDeltaFn)
    })

    return forked
  })
  .method('$commitChanges', function (mixin, applyToInitial = false) {
    if (this.$original != null || !this.$isPristine) {
      let changeset = this.$difference.$getChangeSet()
      if (changeset.$size > 0) {
        this[$$skippingRebound] = true
        if (applyToInitial) {
          this.$original.$difference.$applyToInitial(changeset)
        } else {
          changeset.$applyToObject(this.$original)
        }
        delete this[$$skippingRebound]
      }
      this.$difference.$setPristine()
    }
    return this
  })

module.exports = DifferenceMixin

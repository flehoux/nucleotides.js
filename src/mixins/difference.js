const {Mixin} = require('../..')

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
        get () { return true }
      }
    })

    let applyDeltaFn = function (changeset) {
      if (original != null && changeset.$size > 0) {
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
  .method('$commitChanges', function () {
    if (this.$original != null || !this.$isPristine) {
      let changeset = this.$difference.$getChangeSet()
      if (changeset.$size > 0) {
        changeset.$applyToObject(this.$original)
      }
    }
    return this
  })

module.exports = DifferenceMixin

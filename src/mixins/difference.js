const {Mixin} = require('../..')

const DifferenceMixin = Mixin('DifferenceMixin')
  .method('$fork', function () {
    let forked = this.$clone(this.$isNew)
    let original = this

    Object.defineProperty(forked, '$original', { get () { return original } })
    Object.defineProperty(forked, '$forked', { get () { return true } })

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
  .method('$rollback', function (mixin) {
    let changeset = this.$difference.$getRevertChangeSet()
    changeset.$applyToObject(this)
    return this
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

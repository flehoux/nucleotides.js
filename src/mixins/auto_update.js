const {Mixin} = require('../..')
const Identifiable = require('../protocols/identifiable')
const Collectable = require('../protocols/collectable')

const $$autoUpdating = Symbol('autoUpdating')
const $$eventKey = 'autoUpdate'

function autoUpdateObject (mixin, conditional) {
  if (this[$$autoUpdating] != null) {
    this.$model.$off($$eventKey, this[$$autoUpdating])
  }
  let listen
  let self = this
  if (typeof conditional === 'function') {
    listen = function (committed) {
      if (self === committed) {
        return
      }
      let clean = committed.$clean
      let response = conditional.call(self, clean)
      if (response === true) {
        self.$updateAttributes(clean, {broadcasted: true})
      } else if (response != null && typeof response.then === 'function') {
        response.then((resolved) => {
          if (resolved === true) {
            self.$updateAttributes(clean, {broadcasted: true})
          }
        })
      }
    }
  } else {
    listen = function (committed) {
      if (self === committed) {
        return
      }
      self.$updateAttributes(committed.$clean, {broadcasted: true})
    }
  }
  let eventKey = mixin.eventKey(this)
  this.constructor.$on(eventKey, listen)
  this[$$autoUpdating] = listen
  return () => {
    this.constructor.$off(eventKey, listen)
    delete this[$$autoUpdating]
  }
}

function autoUpdateCollection (mixin) {
  if (this[$$autoUpdating] != null) {
    this.$model.$off($$eventKey, this[$$autoUpdating])
  }
  let collection = this
  let listen = function (operation, source) {
    let localCopy = collection.$get(source)
    if (localCopy === source) {
      return
    }
    switch (operation) {
      case 'saved':
      case 'created':
        if (typeof collection.matches === 'function') {
          if (collection.matches(source)) {
            collection.$update(source.$clean, {broadcasted: true, upsert: true})
          } else {
            collection.$remove(localCopy)
          }
        } else {
          collection.$update(source.$clean, {broadcasted: true, upsert: true})
        }
        break

      case 'removed':
        collection.$remove(localCopy)
        break
    }
  }
  this.$model.$on($$eventKey, listen)
  this[$$autoUpdating] = listen
  return () => {
    this.$model.$off($$eventKey, listen)
    delete this[$$autoUpdating]
  }
}

const AutoUpdateMixin = Mixin('AutoUpdateMixin')
  .require(Identifiable)
  .implement(Collectable.prepareCollection, function (mixin, coll) {
    coll.$on('mount', function (options = {}) {
      if (options.autoUpdate !== false && !coll.$isAutoUpdating) {
        let deregister = coll.$autoUpdate(options.autoUpdate)
        coll.$once('unmount', deregister)
      }
    })
    coll.$autoUpdate = function (conditional) {
      return autoUpdateCollection.call(this, mixin, conditional)
    }
    Object.defineProperty(coll, '$isAutoUpdating', {
      get: function () { return this[$$autoUpdating] != null }
    })
  })
  .method('$autoUpdate', autoUpdateObject)
  .derive('$isAutoUpdating', function () {
    return this[$$autoUpdating] != null
  })

AutoUpdateMixin.$on('use', function (mixin, model) {
  model.$on('saved', function (object) {
    object.constructor.$emit(mixin.eventKey(object), object)
    object.constructor.$emit($$eventKey, 'saved', object)
  })
  model.$on('removed', function (object) {
    object.constructor.$emit($$eventKey, 'removed', object)
  })
  model.$on('created', function (object) {
    object.constructor.$emit($$eventKey, 'created', object)
  })
  model.$on('mount', function (object, options = {}) {
    if (options.autoUpdate !== false) {
      let deregister = object.$autoUpdate(options.autoUpdate)
      object.$once('unmount', deregister)
    }
  })
})

AutoUpdateMixin.prototype.eventKey = function (object) {
  return `${$$eventKey}(${Identifiable.idFor(object)})`
}

module.exports = AutoUpdateMixin

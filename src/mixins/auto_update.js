const {Mixin, Storage, Collection} = require('../..')

const $$autoUpdating = Symbol('autoUpdating')
const $$eventKey = 'autoUpdate'

function autoUpdateObject (mixin, conditional) {
  if (this[$$autoUpdating]) {
    return
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
        self.$updateAttributes(clean)
      } else if (response != null && typeof response.then === 'function') {
        response.then((resolved) => {
          if (resolved === true) {
            self.$updateAttributes(clean)
          }
        })
      }
    }
  } else {
    listen = function (committed) {
      if (self === committed) {
        return
      }
      self.$updateAttributes(committed.$clean)
    }
  }
  let eventKey = mixin.eventKey(this)
  this.constructor.$on(eventKey, listen)
  this[$$autoUpdating] = true
  return () => {
    this.constructor.$off(eventKey, listen)
    delete this[$$autoUpdating]
  }
}

function autoUpdateCollection (mixin, conditional) {
  if (this.$isAutoUpdating) {
    return 1
  }
  let collection = this
  let listen
  if (typeof conditional === 'function') {
    listen = function (source) {
      let destination = collection.get(source)
      if (destination === source || destination == null) {
        return
      }
      let clean = source.$clean
      let response = conditional.call(collection, destination, clean)
      if (response === true) {
        destination.$updateAttributes(clean)
      } else if (response != null && typeof response.then === 'function') {
        response.then((resolved) => {
          if (resolved === true) {
            destination.$updateAttributes(clean)
          }
        })
      }
    }
  } else {
    listen = function (source) {
      if (collection.get(source) === source) {
        return
      }
      collection.update(source.$clean, false)
    }
  }
  this.$model.$on($$eventKey, listen)
  this[$$autoUpdating] = true
  return () => {
    this.$model.$off($$eventKey, listen)
    delete this[$$autoUpdating]
  }
}

function prepareCollection (mixin) {
  let coll = this
  coll.$on('mount', function (options) {
    if (options.autoUpdate !== false && !coll.$isAutoUpdating) {
      let deregister = coll.$autoUpdate(options.autoUpdate)
      coll.$once('unmount', deregister)
    }
  })
  coll.$autoUpdate = function (conditional) {
    return autoUpdateCollection.call(this, mixin, conditional)
  }
  Object.defineProperty(coll, '$isAutoUpdating', {
    get: function () { return this[$$autoUpdating] === true }
  })
}

function emitAutoUpdate (mixin, flow) {
  this.constructor.$emit(mixin.eventKey(this), this)
  this.constructor.$emit($$eventKey, this)
  return flow.next()
}

const AutoUpdateMixin = Mixin('AutoUpdateMixin')
  .implement(Storage.$$store, 2000, emitAutoUpdate)
  .implement(Collection.$$prepareCollection, prepareCollection)
  .method('$autoUpdate', autoUpdateObject)
  .derive('$isAutoUpdating', function () {
    return this[$$autoUpdating] === true
  })

AutoUpdateMixin.$on('use', function (mixin, model) {
  const Storage = require('../storage')
  if (!model.didSet(Storage.$$idKey) && model.attributes().id == null) {
    throw new Mixin.Error('The AutoUpdate mixin requires the receiving model to set `Storage.$$idKey` or have an \'id\' attribute', this)
  }
  model.$on('mount', function (object, options) {
    if (options.autoUpdate !== false && !object.$isAutoUpdating) {
      let deregister = object.$autoUpdate(options.autoUpdate)
      object.$once('unmount', deregister)
    }
  })
})

AutoUpdateMixin.prototype.eventKey = function (object) {
  const Storage = require('../storage')
  return `${$$eventKey}(${Storage.idFor(object)})`
}

module.exports = AutoUpdateMixin

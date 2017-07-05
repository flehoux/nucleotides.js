const {Mixin, Storage, Collection} = require('../..')

const $$autoUpdating = Symbol('autoUpdating')

function autoUpdateObject (mixin, conditional) {
  if (this[$$autoUpdating]) {
    return
  }
  let listen
  let self = this
  if (typeof conditional === 'function') {
    listen = function (committed) {
      if (self === committed) return
      let clean = committed.clean
      let response = conditional.call(self, clean)
      if (response === true) {
        if (response) {
          self.$updateAttributes(clean)
        }
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
      if (self === committed) return
      self.$updateAttributes(committed.clean)
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
  if (this[$$autoUpdating]) {
    return
  }
  let listen
  let self = this
  if (typeof conditional === 'function') {
    listen = function (committed) {
      if (self === committed) return
      let clean = committed.clean
      let response = conditional.call(self, clean)
      if (response === true) {
        if (response) {
          self.replace(clean)
        }
      } else if (response != null && typeof response.then === 'function') {
        response.then((resolved) => {
          if (resolved === true) {
            self.replace(clean)
          }
        })
      }
    }
  } else {
    listen = function (committed) {
      if (self === committed) return
      self.replace(committed.clean)
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

function emitAutoUpdate (mixin, flow) {
  this.constructor.$emit(mixin.eventKey(this), this)
  this.constructor.$emit('AutoUpdate.emit', this)
  return flow.next()
}

const AutoUpdateMixin = Mixin('AutoUpdateMixin')
  .implement(Storage.$$store, 2000, emitAutoUpdate)
  .implement(Collection.$$prepareCollection, function (mixin, flow) {
    let coll = this
    coll.$on('mount', function (object, options) {
      let deregister = coll.autoUpdate(options.autoUpdate)
      coll.$on('unmount', deregister)
    })
    coll.autoUpdate = autoUpdateCollection
  })
  .derive('$isAutoUpdating', function () {
    return this[$$autoUpdating] === true
  })
  .method('autoUpdate', autoUpdateObject)

AutoUpdateMixin.$on('use', function (mixin, model) {
  if (model.$idKey == null) {
    throw new Mixin.Error('The AutoUpdate mixin requires the receiving model to set `$idKey`', this)
  }
  model.$on('mount', function (object, options) {
    let deregister = object.autoUpdate(options.autoUpdate)
    object.$on('unmount', deregister)
  })
})

AutoUpdateMixin.prototype.eventKey = function (object) {
  let idValue = object[object.constructor.$idKey]
  return `AutoUpdate.emit(${idValue})`
}

module.exports = AutoUpdateMixin

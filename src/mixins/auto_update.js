const {Mixin, Storage, Collection} = require('../..')

const $$autoUpdating = Symbol('autoUpdating')
const $$globalEventKey = 'autoUpdate'

function autoUpdateObject (mixin, conditional) {
  if (this[$$autoUpdating]) {
    return
  }
  let listen
  let self = this
  if (typeof conditional === 'function') {
    listen = function (committed) {
      if (self === committed) return
      let clean = committed.$clean
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
  if (this[$$autoUpdating]) {
    return
  }
  let listen
  let self = this
  if (typeof conditional === 'function') {
    listen = function (committed) {
      if (self === committed) return
      let clean = committed.$clean
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
      self.replace(committed.$clean)
    }
  }
  this.constructor.$on($$globalEventKey, listen)
  this[$$autoUpdating] = true
  return () => {
    this.constructor.$off($$globalEventKey, listen)
    delete this[$$autoUpdating]
  }
}

function prepareCollection (mixin, flow) {
  let coll = this
  coll.$on('mount', function (options) {
    if (options.autoUpdate !== false && !coll.$isAutoUpdating) {
      let deregister = coll.$autoUpdate(options.autoUpdate)
      coll.$once('unmount', deregister)
    }
  })
  coll.$autoUpdate = autoUpdateCollection
  Object.defineProperty(coll, '$isAutoUpdating', {
    get: function () {
      return this[$$autoUpdating] === true
    }
  })
}

function emitAutoUpdate (mixin, flow) {
  this.constructor.$emit(mixin.eventKey(this), this)
  this.constructor.$emit($$globalEventKey, this)
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
  if (model.$idKey == null) {
    throw new Mixin.Error('The AutoUpdate mixin requires the receiving model to set `$idKey`', this)
  }
  model.$on('mount', function (object, options) {
    if (options.autoUpdate !== false && !object.$isAutoUpdating) {
      let deregister = object.$autoUpdate(options.autoUpdate)
      object.$once('unmount', deregister)
    }
  })
})

AutoUpdateMixin.prototype.eventKey = function (object) {
  let idValue = object[object.constructor.$idKey]
  return `${$$globalEventKey}(${idValue})`
}

module.exports = AutoUpdateMixin

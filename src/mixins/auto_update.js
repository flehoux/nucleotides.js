const {Mixin, Storage} = require('../..')

const AutoUpdateMixin = Mixin('AutoUpdateMixin')
  .construct(function (options = {}) {
    this.idKey = options.id
    if (this.idKey == null) {
      throw new Mixin.Error('The AutoUpdate mixin requires a `id` option', this)
    }
    delete options.id
    this.options = options
  })
  .implement(Storage.$$store, 2000, function (mixin, flow, object) {
    object.constructor.$emit(mixin.eventKey(object), object)
    return flow.next()
  })
  .method('autoUpdate', function (mixin, conditional) {
    let listen
    let self = this
    if (typeof conditional === 'function') {
      listen = function (committed) {
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
        self.$updateAttributes(committed.clean)
      }
    }
    let eventKey = mixin.eventKey(this)
    this.constructor.$on(eventKey, listen)
    return () => {
      this.constructor.$off(eventKey, listen)
    }
  })

AutoUpdateMixin.prototype.eventKey = function (object) {
  let idValue = object[this.idKey]
  return `AutoUpdate(${idValue})`
}

module.exports = AutoUpdateMixin

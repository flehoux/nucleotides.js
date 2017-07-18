const Protocol = require('../protocol')

const Storable = Protocol('Storable')
  .value('storageName')
  .method('encoder', {mode: 'flow'}, function (model) {
    model.prototype.$encode = function (options = {}) {
      return Storable.encode(this, options)
    }
  })
  .method('decoder', {mode: 'flow'}, function (model) {
    model.$decode = function (data, options = {}) {
      return Storable.decode(this, data, options)
    }
  })
  .method('migrate')

Object.assign(Storable, {
  decode: function (model, data, options) {
    if (model.implements(this.decoder)) {
      return this.decoder(model, data, options)
    } else {
      return Reflect.construct(model, [data])
    }
  },
  encode: function (object, options) {
    if (object.constructor.implements(this.encoder)) {
      return this.encoder(object)
    } else {
      return object.$clean
    }
  }
})

module.exports = Storable

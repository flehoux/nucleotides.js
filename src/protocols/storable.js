const Protocol = require('../protocol')

const Storable = Protocol('Storable')
  .value('storageName')
  .method('encoder', function (model) {
    model.prototype.$encode = function (options = {}) {
      return Storable.encode(this, options)
    }
  })
  .method('decoder', function (model) {
    model.$decode = function (data, options = {}) {
      return Storable.decode(this, data, options)
    }
  })
  .method('migrate')

Object.assign(Storable, {
  decode: function (model, data, options) {
    if (this.hasImplementationsFor(model, 'decoder')) {
      return this.getMiddleware(model, 'decoder', data, options).run()
    } else {
      return Reflect.construct(model, [data])
    }
  },
  encode: function (object, options) {
    if (this.hasImplementationsFor(object, 'encoder')) {
      return this.getMiddleware(object, 'encoder').run()
    } else {
      return object.$clean
    }
  }
})

module.exports = Storable

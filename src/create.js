const generator = function (name, parent, ctor) {
  return {
    [name]: class extends parent {
      static get name () {
        return name
      }
      constructor (...args) {
        super()
        ctor.call(this, ...args)
      }
    }
  }
}

module.exports = function (name, parent, ctor) {
  return generator(name, parent, ctor)[name]
}

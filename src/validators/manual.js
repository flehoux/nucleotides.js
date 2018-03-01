const Validator = require('../validator')

const ManualValidator = (...keys) => class extends Validator {
  constructor (data) {
    super()
    if (data && data.toString() === '[object Object]') {
      for (let key in data) {
        this[key] = data[key]
      }
    }
  }

  get shouldValidateAtCreation () {
    return false
  }

  static get key () {
    return keys[0]
  }

  shouldValidate (validatedKeys) {
    return keys.some(key => validatedKeys.has(key))
  }
}

module.exports = ManualValidator

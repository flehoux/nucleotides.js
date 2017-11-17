const Validator = require('../validator')

class AttributeValidator extends Validator {
  constructor (attributeName) {
    super()
    this.attributeName = attributeName
  }

  get shouldValidateAtCreation () {
    return true
  }

  shouldValidate (changedAttributes) {
    return changedAttributes.has(this.attributeName)
  }

  getAttribute (object, attributeName) {
    return object.constructor.attribute(attributeName)
  }

  getSafeValue (object, attributeName) {
    return this.getAttribute(object, attributeName).getSafeValue(object)
  }
}

module.exports = AttributeValidator

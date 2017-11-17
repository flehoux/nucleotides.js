const AttributeValidator = require('./attribute')

class AcceptedValuesValidator extends AttributeValidator {
  static get CODE () { return Symbol.for('accepted_values') }

  constructor (attributeName, acceptedValues) {
    super(attributeName)
    this.acceptedValues = acceptedValues
  }

  validate (object) {
    let value = this.getSafeValue(object, this.attributeName)
    if (this.acceptedValues.indexOf(value) === -1) {
      this.raiseError(this.attributeName, AcceptedValuesValidator.CODE)
    } else {
      this.removeIssues({code: AcceptedValuesValidator.CODE})
    }
  }

  describeIssue (object, attributeName, code, data) {
    if (code === AcceptedValuesValidator.CODE) {
      let attribute = this.getAttribute(object, attributeName)
      if (attribute.messages && attribute.messages[code] != null) {
        return attribute.messages[code]
      } else {
        return 'The provided value is not acceptable'
      }
    }
  }
}

module.exports = AcceptedValuesValidator

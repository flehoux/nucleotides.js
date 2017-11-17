const AttributeValidator = require('./attribute')

class RequireValidator extends AttributeValidator {
  static get CODE () {
    return Symbol.for('required')
  }

  validate (object) {
    let attribute = this.getAttribute(object, this.attributeName)
    let value = attribute.getSafeValue(object, this.attributeName)
    if (value == null) {
      this.raiseError(this.attributeName, RequireValidator.CODE)
    } else if (attribute.baseType === String && value === '') {
      this.raiseError(this.attributeName, RequireValidator.CODE)
    } else {
      this.removeIssues({code: RequireValidator.CODE})
    }
  }

  describeIssue (object, attributeName, code, data) {
    if (code === RequireValidator.CODE) {
      let attribute = this.getAttribute(object, attributeName)
      if (attribute.messages && attribute.messages[code] != null) {
        return attribute.messages[code]
      } else {
        return 'This field is required'
      }
    }
  }
}

module.exports = RequireValidator

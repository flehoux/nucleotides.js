const AttributeValidator = require('./attribute')

class RegularExpressionValidator extends AttributeValidator {
  static get CODE () { return Symbol.for('regular_expression') }

  constructor (attributeName, regexp) {
    super(attributeName)
    this.regexp = regexp
  }

  validate (object) {
    let value = this.getSafeValue(object, this.attributeName)
    if (this.regexp.test(value)) {
      this.raiseError(this.attributeName, RegularExpressionValidator.CODE)
    } else {
      this.removeIssues({code: RegularExpressionValidator.CODE})
    }
  }

  describeIssue (object, attributeName, code, data) {
    if (code === RegularExpressionValidator.CODE) {
      let attribute = this.getAttribute(object, attributeName)
      if (attribute.messages && attribute.messages[code] != null) {
        return attribute.messages[code]
      } else {
        return 'The provided value does not match expected format'
      }
    }
  }
}

module.exports = RegularExpressionValidator

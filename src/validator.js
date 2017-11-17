const $$issues = Symbol('issues')
const $$changedLevels = Symbol('changedLevels')
const $$warning = Symbol.for('warning')
const $$error = Symbol.for('error')
const $$notice = Symbol.for('notice')

class Validator {
  static for (...args) {
    let klass = this
    return function () {
      return Reflect.construct(klass, args)
    }
  }

  static summarize (object, validators, level) {
    let data = {}
    for (let validator of validators) {
      for (let issue of validator.issues) {
        if (issue.level !== level) {
          continue
        }
        if (!(issue.path in data)) {
          data[issue.path] = []
        }
        data[issue.path].push({
          description: issue.description(object),
          level: issue.level,
          data: issue.data
        })
      }
    }
    return data
  }

  constructor () {
    this[$$issues] = []
  }

  shouldValidate () {
    return true
  }

  willValidate () {
    this[$$changedLevels] = new Set()
  }

  get changedLevels () {
    return this[$$changedLevels]
  }

  runValidation (object, data) {
    const {resolvePromise} = require('..')
    this.willValidate(object, data)
    let promise = resolvePromise(this.validate(object, data))
    return promise.then(() => this.changedLevels)
  }

  removeIssues (criteria = {}) {
    this[$$issues] = this[$$issues].filter(issue => {
      for (let key in criteria) {
        if (issue[key] !== criteria[key]) {
          return true
        }
      }
      this[$$changedLevels].add(issue.level)
      return false
    })
  }

  clearIssues () {
    if (this[$$issues].length !== 0) {
      for (let issue of this[$$issues]) {
        this[$$changedLevels].add(issue.level)
      }
    }
    this[$$issues] = []
  }

  raiseIssue (path, code, data, level) {
    let newIssue = new ValidationIssue(this, path, code, data, level)
    for (let issue of this[$$issues]) {
      if (issue.equals(newIssue)) {
        issue.updateWith(data, level)
        return
      }
    }
    this[$$changedLevels].add(level)
    this[$$issues].push(newIssue)
  }

  raiseError (path, code, data) {
    this.raiseIssue(path, code, data, $$error)
  }

  raiseWarning (path, code, data) {
    this.raiseIssue(path, code, data, $$warning)
  }

  notice (path, code, data) {
    this.raiseIssue(path, code, data, $$notice)
  }

  get issues () {
    return this[$$issues]
  }
}

class ValidationIssue {
  constructor (validator, path, code, data, level) {
    this.validator = validator
    this.path = path
    this.code = code
    this.data = data
    this.level = level
  }

  description (object) {
    return this.validator.describeIssue(object, this.path, this.code, this.data)
  }

  equals (other) {
    return this.path === other.path && this.code === other.code
  }

  updateWith (data, level) {
    if (this.data !== data) {
      this.data = data
      this.validator[$$changedLevels] = true
    }
    if (this.level !== level) {
      this.level = level
      this.validator[$$changedLevels] = true
    }
  }
}

Validator.Issue = ValidationIssue

module.exports = Validator

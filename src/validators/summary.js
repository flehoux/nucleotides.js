const startsWith = require('lodash.startswith')

const $$level = Symbol('level')
const $$views = Symbol('views')
const $$keys = Symbol('keys')

module.exports = class ValidationSummary {
  static extendModel (model, property, level) {
    let Summary = this
    let accessorFn = function (summary) {
      if (!this.$isValidating) {
        return new ValidationSummary(level)
      }
      if (!summary) {
        if (this.$forked) {
          summary = this.$original[property].$extend()
        } else {
          summary = new Summary(level)
        }
      }
      let newIssues = require('../validator').summarize(this, this.$validators, level)
      summary.$update(newIssues)
      return summary
    }
    model.derive(property, {cached: true, source: 'manual'}, accessorFn)
  }

  constructor (level) {
    this[$$level] = level
    this[$$views] = new Map()
    this[$$keys] = new Set()
  }

  $includes (key) {
    if (this[$$views].has(key) && this[$$views].get(key).size > 0) {
      return true
    } else {
      for (let path in this) {
        if (typeof path === 'string' && startsWith(path, key)) {
          return true
        }
      }
    }
  }

  get $length () {
    return this[$$keys].size
  }

  $clear () {
    this[$$views].clear()
    this[$$keys].clear()
  }

  $update (issues) {
    for (let key of this[$$keys]) {
      if (!startsWith(key, '$')) {
        delete this[key]
      }
    }
    this.$clear()
    for (let key in issues) {
      if (!startsWith(key, '$')) {
        this[$$keys].add(key)
        Object.defineProperty(this, key, {
          value: issues[key],
          configurable: true,
          enumerable: true
        })
      }
    }
  }

  $extend (issues = {}) {
    let newSummary = Object.create(this)
    newSummary[$$keys] = new Set()
    newSummary[$$views] = new Map()
    return newSummary
  }

  $onlyFor (prefix) {
    if (!this[$$views].has(prefix)) {
      let issues = {}
      for (let path of this) {
        if (typeof path === 'string' && startsWith(path, prefix)) {
          issues[path.slice(prefix.length)] = this[path]
        }
      }
      let subSummary = new ValidationSummary(this.level)
      subSummary.$update(issues)
      this[$$views].set(prefix, subSummary)
    }
    return this[$$views].get(prefix)
  }
}

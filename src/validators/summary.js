const startsWith = require('lodash.startswith')

const $$level = Symbol('level')
const $$views = Symbol('views')
const $$keys = Symbol('keys')

module.exports = class ValidationSummary {
  static getPlaceholder (level) {
    if (!this[level]) {
      this[level] = new ValidationSummary(level)
      Object.freeze(this[level])
    }
    return this[level]
  }

  static extendModel (model, property, level) {
    let Summary = this
    let key = Symbol(property)
    let accessorFn = function () {
      if (!this.$isValidating) {
        return Summary.getPlaceholder(level)
      }
      if (!this[key]) {
        if (this.$forked) {
          this[key] = this.$original[property].$extend()
        } else {
          this[key] = new Summary(level)
        }
      }
      let newIssues = require('../validator').summarize(this, this.$validators, level)
      this[key].$update(newIssues)
      return this[key]
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
      this[$$keys].add(key)
      if (!startsWith(key, '$')) {
        Object.defineProperty(this, key, {
          value: issues[key],
          configurable: true,
          enumerable: true
        })
      }
    }
  }

  $extend (issues = {}) {
    return Object.create(this, {issues, views: new Map()})
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
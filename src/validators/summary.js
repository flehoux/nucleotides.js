const startsWith = require('lodash.startswith')

const $$level = Symbol('level')
const $$views = Symbol('views')
const $$keys = Symbol('keys')

module.exports = class ValidationSummary {
  static extendModel (model, property, level) {
    let Summary = this
    let createFn = function () {
      if (this.$forked) {
        return this.$original[property].$extend()
      } else {
        return new Summary(level, property)
      }
    }
    let accessorFn = function (summary) {
      if (!this.$isValidating) {
        return createFn.call(this)
      }
      if (!summary) {
        summary = createFn.call(this)
      }
      let newIssues = require('../validator').summarize(this, this.$validators, level)
      summary.$update(newIssues)
      return summary
    }
    model.derive(property, {cached: true, eager: true, source: 'manual'}, accessorFn)
  }

  constructor (level, key) {
    this[$$level] = level
    this[$$views] = new Map()
    this[$$keys] = new Set()
    Object.defineProperty(this, '$level', {value: key})
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
    Object.defineProperty(this, '$level', {value: this.$level})
    return newSummary
  }

  $onlyFor (prefix) {
    if (!this[$$views].has(prefix)) {
      let issues = {}
      for (let path in this) {
        if (typeof path === 'string' && startsWith(path, prefix)) {
          issues[path.slice(prefix.length + 1)] = this[path]
        }
      }
      let subSummary = new ValidationSummary(this.level, this.$level)
      subSummary.$update(issues)
      this[$$views].set(prefix, subSummary)
    }
    return this[$$views].get(prefix)
  }
}

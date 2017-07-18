const Protocol = require('../protocol')
const Queryable = require('./queryable')

const Searchable = Protocol('Searchable')
  .require(Queryable)
  .value('field', {accumulate: true}, function (model, options) {
    if (typeof options === 'string') {
      options = {key: options, unique: false}
    }
    let searchMethodName = 'by' + options.key.slice(0, 1).toUpperCase() + options.key.slice(1)
    if (options.unique === true) {
      model[searchMethodName] = function (value, params) {
        if (model.implements(Queryable.findOne)) {
          let newParams = Object.assign({[options.key]: value}, params)
          return model.findOne(newParams)
        } else {
          throw new Error(`Model ${model.name} does not implement Queryable.findOne`)
        }
      }
    } else {
      model[searchMethodName] = function (value, params) {
        if (model.implements(Queryable.findMany)) {
          let newParams = Object.assign({[options.key]: value}, params)
          return model.findMany(newParams)
        } else {
          throw new Error(`Model ${model.name} does not implement Queryable.findMany`)
        }
      }
    }
  })

Object.assign(Searchable, {
  hasField: function (model, fieldName) {
    const fields = Searchable.field(model)
    if (fields != null) {
      return fields.some(function (item) {
        if (item === fieldName) {
          return true
        } else if (typeof item === 'object' && item.key === fieldName) {
          return true
        }
        return false
      })
    }
  },
  fieldDefinition: function (model, fieldName) {
    const fields = Searchable.field(model)
    if (fields != null) {
      const field = fields.find(function (item) {
        if (item === fieldName) {
          return true
        } else if (typeof item === 'object' && item.key === fieldName) {
          return true
        }
        return false
      })
      if (typeof field === 'object') {
        return field
      }
      if (typeof field === 'string') {
        return {key: field, unique: false}
      }
    }
  }
})

module.exports = Searchable

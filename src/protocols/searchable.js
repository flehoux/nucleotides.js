const Protocol = require('../protocol')
const Queryable = require('./queryable')

const Searchable = Protocol('Searchable')
  .requires(Queryable)
  .value('field', {accumulate: true}, function (model, options) {
    if (typeof options === 'string') {
      options = {key: options, unique: false}
    }
    if (model.attributes()[options.key] == null) {
      throw new Error('Model ' + model.name + ' does not define field ' + options.key + ' before setting it as searchable')
    } else {
      let searchMethodName = 'by' + options.key.slice(0, 1).toUpperCase() + options.key.slice(1)
      if (options.unique === true) {
        model[searchMethodName] = function (value, params) {
          if (Queryable.hasImplementationsFor(model, 'findOne')) {
            let newParams = Object.assign({[options.key]: value}, params)
            return model.findOne(newParams)
          } else {
            throw new Error('Model ' + model.name + ' does not implement findOne from the Queryable protocol')
          }
        }
      } else {
        model[searchMethodName] = function (value, params) {
          if (Queryable.hasImplementationsFor(model, 'findMany')) {
            let newParams = Object.assign({[options.key]: value}, params)
            return model.findMany(newParams)
          } else {
            throw new Error('Model ' + model.name + ' does not implement findMany from the Queryable protocol')
          }
        }
      }
    }
  })

module.exports = Searchable

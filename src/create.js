module.exports = function createClass (name, constructor) {
  let klass

  let context = {
    ctor: constructor
  }

  /* eslint-disable no-new-func */
  let factory = new Function('ctx', `return function ${name}(...args) { ctx.ctor.call(this, ctx.klass, args) }`)
  /* eslint-enable no-new-func */

  context.klass = factory(context)
  klass = context.klass
  return klass
}

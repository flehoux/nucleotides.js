// Extracted from https://github.com/bevacqua/contra/blob/master/emitter.js
'use strict'

var tick = (function () {
  var si = typeof setImmediate === 'function'
  var _tick

  if (si) {
    _tick = function (fn) { setImmediate(fn) }
  } else if (typeof process !== 'undefined' && process.nextTick) {
    _tick = process.nextTick
  } else {
    _tick = function (fn) { setTimeout(fn, 0) }
  }

  return _tick
})()

function debounce (fn, args, ctx) {
  if (!fn) { return }
  tick(function run () {
    fn.apply(ctx || null, args || [])
  })
};

module.exports = function emitter (thing, options) {
  var opts = options || {}
  var evt = {}
  if (thing === undefined) { thing = {} }
  thing.$on = function (type, fn) {
    if (!evt[type]) {
      evt[type] = [fn]
    } else {
      evt[type].push(fn)
    }
    return thing
  }
  thing.$once = function (type, fn) {
    fn._once = true // thing.$off(fn) still works!
    thing.$on(type, fn)
    return thing
  }
  thing.$off = function (type, fn) {
    var c = arguments.length
    if (c === 1) {
      delete evt[type]
    } else if (c === 0) {
      evt = {}
    } else {
      var et = evt[type]
      if (!et) { return thing }
      et.splice(et.indexOf(fn), 1)
    }
    return thing
  }
  thing.$emit = function () {
    var args = Array.prototype.slice.call(arguments)
    return thing.$emitterSnapshot(args.shift()).apply(this, args)
  }
  thing.$emitterSnapshot = function (type) {
    var et = (evt[type] || []).slice(0)
    return function () {
      var args = Array.prototype.slice.call(arguments)
      var ctx = this || thing
      if (type === 'error' && opts.throws !== false && !et.length) { throw args.length === 1 ? args[0] : args }
      et.forEach(function emitter (listen) {
        if (opts.async) { debounce(listen, args, ctx) } else { listen.apply(ctx, args) }
        if (listen._once) { thing.$off(type, listen) }
      })
      return thing
    }
  }
  return thing
}

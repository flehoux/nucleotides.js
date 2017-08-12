/* global describe it expect jasmine */

describe('An EmittingArray instance', function () {
  const EmittingArray = require('../src/emitting_array')
  it("should emit 1 'add' event for .push(...)", function () {
    let array = EmittingArray.create('a', 'b', 'c')
    let spy = jasmine.createSpy()
    array.$on('add', spy)
    array.push('d', 'e', 'f')
    expect(spy.calls.count()).toBe(1)

    const [elements] = spy.calls.argsFor(0)
    expect(elements).toEqual(['d', 'e', 'f'])
  })

  it("should emit 1 'add' event for .unshift(...)", function () {
    let array = EmittingArray.create('a', 'b', 'c')
    let spy = jasmine.createSpy()
    array.$on('add', spy)
    array.unshift('d', 'e', 'f')
    expect(spy.calls.count()).toBe(1)

    const [elements] = spy.calls.argsFor(0)
    expect(elements).toEqual(['d', 'e', 'f'])
  })

  it("should emit 1 'remove' event for .pop(...)", function () {
    let array = EmittingArray.create('a', 'b', 'c')
    let spy = jasmine.createSpy()
    array.$on('remove', spy)
    array.pop()
    expect(spy.calls.count()).toBe(1)

    const [elements] = spy.calls.argsFor(0)
    expect(elements).toEqual(['c'])
  })

  it("should emit 1 'remove' event for .shift(...)", function () {
    let array = EmittingArray.create('a', 'b', 'c')
    let spy = jasmine.createSpy()
    array.$on('remove', spy)
    array.shift()
    expect(spy.calls.count()).toBe(1)

    const [elements] = spy.calls.argsFor(0)
    expect(elements).toEqual(['a'])
  })

  it("should emit 'add' and 'remove' events for .splice(...)", function () {
    let array = EmittingArray.create('a', 'b', 'c')
    let addSpy = jasmine.createSpy()
    let removeSpy = jasmine.createSpy()
    array.$on('add', addSpy)
    array.$on('remove', removeSpy)
    array.splice(2, 1, 'd', 'e', 'f')
    expect(addSpy.calls.count()).toBe(1)
    expect(removeSpy.calls.count()).toBe(1)

    let [elements] = addSpy.calls.argsFor(0)
    expect(elements).toEqual(['d', 'e', 'f'])

    elements = removeSpy.calls.argsFor(0)[0]
    expect(elements).toEqual(['c'])
  })
})

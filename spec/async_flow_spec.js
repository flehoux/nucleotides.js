/* global describe it expect jasmine */

describe('An AsyncFlow instance', function () {
  let AsyncFlow = require('../src/async_flow')

  it('should call each stacked function and pass down arguments if the .next() is called', function (done) {
    let spy1 = jasmine.createSpy()
    let spy2 = jasmine.createSpy()
    let spy3 = jasmine.createSpy()
    let spy4 = jasmine.createSpy()

    let fun1 = (flow, arg) => {
      spy1(arg)
      return flow
        .next(arg + 1)
        .then((val) => `Received: ${val}`)
    }
    let fun2 = (flow, arg) => {
      spy2(arg)
      return flow.next(arg + 1)
    }
    let fun3 = (flow, arg) => {
      spy3(arg)
      return flow.next(arg + 1)
    }
    let fun4 = (flow, arg) => {
      spy4(arg)
      flow.resolve(`yield ${arg}`)
    }

    let flow = new AsyncFlow([fun1, fun2, fun3, fun4], 1)
    flow.run().then(function () {
      expect(flow.successful).toBe(true)
      expect(flow.resolved).toBe('Received: yield 4')
      done()
    })

    expect(spy1.calls.count()).toEqual(1)
    expect(spy2.calls.count()).toEqual(1)
    expect(spy3.calls.count()).toEqual(1)
    expect(spy4.calls.count()).toEqual(1)
    expect(flow.completed).toBe(false)
  })

  it('should follow promise completion if the last .resolve happens asynchronously', function (done) {
    let spy1 = jasmine.createSpy()
    let spy2 = jasmine.createSpy()

    let fun1 = (flow, arg) => {
      spy1(arg)
      return flow
        .next(arg + 1)
        .then((val) => `Received: ${val}`)
    }
    let fun2 = (flow, arg) => {
      spy2(arg)
      setTimeout(function () {
        flow.resolve(`yield ${arg}`)
      }, 0)
    }

    let flow = new AsyncFlow([fun1, fun2], 1)
    flow.run().then(function () {
      expect(flow.successful).toBe(true)
      expect(flow.resolved).toBe('Received: yield 2')
      done()
    })

    expect(spy1.calls.count()).toEqual(1)
    expect(spy2.calls.count()).toEqual(1)
    expect(flow.completed).toBe(false)
  })

  it('should follow promise chaining if .resolve receives another Promise', function (done) {
    let spy1 = jasmine.createSpy()
    let spy2 = jasmine.createSpy()

    let fun1 = (flow, arg) => {
      spy1(arg)
      return flow
        .next(arg + 1)
        .then((val) => `Received: ${val}`)
    }
    let fun2 = (flow, arg) => {
      spy2(arg)
      flow.resolve(new Promise((resolve) => {
        setTimeout(() => {
          resolve(`yield ${arg}`)
        }, 0)
      }))
    }

    let flow = new AsyncFlow([fun1, fun2], 1)
    flow.run().then(function () {
      expect(flow.successful).toBe(true)
      expect(flow.resolved).toBe('Received: yield 2')
      done()
    })

    expect(spy1.calls.count()).toEqual(1)
    expect(spy2.calls.count()).toEqual(1)
    expect(flow.completed).toBe(false)
  })

  it('should call each stacked function, pass down arguments and bubble up failure if the .next() is called', function (done) {
    let spy1 = jasmine.createSpy()
    let spy2 = jasmine.createSpy()
    let spy3 = jasmine.createSpy()
    let spy4 = jasmine.createSpy()

    let fun1 = (flow, arg) => {
      spy1(arg)
      return flow.next(arg + 1)
    }
    let fun2 = (flow, arg) => {
      spy2(arg)
      return flow.next(arg + 1)
    }
    let fun3 = (flow, arg) => {
      spy3(arg)
      return flow.next(arg + 1)
    }
    let fun4 = (flow, arg) => {
      spy4(arg)
      flow.reject(`failed at ${arg}`)
    }

    let flow = new AsyncFlow([fun1, fun2, fun3, fun4], 1)
    flow.run().catch(function (reason) {
      expect(flow.failed).toBe(true)
      expect(reason).toBe('failed at 4')
      expect(flow.reason).toBe('failed at 4')
      done()
    })

    expect(spy1.calls.count()).toEqual(1)
    expect(spy2.calls.count()).toEqual(1)
    expect(spy3.calls.count()).toEqual(1)
    expect(spy4.calls.count()).toEqual(1)
  })

  it('should follow promise chaining if .resolve receives another Promise, bubble up errors', function (done) {
    let spy1 = jasmine.createSpy()
    let spy2 = jasmine.createSpy()

    let fun1 = (flow, arg) => {
      spy1(arg)
      return flow
        .next(arg + 1)
        .then((val) => `Received: ${val}`)
    }
    let fun2 = (flow, arg) => {
      spy2(arg)
      flow.resolve(new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(`failed at ${arg}`) // eslint-disable-line prefer-promise-reject-errors
        }, 0)
      }))
    }

    let flow = new AsyncFlow([fun1, fun2], 1)
    flow.run().catch(function (reason) {
      expect(flow.failed).toBe(true)
      expect(reason).toBe('failed at 2')
      expect(flow.reason).toBe('failed at 2')
      done()
    })

    expect(spy1.calls.count()).toEqual(1)
    expect(spy2.calls.count()).toEqual(1)
    expect(flow.completed).toBe(false)
  })

  it('should provide resolved value immediately if no promise chaining occured', function () {
    let fun1 = (flow, arg) => {
      return flow.next(arg + 1)
    }
    let fun2 = (flow, arg) => {
      return flow.next(arg + 1)
    }
    let fun3 = (flow, arg) => {
      return flow.next(arg + 1)
    }
    let fun4 = (flow, arg) => {
      flow.resolve(`yield ${arg}`)
    }

    let flow = new AsyncFlow([fun1, fun2, fun3, fun4], 1)
    flow.run()

    expect(flow.successful).toBe(true)
    expect(flow.resolved).toBe('yield 4')
  })

  it('should provide rejection reason immediately if no promise chaining occured', function () {
    let fun1 = (flow, arg) => {
      return flow.next(arg + 1)
    }
    let fun2 = (flow, arg) => {
      return flow.next(arg + 1)
    }
    let fun3 = (flow, arg) => {
      return flow.next(arg + 1)
    }
    let fun4 = (flow, arg) => {
      flow.reject(`failed at ${arg}`)
    }

    let flow = new AsyncFlow([fun1, fun2, fun3, fun4], 1)
    flow.run().catch(function () {})

    expect(flow.failed).toBe(true)
    expect(flow.reason).toBe('failed at 4')
  })
})

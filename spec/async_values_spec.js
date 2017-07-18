/* global describe it expect jasmine */

describe("A Model's async derived value", function () {
  const {Model} = require('..')

  const Polynomial = Model('Polynomial')
    .construct(function (x, a = 1, b = 1, c = 0) {
      this.$updateAttributes({a, b, c, x})
      this.spy = jasmine.createSpy('PolySpy')
    })
    .attributes({
      a: Number,
      b: Number,
      c: Number,
      x: Number
    })
    .derive('total', {async: true, source: 'all'}, function () {
      this.spy()
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.a * Math.pow(this.x, 2) + this.b * this.x + this.c)
        }, 50)
      })
    })

  it('should calculate derived value when asked for using .ensure()', function (done) {
    const poly = new Polynomial(1, 2)
    expect(poly.a).toBe(2)
    expect(poly.x).toBe(1)
    poly.$ensure('total').then(function () {
      expect(poly.spy.calls.count()).toBe(1)
      expect(poly.total).toBe(3)
      done()
    })
  })

  it('should not call getter twice if .ensure() is called twice without changing data', function (done) {
    const poly = new Polynomial(2, 4, 5) // = 26
    expect(poly.a).toBe(4)
    expect(poly.x).toBe(2)
    poly.$ensure('total').then(function () {
      expect(poly.spy.calls.count()).toBe(1)
      poly.$ensure('total').then(function () {
        expect(poly.spy.calls.count()).toBe(1)
        expect(poly.total).toBe(26)
        done()
      })
    })
  })

  it('should invalidate cached value if source attribute change', function (done) {
    const poly = new Polynomial(2, 3, 4) // = 20
    poly.$ensure('total').then(function () {
      expect(poly.spy.calls.count()).toBe(1)
      expect(poly.total).toBe(20)
      poly.x = 1
      expect(poly.total).toBeUndefined()
      poly.$ensure('total').then(function () {
        expect(poly.spy.calls.count()).toBe(2)
        expect(poly.total).toBe(7)
        done()
      })
    })
  })
})

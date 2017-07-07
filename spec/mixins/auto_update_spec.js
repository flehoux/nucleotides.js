/* global describe it expect jasmine */

describe('A simple Model modified using the DifferenceMixin', function () {
  const { Model, Storage, Mixin } = require('../..')

  const storage = {}

  const Person = Model('Person')
    .attributes({
      firstName: String,
      lastName: String,
      age: Number,
      nas: String,
      emails: [String]
    })
    .set('$idKey', 'id')
    .implement(Storage.$$store, function (flow) {
      storage[this.nas] = this.$clean
      flow.resolve(true)
    })
    .implement(Storage.$$findOne, function (flow, nas) {
      flow.resolve(storage[nas])
    })
    .derive('fullName', function () { return this.firstName + ' ' + this.lastName })
    .use(new Mixin.AutoUpdate({}))

  it('should propagate saved updates to objects sharing the same ID', function (done) {
    let inst1 = new Person({ firstName: 'John', lastName: 'Smith', nas: '1' })

    expect(inst1.$isNew).toBe(true)
    inst1.save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne('1').then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        inst2.$autoUpdate()
        inst1.firstName = 'Larry'
        inst1.save().then(function () {
          expect(inst2.fullName).toBe('Larry Smith')
          delete storage['1']
          done()
        })
      })
    })
  })

  it('should stop propagating saved updates to objects after calling the unregister() callback', function (done) {
    let inst1 = new Person({ firstName: 'John', lastName: 'Smith', nas: '2' })

    expect(inst1.$isNew).toBe(true)
    inst1.save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne('2').then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        let unlisten = inst2.$autoUpdate()
        unlisten()
        inst1.firstName = 'Larry'
        inst1.save().then(function () {
          expect(inst2.fullName).toBe('John Smith')
          delete storage['2']
          done()
        })
      })
    })
  })

  it('should not propagate saved updates to objects if callback returns false', function (done) {
    let inst1 = new Person({ firstName: 'John', lastName: 'Smith', nas: '3' })

    expect(inst1.$isNew).toBe(true)
    inst1.save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne('3').then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        inst2.$autoUpdate(function ({firstName}) {
          return firstName.slice(0, 1) !== 'L'
        })
        inst1.firstName = 'Larry'
        inst1.save().then(function () {
          expect(inst2.fullName).toBe('John Smith')
          inst1.firstName = 'Bob'
          inst1.save().then(function () {
            expect(inst2.fullName).toBe('Bob Smith')
            delete storage['3']
            done()
          })
        })
      })
    })
  })

  it('should not propagate saved updates to objects if callback yields false asynchronously', function (done) {
    let inst1 = new Person({ firstName: 'John', lastName: 'Smith', nas: '4' })

    expect(inst1.$isNew).toBe(true)
    inst1.save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne('4').then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        inst2.$autoUpdate(function ({firstName}) {
          return new Promise(function (resolve) {
            resolve(firstName.slice(0, 1) !== 'L')
          })
        })
        inst1.firstName = 'Larry'
        inst1.save().then(function () {
          expect(inst2.fullName).toBe('John Smith')
          inst1.firstName = 'Bob'
          inst1.save().then(function () {
            expect(inst2.fullName).toBe('Bob Smith')
            delete storage['4']
            done()
          })
        })
      })
    })
  })

  it('should trigger \'change\' events on other objects sharing the same ID', function (done) {
    let inst1 = new Person({ firstName: 'John', lastName: 'Smith', nas: '5' })
    let spy = jasmine.createSpy()

    expect(inst1.$isNew).toBe(true)
    inst1.save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne('5').then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        inst2.$autoUpdate()
        inst2.$on('change', spy)
        inst1.firstName = 'Larry'
        inst1.save().then(function () {
          expect(spy.calls.count()).toBe(1)
          expect(spy.calls.argsFor(0)[0].firstName).toBe('Larry')
          expect(inst2.firstName).toBe('Larry')

          inst2.firstName = 'John'
          spy.calls.reset()

          inst2.save().then(function () {
            expect(spy.calls.count()).toBe(0)
            delete storage['5']
            done()
          })
        })
      })
    })
  })
})

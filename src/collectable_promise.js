const Collection = require('./collection')

class CollectablePromise {
  constructor (promise, model) {
    this.model = model
    this.promise = promise
  }

  get $result () {
    return this.promise.$result
  }

  isArray (items) {
    return (items instanceof Collection) || Array.isArray(items)
  }

  createCollection (items) {
    return Collection.create(this.model, ...items)
  }

  wrap (promise) {
    return new CollectablePromise(promise, this.model)
  }

  then (cast, success, failure) {
    if (typeof cast === 'function') {
      failure = success
      success = cast
      cast = false
    }
    let promise = this.promise.then(success, failure)
    if (cast === true) {
      promise = this.wrap(promise)
    }
    return promise
  }

  catch (cast, failure) {
    if (typeof cast === 'function') {
      failure = cast
      cast = false
    }
    let promise = this.promise.catch(failure)
    if (cast === true) {
      promise = this.wrap(promise)
    }
    return promise
  }

  filter (fun) {
    return this.wrap(this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        return items.filter(fun)
      }
      return items
    }))
  }

  map (fun, cast = true) {
    let promise = this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        return items.map(fun)
      }
      return []
    })
    if (cast) {
      promise = this.wrap(promise)
    }
    return promise
  }

  reduce (fun, initialValue, cast = false) {
    let promise = this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        return items.reduce(fun, initialValue)
      }
      return []
    })
    if (cast) {
      promise = this.wrap(promise)
    }
    return promise
  }

  reduceRight (fun, initialValue, cast = false) {
    let promise = this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        return items.reduceRight(fun, initialValue)
      }
      return []
    })
    if (cast) {
      promise = this.wrap(promise)
    }
    return promise
  }

  entries () {
    return this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        return items.entries()
      }
      return items
    })
  }

  some (fun) {
    return this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        return items.some(fun)
      }
      return false
    })
  }

  every (fun) {
    return this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        return items.every(fun)
      }
      return false
    })
  }

  find (fun) {
    return this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        return items.find(fun)
      }
      return undefined
    })
  }

  findIndex (fun) {
    return this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        return items.findIndex(fun)
      }
      return undefined
    })
  }

  forEach (fun) {
    return this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!(items instanceof Collection)) {
          items = this.createCollection(items)
        }
        items.forEach(fun)
      }
      return items
    })
  }
}

module.exports = CollectablePromise

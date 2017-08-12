const {ArrayCollection, MapCollection} = require('./collection')

class CollectablePromise {
  constructor (promise, model) {
    this.model = model
    this.promise = promise.then((items) => {
      if (this.isCollection(items) && items.$model != null) {
        return items
      } else {
        return this.createCollection(items)
      }
    })
    Object.defineProperty(this.promise, '$result', {
      get: function () {
        return promise.$result
      }
    })
  }

  get $result () {
    return this.promise.$result
  }

  isArray (items) {
    return (items instanceof ArrayCollection) || Array.isArray(items)
  }

  isMap (items) {
    return items instanceof MapCollection
  }

  isCollection (items) {
    return this.isMap(items) || items instanceof ArrayCollection
  }

  createCollection (items) {
    if (items instanceof Array) {
      return ArrayCollection.create(this.model, ...items)
    } else if (items instanceof Object) {
      return MapCollection.create(this.model, items)
    }
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

  ensure (...names) {
    return this.wrap(this.promise.then((items) => {
      let promises = items.map((item) => item.$ensure(...names))
      return Promise.all(promises)
    }))
  }

  filter (fun) {
    return this.wrap(this.promise.then((items) => {
      if (this.isArray(items)) {
        if (!this.isCollection(items)) {
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
        if (!this.isCollection(items)) {
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
        if (!this.isCollection(items)) {
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
        if (!this.isCollection(items)) {
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
        if (!this.isCollection(items)) {
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
        if (!this.isCollection(items)) {
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
        if (!this.isCollection(items)) {
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
        if (!this.isCollection(items)) {
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
        if (!this.isCollection(items)) {
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
        if (!this.isCollection(items)) {
          items = this.createCollection(items)
        }
        items.forEach(fun)
      }
      return items
    })
  }
}

module.exports = CollectablePromise

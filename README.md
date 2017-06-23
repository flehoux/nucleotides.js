# nucleotides.js

Agnostic and extensible organization of state

![Travis](https://travis-ci.org/matehat/nucleotides.js.svg?branch=master)

---

```javascript

import {defineMixin, defineModel} from "nucleotides";

defineMixin("Genealogy")
  .derive("parents", function (params) {
    // implement getting the parents of `this`
  })
  .derive("children", function (params) {
    // implement getting the children of `this`
  })
  .derive("siblings", {lazy: true}, function (params) {
    // implement getting the siblings of `this`
  });

defineMixin("LocalStorage")
  .$findOne(function(params, searchArgs, promise) {
    // Implement a getter for finding an item from the main key
  })
  .$findMany(function(params, searchArgs, promise) {
    // Implement a getter for finding items from other criterias
  })
  .$store(function(difference, promise) {
    // Implement how to store a object (as `this`), optionally using the difference
  })

var Person = defineModel("Person")
  .fields({
    nas: {require: String},
    firstname: {require: String},
    lastname: {require: String},
    birthdate: Date,
    parentsNas: [String],
    sex: {require: ["M", "F"]}
  })
  .method("fullName", function() { return this.firstname + " " + this.lastname; })
  .mixin("Genealogy", {parentKey: "nas", childKey: "parentsNas"})
  .mixin("LocalStorage", {key: "nas", prefix: "people"})

var john = Person.create({nas: "555", firstname: "John", lastname: "Smith", birthdate: new Date(), sex: "R"});
var mary = Person.create({nas: "666", firstname: "Mary", lastname: "Smith", birthdate: new Date(), sex: "F", parentsNas: ["555"]});
var peter = Person.create({nas: "777", firstname: "Peter", lastname: "Smith", birthdate: new Date(), sex: "M", parentsNas: ["555"]});

john.$isValid
// ==> false

john.$errors
// ==> { "sex": "invalid" }

mary.parents
// ==> [Person{nas: "555", firstname: "John", ...}]

john.children
// ==> [Person{nas: "666", ...}, Person{nas: "777", ...}]
```

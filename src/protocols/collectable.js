const Protocol = require('../protocol')

const Collectable = Protocol('Collectable')
  .method('prepareCollection', {mode: 'all'})
  .method('prepareElement', {mode: 'all'})

module.exports = Collectable

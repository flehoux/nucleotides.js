var browserify = require('browserify')
var gulp = require('gulp')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')
var globby = require('globby')
var through = require('through2')
var TestServer = require('karma').Server

gulp.task('test', ['javascript'], function (done) {
  new TestServer({
    configFile: require('path').join(__dirname, 'karma.conf.js'),
    singleRun: !(process.argv.includes('watch'))
  }, done).start()
})

gulp.task('javascript', function () {
  var bundledStream = through()

  bundledStream
    .pipe(source('test.js'))
    .pipe(buffer())
    .pipe(gulp.dest('./dist/'))

  globby(['./spec/**/*_spec.js']).then(function (entries) {
    browserify({entries: entries})
    .transform('babelify', {
      presets: ['@babel/preset-env']
    })
    .bundle()
    .pipe(bundledStream)
  }).catch(function (err) {
    bundledStream.emit('error', err)
  })

  return bundledStream
})

gulp.task('watch', function () {
  gulp.watch('spec/**/*.js', ['javascript'])
  gulp.watch('src/**/*.js', ['javascript'])
})

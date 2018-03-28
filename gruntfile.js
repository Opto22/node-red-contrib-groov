module.exports = function(grunt) {
  grunt.initConfig({
    ts: {
      client: {
        files: [{
          src: [
            "src/**/*.ts",
            "node_modules/@opto22/node-red-utils/typings/*.d.ts"],
          dest: "build/src"
        }],
        options: {
          module: "commonjs",
          target: "es5",
          sourceMap: false,
          noImplicitAny: true,
          suppressImplicitAnyIndexErrors: true,
          fast: 'never'
        }
      },
      test: {
        files: [{
          src: [
            "test/**/*.ts", 
            "node_modules/@opto22/node-red-utils/typings/*.d.ts"],
          dest: "build/test"
        }],
        options: {
          module: "commonjs",
          target: "es5",
          sourceMap: false,
          noImplicitAny: true,
          suppressImplicitAnyIndexErrors: true,
          fast: 'never'
        }
      }
    },
    clean: {
      build: ['build'],
      coverage: ['coverage'],
      package: ['package', '*node-red-contrib-*.tgz']
    },
    simplemocha: {
      options: {
      },
      default: { src: ['build/test/test/**/*.js'] },
      xunit: {
        options: {
          reporter: 'xunit',
          reporterOptions: {
            output: 'xunit-results.xml'
          }
        },
        src: ['build/test/test/**/*.js']
      }
    },   
    mocha_istanbul: {
      default: {
        src: ['build/test/test/**/*.js'],
        options: {
           includeAllSources: true,
           reportFormats: ['cobertura','lcov'],
           root: 'build/test/'
        }
      }
    },    
    copy: {
      testSettingsBoxOrServer: {
        nonull: true,
        src: 'test/settings.groovBoxOrServer.json',
        dest:'build/test/test/settings.json'
      },
      testSettingsEPIC: {
        nonull: true,
        src: 'test/settings.groovEPIC.json',
        dest:'build/test/test/settings.json'
      },
      build: {
        files: [
          {src: 'src/*.html',      dest: 'build/src/',       flatten: true, expand:  true},
          {src: 'src/icons/*.png', dest: 'build/src/icons/', flatten: true, expand:  true},
         ]
      },
      package: {
        files: [
          {src: 'package.json',       dest: 'package/'},
          {src: 'build/src/*.html',       dest: 'package/'},
          {src: 'build/src/*.js',         dest: 'package/'},
          {src: 'build/src/icons/*.png',  dest: 'package/build/src/icons/', flatten: true, expand:  true},
          {src: 'README.md',          dest: 'package/'},
          {src: 'LICENSE',            dest: 'package/'}
         ]
      }
    },
    watch: {
      source: {
        files: ["src/**/*.ts"],
        tasks: ["ts"],
        options: {interval: 100}
      },
      resources: {
        files: ["src/**/*.html", "src/**/*.png"],
        tasks: ["copy:build"],
        options: {interval: 100}
      }
    },
    'npm-command': {
      pack: {
        options: {
          cmd:  'pack',
          args: 'package'
        }
      }
    }
  });
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-contrib-clean");
  grunt.loadNpmTasks("grunt-contrib-copy");
  grunt.loadNpmTasks("grunt-npm-command");
  grunt.loadNpmTasks("grunt-ts");
  grunt.loadNpmTasks("grunt-simple-mocha");
  grunt.loadNpmTasks('grunt-mocha-istanbul')

  grunt.registerTask("default", ["clean:build", "copy:build", "ts"]);
  grunt.registerTask("test-box",  'comment', ['clean:coverage', 'default', 'copy:testSettingsBoxOrServer', 'mocha_istanbul:default']);
  grunt.registerTask("test-epic", 'comment', ['clean:coverage', 'default', 'copy:testSettingsEPIC',        'mocha_istanbul:default']);
  grunt.registerTask("package", 'comment', ['clean:package', 'default', 'copy:package', 'npm-command:pack']);
};

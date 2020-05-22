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
           root: 'build/test/',
           grep: grunt.option('grep')
        }
      }
    },    
    copy: {
      testSettings: {
        nonull: true,
        src: 'test/settings.json',
        dest:'build/test/test/settings.json'
      },
      testSettingsBoxOrServer: {
        nonull: true,
        src: 'test/settings.groovBoxOrServer.json',
        dest:'test/settings.json'
      },
      testSettingsEPIC: {
        nonull: true,
        src: 'test/settings.groovEPIC.json',
        dest:'test/settings.json'
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
          args: './package'
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

  grunt.registerTask("default",   ["clean:build", "copy:build", "ts"]);

  /* Standard test task. Uses "test/settings.json" for Groov View info. */
  grunt.registerTask("test",      ['clean:coverage', 'default', 'copy:testSettings', 'mocha_istanbul:default']);

  /* Extra test tasks to easily test both Groov Box/Server and Groov EPIC.
     For Groov Box/Server, uses "test/settings.groovBoxOrServer.json". 
     For Groov EPIC, uses "test/settings.groovEPIC.json". 
     IMPORTANT: THIS WILL COPY OVER THE EXISTING "test/settings.json" file!!
  */
  grunt.registerTask("test-box",  ['copy:testSettingsBoxOrServer', 'test']);
  grunt.registerTask("test-epic", ['copy:testSettingsEPIC',        'test']);
  
  grunt.registerTask("package",   ['clean:package', 'default', 'copy:package', 'npm-command:pack']);
};

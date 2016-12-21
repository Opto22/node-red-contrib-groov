#Node-RED for Groov

## Source Code

The code is written in [TypeScript](http://www.typescriptlang.org/) and then transpiled into JavaScript.
For more information on creating Node-RED nodes, see the official [Creating Nodes Overview](http://nodered.org/docs/creating-nodes/).

The following instructions assume that development is done on a modern Linux system.

After cloning the Git repository, all further instructions assume that you are in the root of
the source directory, which is likely called  _node-red-contrib-groov_.

## Install Dependencies

After cloning the repository to your computer, you need to install the dependencies by running:

```
npm install
```

Also, _grunt-cli_ must be installed:

```
sudo npm install -g grunt-cli
```

## Build

To build the JavaScript files from the TypeScript source, run:

```
grunt
```

You can also clean out all the output files with:

```
grunt clean
```

## Link Nodes

In order for your development version of the _groov_ nodes to be used by Node-RED,
you need to link your source directory into the local npm system. Run:

```
sudo npm link
```

## Tests

Running all tests requires the following:

 1. _groov_ test project running in a _groov_ Box or Server.
 1. A local copy of the _settings.json_ file.
    1. From within the _/test/_ directory, copy _settings.json.tmpl_ to _settings.json_.
    1. Adjust the file to use your _groov_'s address, API key, and other required settings.

To run all the tests, run:

```
grunt test-all
```



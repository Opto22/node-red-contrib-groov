# Node-RED for Groov View

### 1.1.1 - May 27, 2020

 * The nodes now support running on a _groov_ RIO I/O module.
 * Removed the "Public Key" option from the communication settings.
   The name was incorrect and it was never supported by _groov_ View.
 * No longer shows an existing API key when updating a configuration.
 * Documentation fixes and improvements.

### 1.1.0 - May 18, 2018

Improvements

 * The nodes now support all versions of _groov_ View, including _groov_ EPIC processors (GRV-EPIC-PR1), _groov_ Edge Appliance (GROOV-AR1), and _groov_ Server for Windows.
 
 ### 1.0.2 - January 24, 2017

Improvements

 * The nodes will now reacquire the list of tags from _groov_ View when any flow is deployed. Previously
it required a Full Deploy to use any new tags added to the _groov_ View project.

### 1.0.1 - January 16, 2017

Fixes

 * Fix for [#1](https://github.com/Opto22/node-red-contrib-groov/issues/1) - localhost address
not working for Node-RED and Groov Server for Windows on same machine.

### 1.0.0 - December 22, 2016

 * Initial Release 


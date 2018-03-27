import * as fs from 'fs';
import * as should from 'should';
import * as assert from 'assert';
import * as Promise from 'bluebird';
import * as http from 'http';
import * as DatastoreApi from '../src/api';
import { DatastoreApiEx } from '../src/api-ex';
import { TagDefinition } from '../src/api';
import async = require('async');

var TestSettings = require('./settings.json');

interface PromiseResponse
{
    response: http.ClientResponse;
    body: any; // Since we don't do anything much with the response bodies, we can ignore the type.
}

class DataStoreDevice 
{
    name: string;
    id: number;
}

// This file has tests for DatastoreApiEx, which enhances the core parts
// of the Swagger codegen REST API client (DatastoreApi). The core parts of the
// generated client are tested in a different file. This division is really
// only meant to keep the files organized and to a reasonable size.
describe('Sanity Checks', function()
{
    var publicCertFile: Buffer;
    var caCertFile: Buffer;
    if (TestSettings.groovPublicCertPath && TestSettings.groovPublicCertPath.length > 0) {
        publicCertFile = fs.readFileSync(TestSettings.groovPublicCertPath);
    }

    if (TestSettings.groovCaCertPath && TestSettings.groovCaCertPath.length > 0) {
        caCertFile = fs.readFileSync(TestSettings.groovCaCertPath);
    }

    var sharedApiClient = new DatastoreApiEx(TestSettings.groovApiKey,
        'https://' + TestSettings.groovAddress, publicCertFile, caCertFile);

    // beforeEach(() =>
    // {
    // });


    it('NodeRedTestDataStore is in the Groov project', function(done)
    {
        sharedApiClient.dataStoreListDevices().then(
            (fullfilledResponse: PromiseResponse) =>
            {
                var devices = fullfilledResponse.body;

                should(devices).be.an.Array();

                var device = devices[0];
                should(device).property('deviceType').equal('dataStoreDevice');
                should(device).property('id').be.greaterThanOrEqual(0);
                should(device).property('name').equal('NodeRedTestDataStore');

                done();
            },
            (error: any) =>
            {
                console.log('error = ' + JSON.stringify(error));
                done(error);
            }
        );
    });

    function testTag(tagName: string, tagType: string, callback: (error?: any) => void)
    {
        sharedApiClient.getReadSingleTagByNamePromise('NodeRedTestDataStore', tagName, undefined, undefined,
            (promise: Promise<PromiseResponse>, error: string): void =>
            {
                if (promise) {
                    promise.then(
                        // onFullfilled handler
                        (fullfilledResponse: PromiseResponse) =>
                        {
                            var value: DatastoreApi.FloatValue = fullfilledResponse.body;

                            should(value).property('valueType').equal(tagType);

                            callback();
                        },
                        // onRejected handler
                        (error: any) =>
                        {
                            console.log('error = ' + JSON.stringify(error));
                            callback(error);
                        }
                    );
                }
                else {
                    callback(error)
                }
            });
    }

    it('bTag0 is in the Groov project', function(done)
    {
        testTag('bTag0', 'booleanValue', done);
    });

    it('btTag10 is in the Groov project', function(done)
    {
        testTag('btTag10', 'booleanArrayValue', done);
    });

    it('nTag0 is in the Groov project', function(done)
    {
        testTag('nTag0', 'integerValue', done);
    });

    it('ntTag10 is in the Groov project', function(done)
    {
        testTag('ntTag10', 'integerArrayValue', done);
    });

    it('dTag0 is in the Groov project', function(done)
    {
        testTag('dTag0', 'floatValue', done);
    });

    it('sTag0 is in the Groov project', function(done)
    {
        testTag('sTag0', 'stringValue', done);
    });


});

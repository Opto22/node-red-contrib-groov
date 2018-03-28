import * as fs from 'fs';
import * as should from 'should';
import * as assert from 'assert';
import * as Promise from 'bluebird';
import * as http from 'http';
import * as DatastoreApi from '../src/api';
import { DatastoreApiEx } from '../src/api-ex';

var TestSettings = require('./settings.json');

interface PromiseResponse
{
    response: http.ClientResponse;
    body: any; // Since we don't do anything much with the response bodies, we can ignore the type.
}

// This file has tests for DatastoreApiEx, which enhances the core parts
// of the Swagger codegen REST API client (DatastoreApi). The core parts of the
// generated client are tested in a different file. This division is really
// only meant to keep the files organized and to a reasonable size.
describe('Enhanced API client', function()
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

    before(function(beforeDone: MochaDone)
    {
        sharedApiClient.getServerType(beforeDone);
    });

    it('getReadSingleTagByNamePromise test', function(done)
    {

        sharedApiClient.getReadSingleTagByNamePromise('NodeRedTestDataStore', 'bTag0', undefined, undefined,
            (promise: Promise<PromiseResponse>, error: string): void =>
            {
                promise.then(
                    // onFullfilled handler
                    (fullfilledResponse: PromiseResponse) =>
                    {
                        var value: DatastoreApi.FloatValue = fullfilledResponse.body;

                        should(value).property('valueType').equal('booleanValue');
                        //should(value).property('value').equal(123.456);

                        done();
                    },
                    // onRejected handler
                    (error: any) =>
                    {
                        console.log('error = ' + JSON.stringify(error));
                        done(error);
                    }
                );
            });
    });

    function readWriteTest(tagName: string, value: any, done: MochaDone, index?: number): void
    {
        sharedApiClient.getWriteSingleTagByNamePromise(JSON.stringify(value), 'NodeRedTestDataStore', tagName, index,
            (promise: Promise<PromiseResponse>, error: string): void =>
            {
                promise.then(
                    (fullfilledResponse: PromiseResponse) =>
                    {
                        sharedApiClient.getReadSingleTagByNamePromise('NodeRedTestDataStore', tagName, index, index ? 1 : undefined,
                            (promise2: Promise<PromiseResponse>, error: string): void =>
                            {
                                promise2.then(
                                    (fullfilledResponse: PromiseResponse) =>
                                    {
                                        var responseData: DatastoreApi.TagValue = fullfilledResponse.body;

                                        if (responseData.valueType.toString().indexOf('Array') > 0) {
                                            should(responseData).property('value').match([value]);
                                        }
                                        else {
                                            should(responseData).property('value').equal(value);
                                        }

                                        done();
                                    },
                                    (error: any) =>
                                    {
                                        console.log('error = ' + JSON.stringify(error));
                                        done(error);
                                    }
                                );
                            });
                    },
                    (error: any) =>
                    {
                        console.log('error = ' + JSON.stringify(error));
                        done(error);
                    }
                );
            });

    }

    it('can write a "true" to a boolean value', function(done)
    {
        readWriteTest('bTag0', true, done);
    });

    it('can write a "false" to a boolean value', function(done)
    {
        readWriteTest('bTag0', false, done);
    });

    it('can write a "true" to a boolean table element', function(done)
    {
        readWriteTest('btTag10', true, done, 9);
    });

    it('can write a "false" to a boolean table element', function(done)
    {
        readWriteTest('btTag10', false, done, 9);
    });


    it('can write 0 to an integer value', function(done)
    {
        readWriteTest('nTag0', 0, done);
    });

    it('can write 1234 to an integer value', function(done)
    {
        readWriteTest('nTag0', 1234, done);
    });


    it('hasTagMap() works', function()
    {
        var localApiClient = new DatastoreApiEx(TestSettings.groovApiKey, 'https://' + TestSettings.groovAddress, publicCertFile, caCertFile);

        should(localApiClient.hasTagMap()).be.exactly(false);

        // Shared API object should already have a tag map (assuming this isn't the first
        // test to be run).
        should(sharedApiClient.hasTagMap()).be.exactly(true);
    });

    it('hasConfigError() returns false when API key is missing', function()
    {
        var localApiClient = new DatastoreApiEx(null, 'https://' + TestSettings.groovAddress, publicCertFile, caCertFile);
        should(localApiClient.hasConfigError()).be.exactly(true);
    });

    it('hasConfigError() returns true when API key is present', function()
    {
        should(sharedApiClient.hasConfigError()).be.exactly(false);
    });

    it('getReadSingleTagByNamePromise() will load the tag map', function(done)
    {
        var localApiClient = new DatastoreApiEx(TestSettings.groovApiKey, 'https://' + TestSettings.groovAddress, publicCertFile, caCertFile);

        should(localApiClient.hasTagMap()).be.exactly(false);

        localApiClient.getServerType(() =>
        {
            localApiClient.getReadSingleTagByNamePromise('NodeRedTestDataStore', 'dTag0', undefined, undefined, (promise: Promise<PromiseResponse>, error: string): void =>
            {
                should(error).be.null();
                promise.then((fullfilledResponse: PromiseResponse) =>
                {
                    should(localApiClient.hasTagMap()).be.exactly(true);
                    done()
                });
            });
        })

    });


    it('getWriteSingleTagByNamePromise() will load the tag map', function(done)
    {
        var localApiClient = new DatastoreApiEx(TestSettings.groovApiKey, 'https://' + TestSettings.groovAddress, publicCertFile, caCertFile);

        should(localApiClient.hasTagMap()).be.exactly(false);

        localApiClient.getServerType(() =>
        {
            localApiClient.getWriteSingleTagByNamePromise('4.5', 'NodeRedTestDataStore', 'dTag0', undefined, (promise: Promise<PromiseResponse>, error: string): void =>
            {
                should(error).be.null();
                promise.then((fullfilledResponse: PromiseResponse) =>
                {
                    should(localApiClient.hasTagMap()).be.exactly(true);
                    done()
                });
            });
        });
    });


    it('getReadSingleTagByNamePromise() will return error with a bad address', function(done)
    {
        this.timeout(8000);
        var localApiClient = new DatastoreApiEx(TestSettings.groovApiKey, 'https://junky-junk-junk', publicCertFile, caCertFile);
        localApiClient.getReadSingleTagByNamePromise('NodeRedTestDataStore', 'dTag0', undefined, undefined,
            (promise: Promise<PromiseResponse>, error: any): void =>
            {
                should(error).be.not.null();
                should(error.code).be.oneOf(['EHOSTUNREACH', 'ENOTFOUND', 'EAI_AGAIN']);
                done();
            });
    });


    it('getWriteSingleTagByNamePromise() will return error with a bad address', function(done)
    {
        var localApiClient = new DatastoreApiEx(TestSettings.groovApiKey, 'https://junky-junk-junk');
        localApiClient.getWriteSingleTagByNamePromise('4.5', 'NodeRedTestDataStore', 'dTag0', undefined,
            (promise: Promise<PromiseResponse>, error: any): void =>
            {
                should(error).be.not.null();
                should(error.code).be.oneOf(['EHOSTUNREACH', 'ENOTFOUND', 'EAI_AGAIN']);
                done();
            });
    });

    it('getReadSingleTagByNamePromise() with bad tag name returns an error', function(done)
    {
        sharedApiClient.getReadSingleTagByNamePromise('NodeRedTestDataStore', 'Homer', undefined, undefined,
            (promise: Promise<PromiseResponse>, error: string): void =>
            {
                should(error).be.not.null();
                should(error).be.exactly('unknown tag name');
                done()
            });
    });

    it('getReadSingleTagByNamePromise() with bad data store name returns an error', function(done)
    {
        sharedApiClient.getReadSingleTagByNamePromise("Marge's Data Store", 'dTag0', undefined, undefined,
            (promise: Promise<PromiseResponse>, error: string): void =>
            {
                should(error).be.not.null();
                should(error).be.exactly('unknown device name');
                done()
            });
    });

    it('getWriteSingleTagByNamePromise() with bad tag name returns an error', function(done)
    {
        sharedApiClient.getWriteSingleTagByNamePromise('4.5', 'NodeRedTestDataStore', 'Homer', undefined, (promise: Promise<PromiseResponse>, error: string): void =>
        {
            should(error).be.not.null();
            should(error).be.exactly('unknown tag name');
            done()
        });
    });

    it('getWriteSingleTagByNamePromise() with bad data store name returns an error', function(done)
    {
        sharedApiClient.getWriteSingleTagByNamePromise('4.5', "Marge's Data Store", 'dTag0', undefined, (promise: Promise<PromiseResponse>, error: string): void =>
        {
            should(error).be.not.null();
            should(error).be.exactly('unknown device name');
            done()
        });
    });



});

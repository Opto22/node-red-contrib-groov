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

// This file has tests for the core parts of the Swagger codegen REST API client.
// But it still uses DatastoreApiEx rather than DatastoreApi. This division is really
// only meant to keep the files organized and to a reasonable size.
describe('Swagger codegen API client', function()
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

    it('dataStoreListDevices() works', function(done)
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

    it('dataStoreListTags() works', function(done)
    {
        sharedApiClient.dataStoreListTags().then(
            (fullfilledResponse: PromiseResponse) =>
            {
                var tags = fullfilledResponse.body;

                should(tags).be.an.Array();

                for (var tag of tags) {
                    should(tag).be.an.Object();
                    should(tag).have.properties(['id', 'name', 'dataType']);
                    // TODO Add more details
                }

                done();
            },
            (error: any) =>
            {
                done(error);
            }
        );
    });


    it('dataStoreReadSingleTag() test', function(done)
    {
        sharedApiClient.dataStoreWriteSingleTag(6, '123.456').then(
            (fullfilledResponse: PromiseResponse) =>
            {
                sharedApiClient.dataStoreReadSingleTag(6).then(
                    (fullfilledResponse: PromiseResponse) =>
                    {
                        var value: DatastoreApi.FloatValue = fullfilledResponse.body;

                        should(value).property('valueType').equal('floatValue');
                        should(value).property('value').equal(123.456);

                        done();
                    },
                    (error: any) =>
                    {
                        console.log('error = ' + JSON.stringify(error));
                        done(error);
                    }
                );
            })
    });


    it('dataStoreReadTags() test', function(done)
    {
        let tagsToWrite = [
            { id: 5, value: 'true' },
            { id: 6, value: '-123.45' },
            { id: 8, value: '-987' },
            { id: 11, value: 'I am a string' }];

        sharedApiClient.dataStoreWriteTags(tagsToWrite, (error: Error): void =>
        {
            should(error).be.null();

            sharedApiClient.dataStoreReadTags([
                { id: 5, index: 0, count: 0 }, // bTag0
                { id: 6, index: 0, count: 0 }, // dTag0
                { id: 8, index: 0, count: 0 }, // nTag0
                { id: 11, index: 0, count: 0 } //  sTag0
            ]).then(
                (fullfilledResponse: PromiseResponse) =>
                {
                    var value: DatastoreApi.TagValue[] = fullfilledResponse.body;

                    should(value[0]).property('valueType').equal('booleanValue');
                    should(value[0]).property('value').equal(true);

                    should(value[1]).property('valueType').equal('floatValue');
                    should(value[1]).property('value').equal(-123.45);

                    should(value[2]).property('valueType').equal('integerValue');
                    should(value[2]).property('value').equal(-987);

                    should(value[3]).property('valueType').equal('stringValue');
                    should(value[3]).property('value').equal('I am a string');

                    done();
                },
                (error: any) =>
                {
                    console.log('error = ' + JSON.stringify(error));
                    done(error);
                }
            );
        });
    });

    function assertThrows(callback: () => void, done: MochaDone)
    {
        should.throws(() =>
        {
            callback();
        }, (error: any) =>
            {
                done();
                return true;
            }
        );
    }

    it('dataStoreReadSingleTag() throws error with missing id', function(done)
    {
        assertThrows(() => 
        {
            sharedApiClient.dataStoreReadSingleTag(undefined).then();
        }, done);
    });


    it('dataStoreWriteSingleTag() throws error with missing id', function(done)
    {
        assertThrows(() => 
        {
            sharedApiClient.dataStoreWriteSingleTag(undefined, 'value goes here').then();
        }, done);
    });

    it('dataStoreWriteSingleTag() throws error with missing value', function(done)
    {
        assertThrows(() => 
        {
            sharedApiClient.dataStoreWriteSingleTag(1, undefined, ).then();
        }, done);
    });

    it('dataStoreReadSingleTag() for table', function(done)
    {
        // Write the values
        let tagsToWrite = [
            { id: 12, value: '0.1', index: 0 }, // id 10 is ntTag10
            { id: 12, value: '0', index: 1 },
            { id: 12, value: '0', index: 2 },
            { id: 12, value: '3.3', index: 3 },
            { id: 12, value: '0', index: 4 },
            { id: 12, value: '0', index: 5 },
            { id: 12, value: '0', index: 6 },
            { id: 12, value: '0', index: 7 },
            { id: 12, value: '0', index: 8 },
            { id: 12, value: '0', index: 9 }];

        sharedApiClient.dataStoreWriteTags(tagsToWrite, (error: Error): void =>
        {
            should(error).be.null();

            sharedApiClient.dataStoreReadSingleTag(12, 0, 4).then(
                (fullfilledResponse: PromiseResponse) =>
                {
                    var value: DatastoreApi.FloatValue = fullfilledResponse.body;

                    should(value).property('valueType').equal('floatArrayValue');
                    should(value).property('value').match([0.1, 0, 0, 3.3]);

                    done();
                },
                (error: any) =>
                {
                    console.log('error = ' + JSON.stringify(error));
                    done(error);
                }
            );
        });

    });

});

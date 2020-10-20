/*
   Copyright Opto 22

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
import * as NodeHandlers from "../src/node-handlers";
import * as ConfigHandler from "../src/config-handler";
import * as MockNode from "opto22-node-red-common/lib/mocks/MockNode";
import * as MockRed from "opto22-node-red-common/lib/mocks/MockRed";
import { DatastoreApiEx } from '../src/api-ex';
import { NodeBaseConfiguration } from '../src/node-handlers';
import { NodeReadConfiguration } from '../src/node-handlers';
import { NodeWriteConfiguration } from '../src/node-handlers';
import { MockGroovWriteNode } from './mock-groov-nodes';
import { MockGroovReadNode } from './mock-groov-nodes';
import { MockGroovDataStoreNode } from './mock-groov-nodes';
import { MockGroovProjectNode } from './mock-groov-nodes';
import * as NodeRed from 'opto22-node-red-common/typings/nodered';
import * as fs from 'fs';
import * as http from "http";
import * as Promise from 'bluebird';
import * as should from 'should';
import * as assert from 'assert';
import { TagDefinition } from "../src/api";
import * as ClientTestUtil from './client-test-util';

var TestSettings = require('./settings.json');


var RED = new MockRed.MockRed();

// TODO Extract this out (it's elsewhere too)
interface PromiseResponse
{
    response: http.ClientResponse;
    body: any; // Since we don't do anything much with the response bodies, we can ignore the type.
}


function injectMsg(nodeConfig: NodeReadConfiguration | NodeWriteConfiguration, dataStoreConfig: ConfigHandler.DataStoreNode, node: NodeRed.Node, msg: any)
{
    // Create the node's worker implementation.
    var nodeHandlerImpl: NodeHandlers.NodeBaseImpl;
    if (nodeConfig.type === NodeHandlers.ReadNodeImpl.getNodeType()) {
        nodeHandlerImpl = new NodeHandlers.ReadNodeImpl(node, <NodeReadConfiguration>nodeConfig);
    }
    else if (nodeConfig.type === NodeHandlers.WriteNodeImpl.getNodeType()) {
        nodeHandlerImpl = new NodeHandlers.WriteNodeImpl(node, nodeConfig);
    }

    // Send it a basic message, like an Inject Timestamp node does.
    nodeHandlerImpl.addMsg(msg);
}

function createDeviceConfig(id: string, address: string,
    key: string, publicCertPath?: string, caCertPath?: string): ConfigHandler.ProjectNode
{
    var deviceConfig = new MockGroovProjectNode(id, address,
        {
            key: key,
            publicCertPath: publicCertPath || '',
            caCertPath: caCertPath || '',
        });

    RED.nodes.addNode(deviceConfig);

    return deviceConfig;
}

function createDataStoreConfig(id: string, name: string,
    project: ConfigHandler.ProjectNode): ConfigHandler.DataStoreNode
{
    var dataStoreConfig = new MockGroovDataStoreNode(id, name, project);

    RED.nodes.addNode(dataStoreConfig);

    return dataStoreConfig;
}

function injectTimestampMsg(nodeConfig: NodeReadConfiguration | NodeWriteConfiguration, dataStoreConfig: ConfigHandler.DataStoreNode, node: NodeRed.Node)
{
    injectMsg(nodeConfig, dataStoreConfig, node, { "payload": 1466009468654 });
}

function testReadNode(dataStoreId: string, tagName: string,
    responseCallback: (msg: any) => void, msg?: any,
    valueType?: string, valueProperty?: string,
    tableStartIndex?: number, tableLength?: number,
    topicType?: string, topicValue?: string): any
{
    // Create a node's configuration.
    var nodeConfig = {
        "id": "930e8d11.9abbf", // This is just an example ID. Nothing special about it.
        "type": NodeHandlers.ReadNodeImpl.getNodeType(),
        "dataStore": dataStoreId,
        "tagName": tagName,
        "tableStartIndex": typeof tableStartIndex === "undefined" ? "" : tableStartIndex.toString(),
        "tableLength": typeof tableLength === "undefined" ? "" : tableLength.toString(),
        "valueType": valueType || 'msg.payload',
        "value": valueProperty || '',
        "topicType": topicType || 'none',
        "topic": topicValue || '',
        "name": ""
    };

    // Create a mock node.
    var node = new MockGroovReadNode(responseCallback);

    if (msg !== undefined) {
        injectMsg(nodeConfig, RED.nodes.getNode(dataStoreId), node, msg);
    }
    else {
        injectTimestampMsg(nodeConfig, RED.nodes.getNode(dataStoreId), node);
    }
}

function testWriteNode(dataStoreId: string, tagName: string, valueType: string,
    valueProperty: string, msg: any, responseCallback: (msg: any) => void, tableStartIndex?: number): any
{
    // Create a node's configuration.
    var nodeConfig = {
        "id": "930e8d11.9abbf", // This is just an example ID. Nothing special about it.
        "type": NodeHandlers.WriteNodeImpl.getNodeType(),
        "dataStore": dataStoreId,
        "tagName": tagName,
        "valueType": valueType,
        "value": valueProperty,
        "tableStartIndex": typeof tableStartIndex === "undefined" ? "" : tableStartIndex.toString(),
        "tableLength": "",
        "name": "",
    };

    // Create a mock node.
    var node = new MockGroovWriteNode(responseCallback);

    if (msg) {
        injectMsg(nodeConfig, RED.nodes.getNode(dataStoreId), node, msg);
    }
    else {
        injectTimestampMsg(nodeConfig, RED.nodes.getNode(dataStoreId), node);
    }
}

function testReadNodeError(dataStoreId: string, tagName: string,
    errorCallback: (errorText: any, nodeMessage: any) => void, msg?: any,
    valueType?: string, valueProperty?: string,
    tableStartIndex?: number, tableLength?: number,
    topicType?: string, topicValue?: string): any
{
    // Create a node's configuration.
    var nodeConfig: NodeReadConfiguration = {
        "id": "930e8d11.9abbf", // This is just an example ID. Nothing special about it.
        "type": NodeHandlers.ReadNodeImpl.getNodeType(),
        "dataStore": dataStoreId,
        "tagName": tagName,
        "tableStartIndex": typeof tableStartIndex === "undefined" ? "" : tableStartIndex.toString(),
        "tableLength": typeof tableLength === "undefined" ? "" : tableLength.toString(),
        "valueType": valueType || 'msg.payload',
        "value": valueProperty || '',
        "topicType": topicType || 'none',
        "topic": topicValue || '',
        "name": ""
    };

    // Create a mock node.
    var node = new MockGroovReadNode(null, errorCallback);

    if (msg !== undefined) {
        injectMsg(nodeConfig, RED.nodes.getNode(dataStoreId), node, msg);
    }
    else {
        injectTimestampMsg(nodeConfig, RED.nodes.getNode(dataStoreId), node);
    }
}

function testReadNodeDisplayError(dataStoreId: string, tagName: string, statusText: string): void
{
    // Create a node's configuration.
    var nodeConfig: NodeReadConfiguration = {
        "id": "930e8d11.9abbf", // This is just an example ID. Nothing special about it.
        "type": NodeHandlers.ReadNodeImpl.getNodeType(),
        "dataStore": dataStoreId,
        "tagName": tagName,
        "tableStartIndex": "",
        "tableLength": "",
        "valueType": "msg.payload",
        "value": "",
        "topic": "",
        "topicType": "none",
        "name": "",
    };

    // Create a mock node.
    var node = new MockGroovReadNode(null);

    injectTimestampMsg(nodeConfig, RED.nodes.getNode(dataStoreId), node);
    should(node.getStatus()).match({ fill: 'red', shape: 'dot', text: statusText });
}

function testWriteNodeError(dataStoreId: string, tagName: string, valueType: string, valueProperty: any,
    msg: any, errorCallback: (errorText: any, nodeMessage: any) => void): any
{
    // Create a node's configuration.
    var nodeConfig = {
        "id": "930e8d11.9abbf", // This is just an example ID. Nothing special about it.
        "type": NodeHandlers.WriteNodeImpl.getNodeType(),
        "dataStore": dataStoreId,
        "tagName": tagName,
        "valueType": valueType,
        "value": valueProperty,
        "tableStartIndex": "",
        "tableLength": "",
        "name": "",
    };

    // Create a mock node.
    var node = new MockGroovWriteNode(null, errorCallback);

    injectMsg(nodeConfig, RED.nodes.getNode(dataStoreId), node, msg);
}

var tagNameToDefMap: {
    [key: string]: TagDefinition
} = {};


function getTagMap(apiClient: DatastoreApiEx, done: (error?: any) => void)
{
    apiClient.dataStoreListTags().then(
        (fullfilledResponse: PromiseResponse) =>
        {
            var tags = fullfilledResponse.body;

            should(tags).be.an.Array();

            for (var tag of tags) {
                tagNameToDefMap[tag.name] = tag; // capture all the tags by name
            }

            done();
        },
        (error: any) =>
        {
            done(error);
        }
    );
}


describe('Groov Data Store Nodes', function()
{
    // Create a "groov-device" device configuration.
    let dataStoreConfig: ConfigHandler.DataStoreNode;
    let dataStoreConfigMissingGroov: ConfigHandler.DataStoreNode;
    let dataStoreConfigMissingApiKey: ConfigHandler.DataStoreNode;
    let dataStoreConfigBadAddress: ConfigHandler.DataStoreNode;
    let dataStoreConfigBadPath: ConfigHandler.DataStoreNode;
    
    // Create a client that allows us to avoid conflict with 
    // the instance used inside of the nodes.  We don't want to
    // interfere with it at all.
    let clientLibAndCerts = ClientTestUtil.createClient();
    let apiClient: DatastoreApiEx = clientLibAndCerts.sharedApiClient;

    before(function(beforeDone: MochaDone)
    {
        let deviceConfig = createDeviceConfig('deviceId0', TestSettings.groovAddress,
            TestSettings.groovApiKey, TestSettings.groovCaCertPath);
        let deviceConfigMissingApiKey = createDeviceConfig('deviceId1', TestSettings.groovAddress,
            '');
        let deviceConfigBadAddress = createDeviceConfig('deviceId2', 'not_a_good_address',
            "api key doesn't matter here");
        let deviceConfigBadPath = createDeviceConfig('deviceId3', TestSettings.groovAddress + '/extra_junk',
            TestSettings.groovApiKey);

        dataStoreConfig = createDataStoreConfig('dataStoreId0', 'NodeRedTestDataStore', deviceConfig);
        dataStoreConfigMissingGroov = createDataStoreConfig('dataStoreId1', 'NodeRedTestDataStore2', null);
        dataStoreConfigMissingApiKey = createDataStoreConfig('dataStoreId2', 'NodeRedTestDataStore3', deviceConfigMissingApiKey);
        dataStoreConfigBadAddress = createDataStoreConfig('dataStoreId3', 'NodeRedTestDataStore4', deviceConfigBadAddress);
        dataStoreConfigBadPath = createDataStoreConfig('dataStoreId4', 'NodeRedTestDataStore4', deviceConfigBadPath);


       ConfigHandler.globalConnections.createConnection(dataStoreConfig.project.address,
            dataStoreConfig.project.credentials.key, 
            clientLibAndCerts.publicCertFile, clientLibAndCerts.caCertFile, 'REJECT_NEW',
            dataStoreConfig.project.id);

        ConfigHandler.globalConnections.createConnection(dataStoreConfigMissingApiKey.project.address,
            dataStoreConfigMissingApiKey.project.credentials.key, 
            clientLibAndCerts.publicCertFile, clientLibAndCerts.caCertFile, 'REJECT_NEW',
            dataStoreConfigMissingApiKey.project.id);

        ConfigHandler.globalConnections.createConnection(dataStoreConfigBadAddress.project.address,
            dataStoreConfigBadAddress.project.credentials.key, 
            clientLibAndCerts.publicCertFile, clientLibAndCerts.caCertFile, 'REJECT_NEW',
            dataStoreConfigBadAddress.project.id);

        ConfigHandler.globalConnections.createConnection(dataStoreConfigBadPath.project.address,
            dataStoreConfigBadPath.project.credentials.key, 
            clientLibAndCerts.publicCertFile, clientLibAndCerts.caCertFile, 'REJECT_NEW',
            dataStoreConfigBadPath.project.id);

        should.exist(ConfigHandler.globalConnections.getConnection(dataStoreConfig.project.id));

        NodeHandlers.setRED(RED);
        ConfigHandler.setRED(RED);


        apiClient.getDeviceType(undefined, () =>
        {
            getTagMap(apiClient, () =>
            {
                let tagId = tagNameToDefMap['ntTag10'].id;

                // Write to tags that we won't change while running this test suite.
                let tagsToWrite = [
                    { id: tagId, value: '0', index: 0 }, // id 10 is ntTag10
                    { id: tagId, value: '11', index: 1 },
                    { id: tagId, value: '22', index: 2 },
                    { id: tagId, value: '33', index: 3 },
                    { id: tagId, value: '44', index: 4 },
                    { id: tagId, value: '55', index: 5 },
                    { id: tagId, value: '66', index: 6 },
                    { id: tagId, value: '77', index: 7 },
                    { id: tagId, value: '88', index: 8 },
                    { id: tagId, value: '99', index: 9 }];

                apiClient.dataStoreWriteTags(tagsToWrite, (error: Error): void =>
                {
                    should(error).be.null();
                    beforeDone();
                });
            });
        });
    });


    it('can read a boolean set to true into msg.payload', function(done)
    {
        assertRead(dataStoreConfig.id, 'bTag0', true, done);
    });

    it('can read a boolean set to false into msg.payload', function(done)
    {
        assertRead(dataStoreConfig.id, 'bTag0', false, done);
    });

    it('can read a boolean set to true into a msg property', function(done)
    {
        assertRead(dataStoreConfig.id, 'bTag0', true, done, undefined, 'msg', 'my_property');
    });

    it('can read a boolean set to false into a msg property', function(done)
    {
        assertRead(dataStoreConfig.id, 'bTag0', false, done, undefined, 'msg', 'my_property');
    });

    it("read node won't change Topic when set to 'none'", function(done)
    {
        assertRead(dataStoreConfig.id, 'bTag0', false, done, undefined,
            'msg', 'my_property', undefined, undefined, '');
    });

    it("read node won't change Topic when set to 'none'", function(done)
    {
        assertRead(dataStoreConfig.id, 'bTag0', false, done, { topic: 'my topic' },
            'msg', 'my_property', undefined, undefined, 'none', '', 'my topic');
    });

    it("read node won't change Topic when set to 'user'", function(done)
    {
        assertRead(dataStoreConfig.id, 'bTag0', false, done, { topic: 'my old topic' },
            'msg', 'my_property', undefined, undefined, 'user', 'my new topic', 'my new topic');
    });

    it("read node won't change Topic when set to an unknown topic type", function(done)
    {
        assertRead(dataStoreConfig.id, 'bTag0', false, done, { topic: 'my topic' },
            'msg', 'my_property', undefined, undefined, 'unknown topic type', '', 'my topic');
    });


    it('Read node returns error for an unknown tag name', function(done)
    {
        testReadNodeError(dataStoreConfig.id, 'tag not here',
            (errorText: any, msg: any) =>
            {
                // Do the actual checks here.
                should(msg.groovError.message).be.exactly('unknown tag name');
                should.exist(msg.payload);

                done();
            });
    });

    it('Read node returns error for bad Groov address', function(done)
    {
        testReadNodeError(dataStoreConfigBadAddress.id, "tag doesn't matter in this test",
            (errorText: any, msg: any) =>
            {
                should.exist(errorText);
                should.exist(msg.reqError); // Don't care about the details, since they might vary.

                done();
            });
    });

    // it('Read node returns error for Groov address with extra path junk', function(done)
    // {
    //     testReadNodeError(dataStoreConfigBadPath.id, "tag doesn't matter in this test",
    //         (errorText: any, msg: any) =>
    //         {
    //             should(errorText).be.exactly("Not found. HTTP response error : 404");
    //             should(msg.resError.statusCode).be.exactly(404);

    //             done();
    //         });
    // });

    it('Read node returns error for missing Data Store configuration', function(done)
    {
        testReadNodeError('999', 'tag not here',
            (errorText: any, msg: any) =>
            {
                should(errorText).be.exactly('Missing Data Store configuration');
                should(msg).match({});

                done();
            });
    });


    it('Read node returns error for missing Groov configuration', function(done)
    {
        testReadNodeError(dataStoreConfigMissingGroov.id, 'tag not here',
            (errorText: any, msg: any) =>
            {
                // Do the actual checks here.
                should(errorText).be.exactly('Missing Groov configuration');
                should(msg).match({});

                done();
            });
    });

    it('Read node displays error for missing API key', function()
    {
        testReadNodeDisplayError(dataStoreConfigMissingApiKey.id, 'nTag0', 'Configuration error');
    });

    it('Write node returns error for an unknown tag name', function(done)
    {
        testWriteNodeError(dataStoreConfig.id, 'tag not here', 'msg.payload', 'the value', { payload: 'whatever' },
            (errorText: any, msg: any) =>
            {
                // Do the actual checks here.
                should(msg.groovError.message).be.exactly('unknown tag name');
                should.exist(msg.payload);

                done();
            });
    });


    function apiLibWriteTag(tagName: string, testValue: any,
        fullfillResponse: (fullfilledResponse: PromiseResponse) => void,
        errorResponse?: (error: any) => void,
        tableIndex?: number)
    {
        apiClient.getWriteSingleTagByNamePromise(JSON.stringify(testValue), 'NodeRedTestDataStore', tagName, tableIndex,
            (promise: Promise<PromiseResponse>, error: any): void =>
            {
                if (promise) {
                    promise.then(fullfillResponse, errorResponse);
                }
            });
    }

    function assertRead(dataStoreId: string, tagName: string,
        value: any, done?: MochaDone, msg?: any,
        valueType?: string, valueProperty?: string,
        tableStartIndex?: number, tableLength?: number,
        topicType?: string, topicValue?: string, expectedTopicValue?: string)
    {
        apiLibWriteTag(tagName, value,
            (fullfilledResponse: PromiseResponse) =>
            {
                testReadNode(dataStoreId, tagName, (msg: any) =>
                {
                    if (!valueType || valueType === 'msg.payload') {
                        should(msg.payload).equal(value);
                    }
                    else {
                        should(msg[valueProperty]).equal(value);
                    }
                    should(msg.body.value).equal(value);

                    if (topicType === 'none') {
                        if (expectedTopicValue) {
                            should(msg.topic).equal(expectedTopicValue);
                        }
                    }

                    if (done) {
                        done(); // Tell Mocha that we're done.
                    }
                },
                    msg, valueType, valueProperty, tableStartIndex, tableLength,
                    topicType, topicValue);
            },
            (error: any) =>
            {
                //console.log('error = ' + JSON.stringify(error));
                done(error);
            }, tableStartIndex);
    }




    function assertWrite(dataStoreId: string, tagName: string,
        valueType: string, valueProperty: string, msg: any, expectedValue: any, done?: () => any, tableIndex?: number)
    {
        testWriteNode(dataStoreId, tagName, valueType, valueProperty, msg,
            (msg: any) =>
            {
                // Do a Read to vefify the Write.
                testReadNode(dataStoreId, tagName, (msg: any) =>
                {
                    should(msg.payload).match(expectedValue);
                    should(msg.body.value).match(expectedValue);

                    if (done) {
                        done(); // Tell Mocha that we're done.
                    }
                });
            }, tableIndex);
    }


    it('can write a boolean from a msg.payload value of true', function(done)
    {
        assertWrite(dataStoreConfig.id, 'bTag0', 'msg.payload', '',
            { payload: true }, true, done);
    });

    it('can write a boolean from a msg.payload value of false', function(done)
    {
        assertWrite(dataStoreConfig.id, 'bTag0', 'msg.payload', '',
            { payload: false }, false, done);
    });



    it('can write a boolean from a msg.payload string of true', function(done)
    {
        assertWrite(dataStoreConfig.id, 'bTag0', 'msg.payload', '',
            { payload: 'true' }, true, done);
    });

    it('can write a boolean from a msg.payload string of false', function(done)
    {
        assertWrite(dataStoreConfig.id, 'bTag0', 'msg.payload', '',
            { payload: 'false' }, false, done);
    });


    it('can write an integer from a msg.payload number', function(done)
    {
        assertWrite(dataStoreConfig.id, 'nTag0', 'msg.payload', '',
            { payload: 22 }, 22, done);
    });

    it('can write an integer from a msg.payload string', function(done)
    {
        assertWrite(dataStoreConfig.id, 'nTag0', 'msg.payload', '',
            { payload: '33' }, 33, done);
    });

    it('can write and read an integer table element from a msg.payload number', function(done)
    {
        assertWrite(dataStoreConfig.id, 'ntTag5', 'msg.payload', '',
            { payload: 44 }, [44], done);
    });


    it('can read integer table elements with index and length', function(done)
    {
        testReadNode(dataStoreConfig.id, 'ntTag10', (msg: any) =>
        {
            should(msg.payload).match([0, 11, 22, 33, 44]);
            done(); // Tell Mocha that we're done.
        }, {}, undefined, undefined, 0, 5);
    });


    it('reading table elements without start index or length returns first element', function(done)
    {
        testReadNode(dataStoreConfig.id, 'ntTag10', (msg: any) =>
        {
            should(msg.payload).match([0]);
            done(); // Tell Mocha that we're done.
        }, {});
    });

    it('reading table elements without start index but with a  length returns those elements', function(done)
    {
        testReadNode(dataStoreConfig.id, 'ntTag10', (msg: any) =>
        {
            should(msg.payload).match([0, 11, 22, 33, 44]);
            done(); // Tell Mocha that we're done.
        }, {}, undefined, undefined, undefined, 5);
    });

    it('reading table elements with a start index but without a length returns one element', function(done)
    {
        testReadNode(dataStoreConfig.id, 'ntTag10', (msg: any) =>
        {
            should(msg.payload).match([22]);
            done(); // Tell Mocha that we're done.
        }, {}, undefined, undefined, 2);
    });

    it('can read integer table elements from overrides', function(done)
    {
        let msg = {
            payload: {
                tableStartIndex: 2,
                tableLength: 3
            }
        };
        let expectedResponse = [22, 33, 44];

        testReadNode(dataStoreConfig.id, 'ntTag10', (msg: any) =>
        {
            should(msg.payload).match(expectedResponse);
            done(); // Tell Mocha that we're done.
        }, msg, undefined, undefined, 0, 5);
    });


    it('Read node throws an error when table start index is invalid', function(done)
    {
        testReadNodeError(dataStoreConfig.id, 'ntTag10',
            (errorText: any, msg: any) =>
            {
                // Do the actual checks here.
                should(msg.resError.statusCode).be.exactly(400);
                should(errorText).be.exactly('Bad request. HTTP response error : 400');

                done();
            }, {}, undefined, undefined, -1, 1);
    });

    function testReadNodeMsgOverride(tagNameForWrite: string, tagNameForRead: string,
        testValue: any, msg: any, done: MochaDone)
    {
        // First write the tag without using an override.
        apiLibWriteTag(tagNameForWrite, testValue,
            (fullfilledResponse: PromiseResponse) =>
            {
                testReadNode(dataStoreConfig.id, tagNameForRead, (msg: any) =>
                {
                    should(msg.payload).equal(testValue);
                    should(msg.body.value).equal(testValue);

                    if (done) done(); // Tell Mocha that we're done.
                }, msg);
            });
    }

    function testWriteNodeMsgOverride(dataStoreId: string,
        tagNameForWrite: string, tagNameForRead: string,
        testValue: any, msg: any, done: MochaDone)
    {
        // First write the tag without using an override.
        testWriteNode(dataStoreId, tagNameForWrite, 'value', JSON.stringify(testValue), msg,
            (msg: any): void =>
            {
                testReadNode(dataStoreConfig.id, tagNameForRead, (msg: any) =>
                {
                    should(msg.payload).equal(testValue);
                    should(msg.body.value).equal(testValue);

                    if (done) done(); // Tell Mocha that we're done.
                });
            });
    }

    it('can read an integer using a message override', function(done)
    {
        var testValue = 789;
        var tagName = 'nTag0';
        var msg = {
            payload: { tagName: tagName }
        };
        testReadNodeMsgOverride(tagName, 'ding dong', testValue, msg, done);
    });

    it('read node can handle msg.payload == undefined', function(done)
    {
        var msg = {
        };
        testReadNode(dataStoreConfig.id, 'nTag0', (msg: any) =>
        {
            should(msg.payload).be.type('number');
            done(); // Tell Mocha that we're done.
        }, msg);
    });

    it('read node can handle msg.payload == null', function(done)
    {
        var msg = {
            payload: 0
        };
        msg.payload = null;  // sometimes the msg.payload isn't set
        testReadNode(dataStoreConfig.id, 'nTag0', (msg: any) =>
        {
            should(msg.payload).be.type('number');
            done(); // Tell Mocha that we're done.
        }, msg);
    });

    it('write node can handle null value', function(done)
    {
        testWriteNodeError(dataStoreConfig.id, 'nTag0', 'msg.payload',
            '', { payload: null },
            (errorText: any, msg: any) =>
            {
                should(msg.groovError.message).be.exactly('value is null');
                done();
            });

    });


    it('can write an integer using a message override', function(done)
    {
        var testValue = 456;
        var tagName = 'nTag0';
        var msg = {
            payload: { tagName: tagName }
        };
        testWriteNodeMsgOverride(dataStoreConfig.id, 'jibber jabber', tagName, testValue, msg, done);
    });

    it('can write a string from a configured value', function(done)
    {
        assertWrite(dataStoreConfig.id, 'sTag0', 'value', 'abc XYZ',
            null, 'abc XYZ', done);
    });

    it('can write a string from a msg.payload string', function(done)
    {
        assertWrite(dataStoreConfig.id, 'sTag0', 'msg.payload', '',
            { payload: 'Beep bop 999' }, 'Beep bop 999', done);
    });


    it('can write a number from a custom Msg property', function(done)
    {
        assertWrite(dataStoreConfig.id, 'nTag0', 'msg', 'my_sweet_property',
            { my_sweet_property: 98716 }, 98716, done);
    });


    it('Write node returns error for a missing custom Msg property', function(done)
    {
        testWriteNodeError(dataStoreConfig.id, 'nTag0', 'msg', 'not_my_sweet_property',
            { my_sweet_property: 321687 },
            (errorText: any, msg: any) =>
            {
                // Don't care about the exact error, only that we got here.
                should.exist(errorText);
                should.exist(msg.my_sweet_property);

                done();
            });
    });

});

import { MockGroovProjectNode } from './mock-groov-nodes';
import { MockGroovDataStoreNode } from './mock-groov-nodes';
import { MockNode } from 'opto22-node-red-common/lib/mocks/MockNode';
import *  as MockRed from 'opto22-node-red-common/lib/mocks/MockRed';
import * as NodeHandlers from "../src/node-handlers";
import * as ConfigHandler from "../src/config-handler";
import * as should from 'should';
import * as assert from 'assert';

describe('Config handlers', function()
{
    var RED = new MockRed.MockRed();

    before(function()
    {
        // Inject a mock RED object
        NodeHandlers.setRED(RED);
        ConfigHandler.setRED(RED);
    });

    it('createProjectNode()', function()
    {
        var credNode = new MockNode('credentials');

        RED.nodes.addCredentials('projectNode1',
            {
                key: 'my-private-key',
                publicCertPath: '',
                caCertPath: ''
            });

        var projectNode = new MockNode(ConfigHandler.GroovProjectNodeType);

        // Need to call it with projectNode as 'this'
        ConfigHandler.createProjectNode.call(projectNode, {
            address: 'localhost',
            credentials: 'projectNode1', // ??? is that right?
            id: 'projectNode1',
            type: ConfigHandler.GroovProjectNodeType
        });

        // Test something
        (<ConfigHandler.ProjectNode><any>projectNode).credentials.key.should.be.equal('my-private-key');
    });


    it('createDataStoreNode()', function()
    {
        // We can use the mock project node.
        let projectNode = new MockGroovProjectNode('projectNode1', 'localhost', {
            key: 'my-private-key',
            publicCertPath: '',
            caCertPath: ''
        });
        RED.nodes.addNode(projectNode);

        // Use the basic mock node, not MockGroovDataStoreNode.
        var dataStoreNode = new MockNode(ConfigHandler.GroovDataStoreNodeType);

        // Need to call it with dataStoreNode as 'this'
        ConfigHandler.createDataStoreNode.call(dataStoreNode, {
            dsName: 'NodeRedTestDataStore',
            project: 'projectNode1',
            id: 'dataStore0',
            type: ConfigHandler.GroovDataStoreNodeType
        });

        // Test a few things
        (<ConfigHandler.DataStoreNode><any>dataStoreNode).project.id.should.be.equal('projectNode1');
        (<ConfigHandler.DataStoreNode><any>dataStoreNode).dsName.should.be.equal('NodeRedTestDataStore');
    });
});

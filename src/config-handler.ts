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

import * as ApiLib from "./api";
import * as ApiExLib from "./api-ex";
import * as CertificateUtil from 'opto22-node-red-common/lib/CertificateUtil';
import * as NodeRed from 'opto22-node-red-common/typings/nodered';
import * as  MessageQueue from 'opto22-node-red-common/lib/MessageQueue';

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as events from 'events';
import * as request from 'request';

var RED: NodeRed.RED;

export function setRED(globalRED: NodeRed.RED)
{
    RED = globalRED;
    globalConnections.addWatchEvent();
}

/**
 * Data structure matching what comes from Node-RED for the configuration via the user interface.
 */
export interface ProjectCredentials
{
    key: string;
    publicCertPath: string;
    caCertPath: string;
}

/**
 * Data structure matching what comes from Node-RED for the configuration via the user interface.
 */
export interface ProjectConfiguration extends NodeRed.NodeConfiguration
{
    address: string;
    credentials: string;
    msgQueueFullBehavior: MessageQueue.FullQueueBehaviorType;
}

export interface ProjectNode extends NodeRed.Node
{
    address: string;
    credentials: ProjectCredentials;
}

/**
 * Data structure matching what comes from Node-RED for the configuration via the user interface.
 */
export interface DataStoreConfiguration extends NodeRed.NodeConfiguration
{
    dsName: string;
    project: string;
}


export interface DataStoreNode extends NodeRed.Node
{
    dsName: string;
    project: ProjectNode;
}


export var GroovDataStoreNodeType = 'groov-data-store';
export var GroovProjectNodeType = 'groov-project';

export function createDataStoreNode(config: DataStoreConfiguration)
{
    // 'this' is bound to the actual node object
    var dataStoreNode: DataStoreNode = <DataStoreNode>this;

    // Create the node.
    RED.nodes.createNode(dataStoreNode, config);

    //console.log('createDataStoreNode -> config = ' + JSON.stringify(config));
    //console.log('createDataStoreNode -> this = ' + JSON.stringify(this));

    // Get the project node
    var projectNode: ProjectNode = <ProjectNode>RED.nodes.getNode(config.project);

    // Attach the projectNode to the dataStoreNode
    dataStoreNode.project = projectNode;


    // Attach the Data Store's name to the dataStorNode
    dataStoreNode.dsName = config.dsName;
}


/**
 * Called by Node-RED to create a 'groov-project' node.
 * The main goal is to create a connection with globalConnections.createConnection()
 */
export function createProjectNode(config: ProjectConfiguration)
{
    // 'this' is bound to the actual node object
    var projectNode: ProjectNode = <ProjectNode>this;

    // Create the node. This will also return the credential information
    // attached to 'this'.
    RED.nodes.createNode(projectNode, config);

    // console.log('createProjectNode -> config = ' + JSON.stringify(config));

    var address = config.address;
    var isLocalhost = address === 'localhost';

    var key = projectNode.credentials.key;
    var publicCertPath = projectNode.credentials.publicCertPath;
    var caCertPath = projectNode.credentials.caCertPath;

    // Make sure we have values and that they're clean enough to continue.
    key = key ? key : '';
    publicCertPath = publicCertPath ? publicCertPath.trim() : '';
    caCertPath = caCertPath ? caCertPath.trim() : '';

    var publicCertFile: Buffer;
    var caCertFile: Buffer;

    if (key === '') {
        RED.log.error('Missing API key for ' + address);
    }

    if (!isLocalhost) {
        try {
            publicCertFile = CertificateUtil.getCertFile(RED, publicCertPath);
            caCertFile = CertificateUtil.getCertFile(RED, caCertPath);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                RED.log.error('Cannot open certificate file at \'' + err.path + '\'.');
            }
            else if (err.code === 'EACCES') {
                RED.log.error('Cannot open certificate file at \'' + err.path + '\' due to file permissions.');
            }
            else {
                RED.log.error(err);
            }
        }
    }

    // console.log('createProjectNode -> config = ' + JSON.stringify(config));
    var apiClient = globalConnections.createConnection(address, key, publicCertFile, caCertFile,
        config.msgQueueFullBehavior, config.id);

    projectNode.on('close', () =>
    {
        apiClient.queue.dump(); // dump all but the current in-progress message for this connection.
    });
}


// Holder for controller connections and message queues.
class DataStoreConnection 
{
    public apiClient: ApiExLib.DatastoreApiEx;
    public queue: MessageQueue.default;

    constructor(apiClient: ApiExLib.DatastoreApiEx, queue: MessageQueue.default)
    {
        this.apiClient = apiClient;
        this.queue = queue;
    }
}

export class DataStoreConnections
{
    private connectionCache: DataStoreConnection[] = [];

    public createConnection(address: string, key: string, publicCertFile: Buffer, caCertFile: Buffer,
        msgQueueFullBehavior: MessageQueue.FullQueueBehaviorType, id: string): DataStoreConnection
    {
        // Create the connection to the Groov API.
        var apiClient = new ApiExLib.DatastoreApiEx(key, 'https://' + address, publicCertFile, caCertFile);

        // Cache it, using the Configuration node's id property.
        this.connectionCache[id] = new DataStoreConnection(apiClient,
            new MessageQueue.default(500, msgQueueFullBehavior));

        return this.connectionCache[id];
    }

    public getConnection(id: string): DataStoreConnection
    {
        return this.connectionCache[id];
    }

    public addWatchEvent()
    {
        RED.events.on('nodes-started', () =>
        {
            for (var client in this.connectionCache) {
                this.connectionCache[client].apiClient.clearTagMap();
            }
        });
    }

}

// Global cache of connections.
export var globalConnections = new DataStoreConnections();

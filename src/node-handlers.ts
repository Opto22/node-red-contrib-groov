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

// Import our modules
import * as ApiExLib from "./api-ex";
import * as ErrorHanding from "./error-handling";
import * as ConfigHandler from './config-handler';
import { ProjectNode } from './config-handler';
import { DataStoreNode } from './config-handler';
import MessageQueue from 'opto22-node-red-common/lib/MessageQueue';

// Import external modules
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as request from 'request';
import * as FormData from 'form-data';
import * as NodeRed from 'opto22-node-red-common/typings/nodered';
import * as Promise from 'bluebird';

var RED: NodeRed.RED;

export function setRED(globalRED: NodeRed.RED)
{
    RED = globalRED;
}


// This interface should match the "defaults" field in the Node HTML file.
// There's no way to directly connect the two.
export interface NodeBaseConfiguration extends NodeRed.NodeConfiguration
{
    dataStore: string;
    tagName: string;
    tableStartIndex: string;
    tableLength: string;
    name: string;
}

export interface NodeReadConfiguration extends NodeBaseConfiguration
{
    value: string;
    valueType: string; // 'msg' or 'msg.payload'
    topic: string;
    topicType: string; // 'none', 'auto', or 'user'
}

export interface NodeWriteConfiguration extends NodeBaseConfiguration
{
    value: string;
    valueType: string; // 'msg', 'msg.payload', or 'value';
}

interface PromiseResponse
{
    response: http.ClientResponse;
    body: any; // Since we don't do anything much with the response bodies, we can ignore the type.
}

/** Function pointer definition for Writing One Variable. */
interface WriteOneVarFunc
{
    (ioName: string, valueObj: { value: any }): Promise<{
        response: http.ClientResponse;
        body?: any;
    }>;
}

/** Function pointer definition for Writing One Variable. */
interface WriteOneTableFunc
{
    (ioName: string, valueObj: any[]): Promise<{
        response: http.ClientResponse;
        body?: any;
    }>;
}

/** Function pointer definition for Reading All Variables. */
interface ReadAllVarsFunc 
{
    (): Promise<{
        response: http.ClientResponse;
        body: Array<any>;
    }>;
}

/** Function pointer definition for Reading One Variable. */
interface ReadOneVarFunc
{
    (ioName: string): Promise<{
        response: http.ClientResponse;
        body: any;
    }>;
}

/** Function pointer definition for Reading All Tables. */
interface ReadAllTablesFunc
{
    (): Promise<{
        response: http.ClientResponse;
        body: Array<any>;
    }>;
}

/** Function pointer for Reading One Table. */
interface ReadOneTableFunc
{
    (tableName: string, startIndex?: number, numElements?: number): Promise<{
        response: http.ClientResponse;
        body: Array<any>;
    }>
}

/**
 * Base class for Groov API nodes.
 */
export abstract class NodeBaseImpl
{
    // The API client connection. 
    protected apiLib: ApiExLib.DatastoreApiEx;

    // Message queue to help throttle messages going to Groov.
    protected msgQueue: MessageQueue;

    // The user's node configuration.
    protected nodeConfig: NodeBaseConfiguration;

    // The user's Groov configurations (IP address and HTTPS settings)
    protected dataStoreNode: DataStoreNode;

    protected groovNode: ProjectNode;

    // The node object.
    protected node: NodeRed.Node;

    constructor(nodeConfig: NodeBaseConfiguration, node: NodeRed.Node)
    {
        //console.log('NodeBaseImpl -> nodeConfig = ' + JSON.stringify(nodeConfig));
        this.nodeConfig = nodeConfig;
        this.dataStoreNode = <DataStoreNode>RED.nodes.getNode(nodeConfig.dataStore);

        this.node = node;

        if (this.dataStoreNode) {

            if (this.dataStoreNode.project) {

                this.groovNode = <ProjectNode>RED.nodes.getNode(this.dataStoreNode.project.id);

                if (this.groovNode) {
                    var connection = ConfigHandler.globalConnections.getConnection(this.dataStoreNode.project.id);
                    this.apiLib = connection.apiClient;
                    this.msgQueue = connection.queue;
                }
            }

            // Make sure we got a Groov Project node.
            if (!this.groovNode) {
                this.node.error('Missing Groov configuration', {});
            }
        }
        else {
            this.node.error('Missing Data Store configuration', {});
        }
    }

    public abstract onInput(msg: any): void;

    /** Add message to the queue. */
    public addMsg(msg: any): void
    {
        // Check that we have a connection to use.
        if (!this.apiLib || !this.msgQueue) {
            // If there's no connection, immediately return and effectively
            // drop the message. An error is logged when the node is downloaded, which mirrors
            // what the official nodes do.
            this.node.status({ fill: "red", shape: "dot", text: 'missing Groov configuration' });
            return;
        }
        // Check for basic HTTPS configuration errors. If there are any, then don't even try.
        // Drop the message.
        if (this.apiLib.hasConfigError()) {
            this.node.status({ fill: "red", shape: "dot", text: 'Configuration error' });
            return;
        }

        this.apiLib.getServerType(() => {
            // Add the message to the queue.
            var queueLength = this.msgQueue.add(msg, this.node, this, this.onInput);
    
            // See if there's room for the message.
            if (queueLength < 0) {
                this.node.warn('Message rejected. Queue is full for Groov.');
            }
    
            // Update the node's status, but don't overwrite the status if this node is currently
            // being processed.
            var currentMsgBeingProcessed = this.msgQueue.getCurrentMessage();
            if (currentMsgBeingProcessed.inputEventObject !== this) {
                if (queueLength !== 0) {
                    this.updateQueuedStatus(queueLength);
                }
            }
        })

    }

    protected updateQueuedStatus(queueLength: number)
    {
        if (queueLength >= 1) {
            this.node.status({ fill: "green", shape: "ring", text: queueLength + ' queued' });
        }
        else if (queueLength < 0) {
            this.node.status({ fill: "yellow", shape: "ring", text: "queue full" });
        }
    }

    // The user can provide the tag name and table range as properties
    // in the message. These override anything in the node's configuration (the 'nodeConfig' parameter).
    protected checkMsgOverrides(msg: any, nodeConfig: NodeBaseConfiguration)
    {
        if (msg.payload) {
            if (typeof msg.payload === 'object') {

                if (msg.payload.tagName !== undefined) {
                    nodeConfig.tagName = msg.payload.tagName;
                }

                if (msg.payload.tableStartIndex !== undefined) {
                    nodeConfig.tableStartIndex = msg.payload.tableStartIndex;
                }

                if (msg.payload.tableLength !== undefined) {
                    nodeConfig.tableLength = msg.payload.tableLength;
                }

            }
        }
    }

}

/**
 * The implementation class for the Read nodes.
 */
export class ReadNodeImpl extends NodeBaseImpl
{
    private nodeReadConfig: NodeReadConfiguration

    static getNodeType(): string
    {
        return 'groov-read-ds';
    }

    constructor(node: NodeRed.Node, nodeConfig: NodeReadConfiguration)
    {
        super(nodeConfig, node);
        this.nodeReadConfig = nodeConfig;

        // Close events on the node object defer to the implementation object
        this.node.on('close', () => 
        {
            this.onClose();
        });

        // Input events on the node object defer to the implementation object
        this.node.on('input', (msg: any) =>
        {
            this.addMsg(msg);
        });
    }

    // Static function to create an implementation wrapper around the real node object
    static createReadNode(this: NodeRed.Node, nodeConfig: NodeReadConfiguration)
    {
        // 'this' is bound to the actual node object
        var node: NodeRed.Node = <NodeRed.Node>this; // for clarity

        // Node-RED creates the node object from the configuration
        RED.nodes.createNode(node, nodeConfig);

        // Create the implementation class.
        var impl = new ReadNodeImpl(node, nodeConfig);
    }

    // Handler for 'close' events from Node-RED.
    public onClose()
    {
        // When the node is deleted, reset the status. This will clear out any error details or pending
        // operations.
        this.node.status({});
    }

    // Handler for 'input' events from Node-RED.
    public onInput(msg: any)
    {
        if (!this.apiLib.hasTagMap()) {
            this.node.status({ fill: "green", shape: "dot", text: "downloading tag info" });
        }

        // Any values in the msg override what's configured in the node.
        this.checkMsgOverrides(msg, this.nodeConfig);

        // Parse the start index and table length. We can't assume that they're numbers.
        var tableStartIndex = parseInt(this.nodeConfig.tableStartIndex);
        var tableLength = parseInt(this.nodeConfig.tableLength);

        // Make sure we have a number.
        if (isNaN(tableStartIndex))
            tableStartIndex = undefined;
        if (isNaN(tableLength))
            tableLength = undefined;

        this.apiLib.getReadSingleTagByNamePromise(this.dataStoreNode.dsName, this.nodeConfig.tagName,
            tableStartIndex, tableLength,
            (promise: Promise<PromiseResponse>, error: string): void =>
            {
                if (error) {
                    ErrorHanding.handleErrorResponse(error, msg, this.node);
                    this.msgQueue.done(50);
                }
                else {
                    this.node.status({ fill: "green", shape: "dot", text: "reading" });

                    promise.then(
                        // onFullfilled handler
                        (fullfilledResponse: PromiseResponse) =>
                        {
                            this.node.status({});

                            // Always attach the response's body to msg.
                            msg.body = fullfilledResponse.body;

                            this.setValue(msg, fullfilledResponse);
                            this.setTopic(msg);

                            this.node.send(msg)
                            var queueLength = this.msgQueue.done(0);
                            this.updateQueuedStatus(queueLength);
                        },
                        // onRejected handler
                        (error: any) =>
                        {
                            ErrorHanding.handleErrorResponse(error, msg, this.node);
                            this.msgQueue.done(50);
                        }
                    );
                }
            });
    }

    private setValue(msg: any, fullfilledResponse: any) 
    {
        var newValue: any;

        // See if we can unwrap the value.
        if (typeof fullfilledResponse.body === 'object') {

            // If an array, just use it directly.
            if (Array.isArray(fullfilledResponse.body)) {
                newValue = fullfilledResponse.body;
            }
            else {
                // If there's a 'value' property in the body, then go ahead and unwrap
                // the value in the msg.payload.
                if (fullfilledResponse.body.value !== undefined) {
                    newValue = fullfilledResponse.body.value;
                } else {
                    newValue = fullfilledResponse.body;
                }
            }
        } else {
            // Not an object or array, so just use it directly.
            newValue = fullfilledResponse.body;
        }

        // See where the value should be placed.
        // valueType was added in v1.0.1, so will not exist on 1.0.0 nodes.
        var valueType = this.nodeReadConfig.valueType === undefined ?
            'msg.payload' : this.nodeReadConfig.valueType;
        switch (valueType) {
            case 'msg':
                RED.util.setMessageProperty(msg, this.nodeReadConfig.value, newValue, true);;
                break;
            case 'msg.payload':
                msg.payload = newValue;
                break;
            default:
                throw new Error('Unexpected value type - ' + valueType);
        }
    }

    private setTopic(msg: any)
    {
        var topicType = this.nodeReadConfig.topicType;

        switch (topicType) {
            case 'none':
                break;
            // case 'auto':
            //     msg.topic = 'TODO auto topic';
            //     break;
            case 'user':
                msg.topic = this.nodeReadConfig.topic;
                break;
            default:
                // Do nothing. Don't touch the topic.
                break;
        }
    }
}

/**
 * The implementation class for the Write nodes.
 */
export class WriteNodeImpl extends NodeBaseImpl
{

    private nodeWriteConfig: NodeWriteConfiguration
    static activeMessageCount: number = 0;

    constructor(node: NodeRed.Node, nodeConfig: NodeWriteConfiguration)
    {
        super(nodeConfig, node);
        this.nodeWriteConfig = nodeConfig;

        // Close events on the node object defer to the implementation object
        node.on('close', () =>
        {
            this.onClose();
        });

        // Input events on the node object defer to the implementation object
        node.on('input', (msg: any) =>
        {
            this.addMsg(msg);
        });
    }

    static getNodeType(): string
    {
        return 'groov-write-ds';
    }

    // Static function to create an implementation wrapper around the real node object
    static createWriteNode(this: NodeRed.Node, nodeConfig: NodeWriteConfiguration)
    {
        // 'this' is bound to the actual node object
        var node: NodeRed.Node = <NodeRed.Node>this; // for clarity

        // Node-RED creates the node object from the configuration
        RED.nodes.createNode(node, nodeConfig);

        // Create the implementation class.
        var impl = new WriteNodeImpl(node, nodeConfig);
    }

    // Handler for 'close' events from Node-RED.
    public onClose()
    {
        // When the node is deleted, reset the status. This will clear out any error details or pending
        // operations.
        this.node.status({});
    }

    // Handler for 'input' events from Node-RED.
    public onInput(msg: any): void
    {
        WriteNodeImpl.activeMessageCount++;

        if (!this.apiLib.hasTagMap()) {
            this.node.status({ fill: "green", shape: "dot", text: "downloading tag info" });
        }

        // Any values in the msg override what's configured in the node.
        this.checkMsgOverrides(msg, this.nodeConfig);

        try {
            var valueObject = this.getValueObject(msg);
        }
        catch (e) {
            var errorMessage: string;
            if (e instanceof Error)
                errorMessage = (<Error>e).message;
            else
                errorMessage = JSON.stringify(e);

            this.node.error(errorMessage, msg);
            this.node.status({ fill: "red", shape: "dot", text: "error" });
            this.msgQueue.done(0);
            return;
        }

        // Parse the start index. We can't assume it's a number.
        var tableStartIndex = parseInt(this.nodeConfig.tableStartIndex);

        // Make sure we have a number.
        if (isNaN(tableStartIndex))
            tableStartIndex = undefined;

        this.apiLib.getWriteSingleTagByNamePromise(valueObject, this.dataStoreNode.dsName,
            this.nodeConfig.tagName, tableStartIndex, (promise: Promise<PromiseResponse>, error: string): void =>
            {
                if (error) {
                    ErrorHanding.handleErrorResponse(error, msg, this.node);
                    WriteNodeImpl.activeMessageCount--;
                    this.msgQueue.done(50);
                }
                else {
                    this.node.status({ fill: "green", shape: "dot", text: "writing" });

                    promise.then(
                        // onFullfilled handler
                        (fullfilledResponse: PromiseResponse) =>
                        {
                            WriteNodeImpl.activeMessageCount--;

                            this.node.status({});
                            msg.body = fullfilledResponse.body;
                            this.node.send(msg);
                            var queueLength = this.msgQueue.done(0);
                            this.updateQueuedStatus(queueLength);
                        },
                        // onRejected handler
                        (error: any) =>
                        {
                            WriteNodeImpl.activeMessageCount--;
                            ErrorHanding.handleErrorResponse(error, msg, this.node);
                            this.msgQueue.done(50);
                        });
                }
            });
    }


    // Get the value to write. Might throw for any number of reasons, to be handled by the caller.
    private getValueObject(msg: any)
    {
        var valueObject: any = null;

        var nodeWriteConfig = this.nodeWriteConfig;

        switch (nodeWriteConfig.valueType) {
            case 'msg':
            case 'msg.payload':

                var msgProperty: string;

                if (nodeWriteConfig.valueType === 'msg.payload') {
                    msgProperty = 'payload';
                } else {
                    msgProperty = nodeWriteConfig.value;
                }

                // Get the value out of the message.
                var msgValue = RED.util.getMessageProperty(msg, msgProperty);

                // Confirm that we got something out of the message.
                if (msgValue === undefined) {
                    throw new Error('msg.' + msgProperty + ' is undefined.');
                }

                // Take the value with no extra processing.
                valueObject = msgValue;

                break;
            case 'value':
                // We have a string from the UI and need to figure it out.
                valueObject = nodeWriteConfig.value;
                break;
            default:
                throw new Error('Unexpected value type - ' + nodeWriteConfig.valueType);
        }

        return valueObject;
    }

}

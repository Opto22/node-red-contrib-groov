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

import http = require('http');
import https = require('https');
import fs = require('fs');
import events = require('events');
import request = require('request');
import Promise = require('bluebird');
import * as NodeRed from 'opto22-node-red-common/typings/nodered';

var DatastoreApi = ApiLib.DatastoreApi;

export interface WriteTagDef
{
    id: number;
    value: any;
    index?: number;
}


interface PromiseResponse
{
    response: http.ClientResponse;
    body: any;
}

// Function type for callbacks that provide a Promise.
export interface GetPromiseCallback
{
    (promise: Promise<PromiseResponse>, error: any): void;
}

declare module 'http' {
    interface AgentOptions
    {
        port: number; // currently missing from types file.
    }
}

// The TypeScript client generated with swagger-codegen does not allow us to add our own
// options to the Request library. However, there is an empty and useless default 
// authentication field which we can override and use it as a general extension point.
class RequestOptionsModifier
{
    private isLocalhost: boolean;

    private port: number;

    constructor(originalAddress: string, port: number, isLocalhost: boolean, private publicCertFile: Buffer, private caCertFile: Buffer, private agent: https.Agent)
    {
        this.isLocalhost = isLocalhost;
        this.port = port;
    }

    applyToRequest(requestOptions: request.Options): void
    {
        // Add the required options. Wish there was a more official way to do this.
        // An alternative is to customize the template used by the swagger-codegen tool.
        // This is good enough for now.

        if (this.publicCertFile) {
            requestOptions.cert = this.publicCertFile;
        }

        if (this.caCertFile) {
            requestOptions.ca = this.caCertFile;
        }

        // Local connections do not require certificates for HTTPS.
        if (!this.publicCertFile && !this.caCertFile && this.isLocalhost) {
            (<https.ServerOptions>requestOptions).rejectUnauthorized = false;
        }

        requestOptions.port = this.port;
        requestOptions.forever = true;
        requestOptions.agent = this.agent;
    }
}


export class DatastoreApiEx extends DatastoreApi
{
    private originalAddress: string;
    private isLocalHost: boolean;
    private port: number;
    private apiKey: string;
    private publicCertFile: Buffer;
    private caCertFile: Buffer;
    private httpAgent: http.Agent; // TODO: do we need to keep this around?
    private event: events.EventEmitter;
    private configError: boolean;

    private hasDeterminedSystemType: boolean;
    private isTargetGroovBox: boolean;
    private isTargetGroovEPIC: boolean;


    private tagMap: any;

    constructor(apiKey: string, address: string, publicCertFile?: Buffer, caCertFile?: Buffer)
    {
        // Assume that the target is a Groov Box, not EPIC.
        let path = '/api/';

        super(address + path);

        this.hasDeterminedSystemType = false;
        this.isTargetGroovBox = false;
        this.isTargetGroovEPIC = false;

        this.tagMap = null;
        this.originalAddress = address;
        this.port = 443;
        this.apiKey = apiKey;
        this.publicCertFile = publicCertFile;
        this.caCertFile = caCertFile;

        if (this.originalAddress.trim().toLowerCase() === 'https://localhost') {
            this.isLocalHost = true;

            //  For a Groov Box over localhost, use port 8443.
            if (this.isHostGroovBox()) {
                this.port = 8443;
            }
        }

        this.replaceDefaultAuthWithCustomRequestOptions();

        this.setApiKey(ApiLib.DatastoreApiApiKeys.api_key, apiKey);
    }

    private isHostGroovBox(): boolean
    {
        // Look for some obvious marks of a groov Box. This is probably overkill.
        var hasMmpServer = fs.existsSync("/etc/init.d/mmpserver");
        var hasSupervisor = fs.existsSync("/usr/sbin/supervisor-get-serial-number");
        var hasOptoapps = fs.existsSync("/var/lib/jetty/optoapps");

        return hasMmpServer && hasSupervisor && hasOptoapps;
    }

    static isHostEpic(): boolean
    {
        // Look for some obvious marks of an EPIC box.
        var hasOptoApps = fs.existsSync("/usr/share/nxtio/");

        return hasOptoApps;
    }

    // The TypeScript client generated with swagger-codegen does not allow us to add our own
    // options to the Request library. However, there is an empty and useless default 
    // authentication field which we can override and use it as a general extension point.
    private replaceDefaultAuthWithCustomRequestOptions()
    {
        var httpsAgent = new https.Agent({
            keepAlive: true,
            maxSockets: 1, // might not be needed anymore, since we now use MessageQueue.,
            port: this.port
            //, ciphers: 'RSA:!EXPORT:!eNULL:!SSLv2' // for sniffing in Wireshark with private key installed
        });

        // Cast from the HTTPS to the HTTP agent. The node.d.ts typing file doesn't define
        // https.Agent as being derived from http.Agent.
        this.httpAgent = <http.Agent>httpsAgent;

        // Replace the default authentication handler.
        this.authentications.default = new RequestOptionsModifier(this.originalAddress, this.port,
            this.isLocalHost, this.publicCertFile, this.caCertFile, httpsAgent);
    }

    public hasConfigError(): boolean
    {
        if (this.configError === undefined) {

            // Check for bad API key
            if (!this.apiKey) {
                this.configError = true;
            }
            else {
                this.configError = false;
            }
        }

        return this.configError;
    }


     /**
     * Determines the type of Groov View we're communicating with.
     * First tries the Groov Box/Server method, and then Groov EPIC method.
     * Both might fail, since the device may be unreachable.
     * Once determined, the type is cached.
     */
    public getDeviceType(node: NodeRed.Node | undefined, callback: (error?: any) => any)
    {
        if (this.hasDeterminedSystemType) {
            process.nextTick(callback);
        }
        else {
            if (node) {
                node.status({ fill: "green", shape: "ring", text: 'determining device type' });
            }

            super.dataStoreListDevices().then(
                // onFullfilled handler
                (fullfilledResponse: PromiseResponse) =>
                {
                    if (fullfilledResponse.body && Array.isArray(fullfilledResponse.body)) {
                        this.isTargetGroovBox = true;
                        this.hasDeterminedSystemType = true;
                        callback();
                    }
                    else {
                        // Try EPIC path instead.
                        this.basePath = '/view/api/';

                        super.dataStoreListDevices().then(
                            (fullfilledResponse: PromiseResponse) =>
                            {
                                if (fullfilledResponse.body && Array.isArray(fullfilledResponse.body)) {
                                    this.isTargetGroovEPIC = true;
                                    this.hasDeterminedSystemType = true;
                                    callback();
                                }
                                else {
                                    // Reset to default (Groov Box)
                                    this.basePath = this.originalAddress + '/api/';
                                    callback(); // error ?
                                }
                            }).catch((error: any) =>
                            {
                                callback(error);
                            });
                    }

                }
            ).catch((error: any) =>
            {
                // For certain errors, don't even continue.
                if (error && (error.code == 'ETIMEDOUT' || error.code == 'ENETUNREACH')) {
                    // We're done. No reason to try again.
                    callback(error);
                    return;
                }

                // Try EPIC path instead
                this.basePath = this.originalAddress + '/view/api/';
                super.dataStoreListDevices().then(
                    (fullfilledResponse: PromiseResponse) =>
                    {
                        if (fullfilledResponse.body && Array.isArray(fullfilledResponse.body)) {
                            this.isTargetGroovEPIC = true;
                            this.hasDeterminedSystemType = true;
                            callback();
                        }
                        else {
                            // Reset to default (Groov Box)
                            this.basePath = this.originalAddress + '/api/';
                            callback(); // error ?
                        }
                    }).catch((error: any) =>
                    {
                        callback(error);
                    });
            });
        }
    }

    public hasTagMap(): boolean
    {
        return this.tagMap ? true : false; // return booleans, not the map itself.
    }

    public clearTagMap()
    {
        this.tagMap = null;
    }

    private populateTagMap(callback: (error: any) => void)
    {
        this.tagMap = {};

        // Get the list of devices
        super.dataStoreListDevices().then(
            // onFullfilled handler
            (fullfilledResponse: PromiseResponse) =>
            {
                this.tagMap = {}; // create the empty object

                // The response body has an array of devices
                var devices = fullfilledResponse.body;

                // TODO Assert the response

                var deviceCallbackCount = 0; // for counting responses for all the devices

                devices.forEach((device: any): void =>
                {
                    if (device.deviceType === 'dataStoreDevice') {

                        // Create a tag array for this device
                        this.tagMap[device.name] = [];

                        // Request the tags for this device
                        super.dataStoreListDeviceTags(device.id).then(
                            // onFullfilled handler
                            (fullfilledResponse: PromiseResponse) => 
                            {
                                deviceCallbackCount++;

                                // The response body is a list of tags
                                var tags = fullfilledResponse.body;

                                // Create the map of this devices tags
                                var tagNameToIdMap = {};

                                // Create an entry for each tag.
                                for (var j = 0; j < tags.length; j++) {
                                    tagNameToIdMap[tags[j].name] = tags[j].id;
                                }

                                this.tagMap[device.name] = tagNameToIdMap;

                                if (deviceCallbackCount === devices.length) {
                                    callback(null); // no error
                                }
                            },
                            // onRejected handler
                            (error: any) =>
                            {
                                callback(error);
                            }
                        );
                    }
                });

            },
            // onRejected handler
            (error: any) =>
            {
                callback(error);
            }
        );
    }

    public getReadSingleTagByNamePromise(deviceName: string, tagName: string, index: number, count: number,
        callback: GetPromiseCallback): void
    {
        if (this.tagMap) {
            this.getReadSingleTagByNamePromiseImpl(deviceName, tagName, index, count, callback);
        }
        else {
            this.populateTagMap((error: any): void =>
            {
                if (error) {
                    callback(null, error);
                }
                else {
                    this.getReadSingleTagByNamePromiseImpl(deviceName, tagName, index, count, callback);
                }
            });
        }
    }

    private getReadSingleTagByNamePromiseImpl(deviceName: string, tagName: string, index: number, count: number,
        callback: GetPromiseCallback)
    {
        if (!this.tagMap[deviceName]) {
            callback(null, 'unknown device name');
        }
        else if (!this.tagMap[deviceName][tagName]) {
            callback(null, 'unknown tag name');
        }
        else {
            var tagID = this.tagMap[deviceName][tagName];

            if (callback) {
                callback(super.dataStoreReadSingleTag(tagID, index, count), null);
            }
        }
    }

    public getWriteSingleTagByNamePromise(value: string, deviceName: string, tagName: string, index: number,
        callback: GetPromiseCallback): void
    {
        if (this.tagMap) {
            this.getWriteSingleTagByNamePromiseImpl(value, deviceName, tagName, index, callback);
        }
        else {
            this.populateTagMap((error: any): void =>
            {
                if (error) {
                    callback(null, error);
                }
                else {
                    this.getWriteSingleTagByNamePromiseImpl(value, deviceName, tagName, index, callback);
                }
            });
        }
    }

    private getWriteSingleTagByNamePromiseImpl(value: string, deviceName: string, tagName: string, index: number,
        callback: GetPromiseCallback): void
    {
        if (!this.tagMap[deviceName]) {
            callback(null, 'unknown device name');
        }
        else if (!this.tagMap[deviceName][tagName]) {
            callback(null, 'unknown tag name');
        }
        else if (value === null) {
            callback(null, 'value is null');
        }
        else {
            var tagID = this.tagMap[deviceName][tagName];

            callback(super.dataStoreWriteSingleTag(tagID, value, index), null);
        }
    }

    /**  Write an array of tags and callback when done */
    public dataStoreWriteTags(tags: Array<WriteTagDef>,
        callback: (error: Error) => void)
    {
        if (tags.length == 0) {
            callback(null);
            return;
        }

        var tag: WriteTagDef = tags.shift();

        this.dataStoreWriteSingleTag(tag.id, tag.value, tag.index)
            .then(
                (fullfilledResponse: PromiseResponse) =>
                {
                    this.dataStoreWriteTags(tags, callback);
                },
                (error: any) =>
                {
                    callback(error);
                }
            );
    }
}

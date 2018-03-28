import * as fs from 'fs';
import * as Promise from 'bluebird';
import * as DatastoreApi from '../src/api';
import { DatastoreApiEx } from '../src/api-ex';

var TestSettings = require('./settings.json');

export function createClient()
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

    return {
        publicCertFile,
        caCertFile,
        sharedApiClient
    }
}
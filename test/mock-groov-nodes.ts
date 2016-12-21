import * as MockNode from 'opto22-node-red-common/lib/mocks/MockNode';
import * as ConfigHandler from "../src/config-handler";
import * as NodeHandlers from "../src/node-handlers";

export class MockGroovReadNode extends MockNode.MockNode
{
    constructor(onSend: (msg: any) => void, onError?: (errorText: any, nodeMessage: any) => void)
    {
        super(NodeHandlers.ReadNodeImpl.getNodeType(), onSend, onError);
    }
}

export class MockGroovWriteNode extends MockNode.MockNode
{
    constructor(onSend: (msg: any) => void, onError?: (errorText: any, nodeMessage: any) => void)
    {
        super(NodeHandlers.WriteNodeImpl.getNodeType(), onSend, onError);
    }
}

export class MockGroovDataStoreNode extends MockNode.MockNode implements ConfigHandler.DataStoreNode
{
    dsName: string;
    project: ConfigHandler.ProjectNode;

    constructor(id: string, dsName: string,
        project: ConfigHandler.ProjectNode) 
    {
        super(ConfigHandler.GroovDataStoreNodeType);
        this.id = id;
        this.dsName = dsName;
        this.project = project;
    }
}

export class MockGroovProjectNode extends MockNode.MockNode implements ConfigHandler.ProjectNode
{
    address: string;
    credentials: ConfigHandler.ProjectCredentials;

    constructor(id: string,
        address: string,
        credentials:
            {
                key: string,
                publicCertPath: string,
                caCertPath: string,
            }) 
    {
        super(ConfigHandler.GroovProjectNodeType);
        this.id = id;
        this.address = address;
        this.credentials = credentials;
    }
}

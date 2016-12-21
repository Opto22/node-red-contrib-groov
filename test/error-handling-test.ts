import * as NodeHandlers from "../src/node-handlers";
import { MockNode } from 'opto22-node-red-common/lib/mocks/MockNode';
import { StatusCodeMessages } from '../src/error-handling';
import { ResponseErrorMessages } from '../src/error-handling';
import { handleErrorResponse } from '../src/error-handling';
import * as should from 'should';
import * as assert from 'assert';


function createSystemError(code: string, errno: number, syscall: string)
{
    return {
        code: code,
        errno: errno,
        syscall: syscall
    };
}


describe('ResponseErrorMessages class', function()
{
    it('getErrorMsg() returns long and short messages for ETIMEDOUT', function()
    {
        var errorDetails = ResponseErrorMessages.getErrorMsg(
            createSystemError('ETIMEDOUT', 1, 'some system call'));

        should(errorDetails.nodeShortErrorMsg).be.exactly('Timeout');
        should(errorDetails.logLongErrorMsg).be.exactly('Timeout. Error code: ETIMEDOUT from system call "some system call"');
    });

    it('getErrorMsg() returns long and short messages for unknown error code', function()
    {
        var errorDetails = ResponseErrorMessages.getErrorMsg(
            createSystemError('THIS_IS_NOT_A_REAL_ERROR', 1, 'some fake system call'));

        should(errorDetails.nodeShortErrorMsg).be.exactly('THIS_IS_NOT_A_REAL_ERROR');
        should(errorDetails.logLongErrorMsg).be.exactly('Error code: THIS_IS_NOT_A_REAL_ERROR from system call "some fake system call"');
    });

});

describe('StatusCodeMessages class', function()
{
    it('getErrorMsg() returns long and short messages for HTTP 400', function()
    {
        var errorDetails = StatusCodeMessages.getErrorMsg('400');

        should(errorDetails.nodeShortErrorMsg).be.exactly('Bad request');
        should(errorDetails.logLongErrorMsg).be.exactly('Bad request. HTTP response error : 400');
    });


    it('getErrorMsg() returns long and short messages for HTTP unhandled', function()
    {
        var errorDetails = StatusCodeMessages.getErrorMsg('500');

        should(errorDetails.nodeShortErrorMsg).be.exactly('Status code 500');
        should(errorDetails.logLongErrorMsg).be.exactly('Status code 500. HTTP response error : 500');
    });
});

describe('handleErrorResponse()', function()
{
    it('getErrorMsg() with a basic string error', function(done)
    {
        var errorValue = 'this is a custom error message';

        var node = new MockNode(NodeHandlers.ReadNodeImpl.getNodeType(), null, (errorText: any, nodeMessage: any) => 
        {
            // Check everything in the response.
            should(errorText).be.exactly(errorValue);
            should(nodeMessage).match({ groovError: { message: errorValue } });
            done();
        });

        handleErrorResponse(errorValue, {}, node);
    });

    it('getErrorMsg() with a ETIMEDOUT error', function(done)
    {
        var node = new MockNode(NodeHandlers.ReadNodeImpl.getNodeType(), null, (errorText: any, nodeMessage: any) => 
        {
            // Check everything in the response.
            should(errorText).be.exactly('Timeout. Error code: ETIMEDOUT from system call "some system call"');
            should(nodeMessage).match({
                reqError: {
                    code: 'ETIMEDOUT',
                    errno: 1,
                    syscall: 'some system call'
                }
            });
            done();
        });

        handleErrorResponse(createSystemError('ETIMEDOUT', 1, 'some system call'),
            {}, node);
    });


    it('getErrorMsg() with an HTTP status error', function(done)
    {
        var node = new MockNode(NodeHandlers.ReadNodeImpl.getNodeType(), null, (errorText: any, nodeMessage: any) => 
        {
            // Check everything in the response.
            should(errorText).be.exactly('Bad request. HTTP response error : 400');
            should(nodeMessage).match({
                resError: {
                    statusCode: 400,
                    body: undefined
                }
            });
            done();
        });

        handleErrorResponse({
            response: {
                statusCode: 400
            }
        }, {}, node);
    });
});

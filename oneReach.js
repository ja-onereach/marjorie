/* eslint-disable no-case-declarations */
/* eslint-disable indent */
/* eslint-disable handle-callback-err */
const request = require('request-promise');
const uuid = require('uuid/v4');
const _ = require('lodash');

class OneReach {
    constructor(dialogState, callbackUrl) {
        this._state = dialogState;
        this._callbackUrl = callbackUrl;
        this._callbacks = dialogState.createProperty('OneReachCallbacks');
        this._adapterUrl = 'https://sdkapi.staging.api.onereach.ai/http/ae7f9e31-b377-4144-9fd5-98f7952db87d/in/msbot/event/0418f4d4-1a2f-4345-a251-bb8b2d44fece';
    }

    async pushCallback(id, ctx, nxt) {
        const calls = await this._callbacks.get() || [];
        calls.push({
            id,
            context: ctx,
            next: nxt
        });
    }

    async dispatch(payload, label) { // send any event to a webhook flow
        // console.log('or.dispatch called', {payload, label});
        return await request.post({
            uri: 'https://sdkapi.staging.api.onereach.ai/http/1e2818a3-e603-4cb7-b63f-af503bf53104/marjorie-notifications',
            body: { payload, label },
            json: true
        });
    }

    async bypass(context, next, type, tags, endYieldFunc) {
        console.log('or.bypass', { type, context });
        const req = (body) => {
            return request.post({
                uri: this._adapterUrl,
                body,
                headers: {
                    orteamsbypass: true,
                    authorization: process.env.onereachTeamsBypassKey
                },
                json: true
            })
                .then(async response => {
                    console.log('or.bypass response', response);
                    return response;
                })
                .catch(async err => {
                    console.error('or.bypass request error', err);
                    return false;
                });
        };
        const callbackId = uuid();
        switch (type) {
            case 'tryYield': // check OR bot to see if it wants to take over
                // associate existing context with a callback ID to allow OR bot to close the conversation later
                const yieldResp = await req({
                    type: 'yield',
                    activity: _.get(context, '_activity'),
                    bsCallback: { id: callbackId, url: this._serverUrl },
                    tags
                });
                if (yieldResp && yieldResp.doYield) { // OR bot is taking control
                    this.pushCallback(callbackId, context, next);
                    return this.yieldResponse(yieldResp);
                } else if (yieldResp && yieldResp.newActivities) {
                    // handle new bot message from OR bot
                    const lastActivity = yieldResp.newActivities.pop();
                    var sentMessageDetails;
                    _.forEach(yieldResp.newActivities, async activity => {
                        await context.sendActivity(activity);
                    });
                    sentMessageDetails = await context.sendActivity(lastActivity);
                    this.returnMessageDetails(sentMessageDetails, yieldResp.msgCallbackUrl);
                    if (yieldResp.resetConversation) {
                        console.log('directed to reset conversation');

                        // TODO: Figure out how to actually restart the conversation
                        return context.replaceDialog('mainWaterfallDialog', { restartMsg: 'Bot Service is back in control, and starting over. What can I do for you?' });
                    } else {
                        return endYieldFunc();
                    }
                }
                return endYieldFunc();
                // eslint-disable-next-line no-unreachable
                break;
            case 'requestMessage': // Request single bot message response
                //
                break;
            case 'requestData': // Request a JSON response
                //
                break;
            default:
                return endYieldFunc ? endYieldFunc() : next();
        }
    }

    async returnMessageDetails(sentMessage, responseUrl) {
        console.log('returnMessageDetails', sentMessage);
        return request.post({
            uri: responseUrl,
            body: sentMessage,
            json: true
        })
            .then(response => {
                console.log('message details returned');
            })
            .catch(async err => {
                console.error('error returning message details', err);
                return false;
            });
    }

    async yieldResponse(data) {
        console.log('OR bot took control with response data:', data);
        return true;
    }
};

module.exports = OneReach;

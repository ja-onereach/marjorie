/* eslint-disable no-case-declarations */
/* eslint-disable indent */
/* eslint-disable handle-callback-err */
const request = require('request-promise');
const uuid = require('uuid/v4');
const _ = require('lodash');

class OneReach {
    constructor(dialogState, callbackUrl, dialog) {
        this._dialog = dialog;
        this._dialog.or = this;
        this._state = dialogState;
        this._callbackUrl = callbackUrl;
        this._callbacks = dialogState.createProperty('OneReachCallbacks');
        this._adapterUrl = 'https://sdkapi.staging.api.onereach.ai/http/ae7f9e31-b377-4144-9fd5-98f7952db87d/in/msbot/event/0418f4d4-1a2f-4345-a251-bb8b2d44fece';
        this.nluFLowUrl = 'https://new-shared.sdkapi.staging.api.onereach.ai/http/ae7f9e31-b377-4144-9fd5-98f7952db87d/marjorie-nlu-failover'; 
    }

    async pushCallback(id, ctx, nxt) {
        let calls = await this._callbacks.get() || [];
        calls.push({
            id,
            context: ctx,
            next: nxt
        });
        this._callbacks.set(calls);
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
        // console.log('or.bypass', { type, context });
        const req = (body, uri) => {
            return request.post({
                uri: uri || this._adapterUrl,
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
                if (yieldResp && yieldResp.doYield) { // OR bot is taking control, oriented toward Request Input in conversation flows
                    this.pushCallback(callbackId, context, next);
                    return this.yieldResponse(yieldResp);
                } else if (yieldResp && yieldResp.newActivities) { // oriented to Send Message on its own
                    // handle new bot message(s) from OR bot
                    const lastActivity = yieldResp.newActivities.pop();
                    var sentMessageDetails;
                    _.forEach(yieldResp.newActivities, async activity => {
                        await context.sendActivity(activity);
                    });
                    sentMessageDetails = await context.sendActivity(lastActivity);
                    this.returnMessageDetails(sentMessageDetails, yieldResp.msgCallbackUrl);
                    if (yieldResp.resetConversation) {
                        const dialogState = this._state.createProperty('OneReachState2');
                        return await this._dialog.run(context, dialogState, type="reset");
                    } else {
                        return await next()
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
            case 'nlu-failover':
                try {
                    const nluResp = await req({
                        type,
                        activity: _.get(context, '_activity'),
                        bsCallback: { id: callbackId, url: this._serverUrl },
                        tags
                    }, this.nluFLowUrl);
                    if (nluResp && nluResp.newActivities) { // oriented to Send Message on its own
                        // handle new bot message(s) from OR bot
                        const lastActivity = nluResp.newActivities.pop();
                        var sentMessageDetails;
                        _.forEach(nluResp.newActivities, async activity => {
                            await context.sendActivity(activity);
                        });
                        sentMessageDetails = await context.sendActivity(lastActivity);
                        this.returnMessageDetails(sentMessageDetails, nluResp.msgCallbackUrl);
                        if (nluResp.resetConversation) {
                            const dialogState = this._state.createProperty('OneReachState');
                            return await this._dialog.run(context, dialogState, type="reset");
                        } else {
                            return await next()
                        }
                     } else {
                        return await endYieldFunc();
                     }

                } catch (e) {
                    console.log('Error when making NLU-failover request', e);
                    return await endYieldFunc();
                }
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

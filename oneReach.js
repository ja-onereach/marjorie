/* eslint-disable handle-callback-err */
const request = require('request-promise');

module.exports = {
    async dispatch(payload, label) { // send any event to a webhook flow
        // console.log('dispatch called', {payload, label});
        return await request.post({
            uri: 'https://sdkapi.staging.api.onereach.ai/http/1e2818a3-e603-4cb7-b63f-af503bf53104/marjorie-notifications',
            body: { payload, label },
            json: true
        });
    },
    async bypass(payload, type) { // send an event to OR for possible bypass, return true if handled, false if unhandled
        console.log('bypass request', { type, payload });
        return request.post({
            uri: 'https://sdkapi.staging.api.onereach.ai/http/ae7f9e31-b377-4144-9fd5-98f7952db87d/in/msbot/event/0418f4d4-1a2f-4345-a251-bb8b2d44fece',
            body: { payload, type },
            headers: {
                orteamsbypass: true,
                authorization: process.env.onereachTeamsBypassKey
            },
            json: true
        })
            .then(async response => {
                console.log('request response', response);
                return (response && response.bypass);
            })
            .catch(async err => {
                console.error('or.bypass request error', err);
                return false;
            });
    }
};

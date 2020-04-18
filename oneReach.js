const request = require('request');

module.exports = {
    dispatch(payload, label) { // send any event to a webhook flow
        // console.log('dispatch called', {payload, label});
        request({
            method: 'POST',
            uri: 'https://sdkapi.staging.api.onereach.ai/http/1e2818a3-e603-4cb7-b63f-af503bf53104/marjorie-notifications',
            body: { payload, label },
            json: true
        });
    },
    bypass(payload, type) { // send an event to OR for possible bypass, return true if handled, false if unhandled
        console.log('bypass request', { type, payload });
        return request({
            method: 'POST',
            uri: 'https://sdkapi.staging.api.onereach.ai/http/ae7f9e31-b377-4144-9fd5-98f7952db87d/in/msbot/event/0418f4d4-1a2f-4345-a251-bb8b2d44fece',
            body: { payload, type },
            headers: {
                orteamsbypass: true,
                authorization: process.env.onereachTeamsBypassKey
            },
            json: true
        }, function(error, response, body) {
            if (error) {
                console.error('or.bypass request error', error);
                return false;
            }
            console.log('request response', { status: response.statusCode, body });
        });
    }
};

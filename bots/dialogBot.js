// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler } = require('botbuilder');

class DialogBot extends ActivityHandler {
    /**
     *
     * @param {ConversationState} conversationState
     * @param {UserState} userState
     * @param {Dialog} dialog
     */
    constructor(conversationState, userState, dialog, or) {
        super();
        if (!conversationState) throw new Error('[DialogBot]: Missing parameter. conversationState is required');
        if (!userState) throw new Error('[DialogBot]: Missing parameter. userState is required');
        if (!dialog) throw new Error('[DialogBot]: Missing parameter. dialog is required');

        this.conversationState = conversationState;
        this.userState = userState;
        this.dialog = dialog;
        this.dialogState = conversationState.createProperty('OneReachState');
        this.or = or;

        this.onEvent(async (context, next) => {
            console.log('onEvent', context._activity);
            await next();
        });

        this.onMessage(async (context, next) => {
            await or.bypass(context, next, 'tryYield', ['dialogBot.onMessage'], async (type, payload) => {
                // Run the Dialog with the new message Activity.
                await this.dialog.run(context, this.dialogState, type, payload);

                // By calling next() you ensure that the next BotHandler is run.
                await next();
            });
        });

        this.onDialog(async (context, next) => {
            // Save any state changes. The load happened during the execution of the Dialog.
            // console.log('onDialog', context._activity);
            // or.dispatch(context._activity, 'onDialog');
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}

module.exports.DialogBot = DialogBot;

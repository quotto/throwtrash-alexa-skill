'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const trash_common_1 = require("trash-common");
const display_creator_1 = require("./common/display-creator");
// const Alexa = require('ask-sdk');
const ask_sdk_core_1 = require("ask-sdk-core");
const dynamodb_adapter_1 = require("./dynamodb-adapter");
const trash_common_2 = require("trash-common");
const { S3PersistenceAdapter } = require('ask-sdk-s3-persistence-adapter');
let textCreator, tsService, displayCreator;
const logger = trash_common_2.getLogger();
process.env.RUNLEVEL === "INFO" ? logger.setLevel_INFO : logger.setLevel_DEBUG;
const PointDayValue = [
    { value: 0 },
    { value: 1 },
    { value: 2 },
    { value: 3, weekday: 0 },
    { value: 4, weekday: 1 },
    { value: 5, weekday: 2 },
    { value: 6, weekday: 3 },
    { value: 7, weekday: 4 },
    { value: 8, weekday: 5 },
    { value: 9, weekday: 6 }
];
const persistenceAdapter = new S3PersistenceAdapter({ bucketName: `throwtrash-skill-preference-${process.env.APP_REGION}` });
const init = (handlerInput, option) => __awaiter(void 0, void 0, void 0, function* () {
    const { requestEnvelope, serviceClientFactory } = handlerInput;
    const locale = requestEnvelope.request.locale || "utc";
    textCreator = new trash_common_1.client.TextCreator(locale);
    if (option.display) {
        displayCreator = new display_creator_1.DisplayCreator(locale);
    }
    if (option.client) {
        const deviceId = requestEnvelope.context.System.device ? requestEnvelope.context.System.device.deviceId : "";
        let upsServiceClient = null;
        try {
            upsServiceClient = serviceClientFactory ? serviceClientFactory.getUpsServiceClient() : null;
        }
        catch (e) {
            logger.error(e);
        }
        // タイムゾーン取得後にclientインスタンスを生成
        return (deviceId && upsServiceClient ?
            upsServiceClient.getSystemTimeZone(deviceId) : new Promise(resolve => { resolve('Asia/Tokyo'); })).then((timezone) => {
            logger.debug('timezone:' + timezone);
            tsService = new trash_common_1.client.TrashScheduleService(timezone, textCreator, new dynamodb_adapter_1.DynamoDBAdapter());
        });
    }
});
const getEntitledProducts = (handlerInput) => __awaiter(void 0, void 0, void 0, function* () {
    const ms = handlerInput.serviceClientFactory ? handlerInput.serviceClientFactory.getMonetizationServiceClient() : undefined;
    const locale = handlerInput.requestEnvelope.request.locale;
    if (ms && locale) {
        const products = yield ms.getInSkillProducts(locale);
        return products.inSkillProducts.filter(record => record.entitled === 'ENTITLED');
    }
    return [];
});
const updateUserHistory = (handlerInput) => __awaiter(void 0, void 0, void 0, function* () {
    // 初回呼び出しおよびエラーが発生した場合には0除算を避けるため1を返す
    try {
        const attributes = yield handlerInput.attributesManager.getPersistentAttributes();
        attributes.get_schedule_count = attributes.get_schedule_count ? attributes.get_schedule_count + 1 : 1;
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        yield handlerInput.attributesManager.savePersistentAttributes();
        return attributes.get_schedule_count;
    }
    catch (err) {
        logger.error(err);
        return 1;
    }
});
const setUpSellMessage = (handlerInput, responseBuilder) => __awaiter(void 0, void 0, void 0, function* () {
    const user_count = yield updateUserHistory(handlerInput);
    logger.debug(`UserCount: ${user_count}`);
    if (handlerInput.requestEnvelope.request.locale === 'ja-JP' && user_count % 5 === 0) {
        try {
            const entitledProducts = yield getEntitledProducts(handlerInput);
            if (!entitledProducts || entitledProducts.length === 0) {
                logger.info("Upsell");
                responseBuilder.addDirective({
                    type: "Connections.SendRequest",
                    name: "Upsell",
                    payload: {
                        InSkillProduct: {
                            productId: process.env.REMINDER_PRODUCT_ID
                        },
                        upsellMessage: '<break stength="strong"/>' + textCreator.getMessage("PURCHASE_UPSELL")
                    },
                    token: "correlationToken",
                });
                return true;
            }
        }
        catch (err) {
            logger.error(err);
        }
    }
    return false;
});
let skill;
exports.handler = function (event, context) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!skill) {
            skill = ask_sdk_core_1.SkillBuilders.custom()
                .addRequestHandlers(LaunchRequestHandler, GetPointDayTrashesHandler, GetRegisteredContent, GetDayFromTrashTypeIntent, CheckReminderHandler, SetReminderHandler, PurchaseHandler, CancelPurchaseHandler, PurchaseResultHandler, HelpIntentHandler, CancelAndStopIntentHandler, SessionEndedRequestHandler, NextPreviousIntentHandler)
                .withSkillId(process.env.APP_ID || "")
                .withPersistenceAdapter(persistenceAdapter)
                .withApiClient(new ask_sdk_core_1.DefaultApiClient())
                .create();
        }
        return skill.invoke(event, context);
    });
};
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug(JSON.stringify(handlerInput));
            const { requestEnvelope, responseBuilder } = handlerInput;
            const init_ready = init(handlerInput, { client: true, display: true });
            const accessToken = requestEnvelope.session ? requestEnvelope.session.user.accessToken : undefined;
            if (!accessToken) {
                // トークン未定義の場合はユーザーに許可を促す
                return responseBuilder
                    .speak(textCreator.getMessage("HELP_ACCOUNT"))
                    .withLinkAccountCard()
                    .getResponse();
            }
            // const get_trash_ready = Client.getTrashData(accessToken);
            yield init_ready;
            const data = yield tsService.getTrashData(accessToken);
            if (data.status === 'error') {
                return responseBuilder
                    .speak(textCreator.getMessage(data.msgId))
                    .withShouldEndSession(true)
                    .getResponse();
            }
            const promise_list = [
                tsService.checkEnableTrashes(data === null || data === void 0 ? void 0 : data.response, 0),
                tsService.checkEnableTrashes(data === null || data === void 0 ? void 0 : data.response, 1),
                tsService.checkEnableTrashes(data === null || data === void 0 ? void 0 : data.response, 2)
            ];
            const all = yield Promise.all(promise_list);
            const first = all[0];
            const second = all[1];
            const third = all[2];
            if ((_a = requestEnvelope.context.System.device) === null || _a === void 0 ? void 0 : _a.supportedInterfaces.Display) {
                const schedule_directive = displayCreator.getThrowTrashesDirective(0, [
                    { data: first, date: tsService.calculateLocalTime(0) },
                    { data: second, date: tsService.calculateLocalTime(1) },
                    { data: third, date: tsService.calculateLocalTime(2) },
                ]);
                responseBuilder.addDirective(schedule_directive).withShouldEndSession(true);
            }
            responseBuilder.speak(textCreator.getLaunchResponse(first));
            const request = handlerInput.requestEnvelope.request;
            const metadata = request.metadata;
            if (metadata && metadata.referrer === 'amzn1.alexa-speechlet-client.SequencedSimpleIntentHandler') {
                logger.debug("From Regular Action");
                responseBuilder.withShouldEndSession(true);
            }
            else if (!(yield setUpSellMessage(handlerInput, responseBuilder))) {
                logger.debug("Reprompt");
                const reprompt_message = textCreator.getMessage("NOTICE_CONTINUE");
                // アップセルを行わなければrepromptする
                responseBuilder.speak(textCreator.getLaunchResponse(first) + reprompt_message).reprompt(reprompt_message);
            }
            return responseBuilder.getResponse();
        });
    }
};
const GetPointDayTrashesHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'GetPointDayTrashes';
    },
    handle(handlerInput) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const { responseBuilder, requestEnvelope } = handlerInput;
            const init_ready = init(handlerInput, { client: true, display: true });
            const accessToken = (_a = requestEnvelope.session) === null || _a === void 0 ? void 0 : _a.user.accessToken;
            if (accessToken == null) {
                // トークン未定義の場合はユーザーに許可を促す
                return responseBuilder
                    .speak(textCreator.getMessage("HELP_ACCOUNT"))
                    .withLinkAccountCard()
                    .getResponse();
            }
            const intentRequest = requestEnvelope.request;
            const resolutions = (_b = intentRequest.intent.slots) === null || _b === void 0 ? void 0 : _b.DaySlot.resolutions;
            if (resolutions && resolutions.resolutionsPerAuthority && resolutions.resolutionsPerAuthority[0].status.code === 'ER_SUCCESS_MATCH') {
                const slotValue = Number(resolutions.resolutionsPerAuthority[0].values[0].value.id);
                yield init_ready;
                const trash_result = yield tsService.getTrashData(accessToken);
                if (!trash_result || (trash_result === null || trash_result === void 0 ? void 0 : trash_result.status) === 'error') {
                    return responseBuilder
                        .speak(textCreator.getMessage(trash_result.msgId))
                        .withShouldEndSession(true)
                        .getResponse();
                }
                let target_day = 0;
                if (slotValue >= 0 && slotValue <= 2) {
                    target_day = PointDayValue[slotValue].value;
                }
                else {
                    target_day = tsService.getTargetDayByWeekday(PointDayValue[slotValue].weekday) || 0;
                }
                const promise_list = [
                    tsService.checkEnableTrashes(trash_result.response, target_day),
                    tsService.checkEnableTrashes(trash_result.response, target_day + 1),
                    tsService.checkEnableTrashes(trash_result.response, target_day + 2)
                ];
                const all = yield Promise.all(promise_list);
                const first = all[0];
                const second = all[1];
                const third = all[2];
                responseBuilder.speak(textCreator.getPointdayResponse(String(slotValue), first));
                if ((_c = requestEnvelope.context.System.device) === null || _c === void 0 ? void 0 : _c.supportedInterfaces.Display) {
                    const schedule_directive = displayCreator.getThrowTrashesDirective(target_day, [
                        { data: first, date: tsService.calculateLocalTime(target_day) },
                        { data: second, date: tsService.calculateLocalTime(target_day + 1) },
                        { data: third, date: tsService.calculateLocalTime(target_day + 2) },
                    ]);
                    responseBuilder.addDirective(schedule_directive).withShouldEndSession(true);
                }
                yield setUpSellMessage(handlerInput, responseBuilder);
                return responseBuilder.getResponse();
            }
            else {
                const speechOut = textCreator.getMessage("ASK_A_DAY");
                return responseBuilder
                    .speak(speechOut)
                    .reprompt(speechOut)
                    .getResponse();
            }
        });
    }
};
const GetRegisteredContent = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'GetRegisteredContent';
    },
    handle(handlerInput) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const { requestEnvelope, responseBuilder } = handlerInput;
            const init_ready = init(handlerInput, { client: true, display: true });
            const accessToken = (_a = requestEnvelope.session) === null || _a === void 0 ? void 0 : _a.user.accessToken;
            if (accessToken == null) {
                // トークン未定義の場合はユーザーに許可を促す
                return responseBuilder
                    .speak(textCreator.getMessage("HELP_ACCOUNT"))
                    .withLinkAccountCard()
                    .getResponse();
            }
            try {
                yield init_ready;
                const trash_result = yield tsService.getTrashData(accessToken);
                if (!trash_result || (trash_result === null || trash_result === void 0 ? void 0 : trash_result.status) === 'error') {
                    return responseBuilder
                        .speak(textCreator.getMessage(trash_result.msgId))
                        .withShouldEndSession(true)
                        .getResponse();
                }
                const schedule_data = textCreator.getAllSchedule(trash_result.response);
                if ((_b = requestEnvelope.context.System.device) === null || _b === void 0 ? void 0 : _b.supportedInterfaces.Display) {
                    responseBuilder.addDirective(displayCreator.getShowScheduleDirective(schedule_data)).withShouldEndSession(true);
                }
                const card_text = textCreator.getRegisterdContentForCard(schedule_data);
                return responseBuilder.speak(textCreator.getMessage("NOTICE_SEND_SCHEDULE")).withSimpleCard(textCreator.registerd_card_title, card_text).getResponse();
            }
            catch (err) {
                logger.error(err);
                return responseBuilder.speak(textCreator.getMessage("ERROR_GENERAL")).withShouldEndSession(true).getResponse();
            }
        });
    }
};
const GetDayFromTrashTypeIntent = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'GetDayFromTrashType';
    },
    handle(handlerInput) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            const { requestEnvelope, responseBuilder } = handlerInput;
            const init_ready = init(handlerInput, { client: true, display: false });
            const accessToken = (_a = requestEnvelope.session) === null || _a === void 0 ? void 0 : _a.user.accessToken;
            if (accessToken == null) {
                // トークン未定義の場合はユーザーに許可を促す
                return responseBuilder
                    .speak(textCreator.getMessage("HELP_ACCOUNT"))
                    .withLinkAccountCard()
                    .getResponse();
            }
            const resolutions = (_b = requestEnvelope.request.intent.slots) === null || _b === void 0 ? void 0 : _b.TrashTypeSlot.resolutions;
            yield init_ready;
            const trash_result = yield tsService.getTrashData(accessToken);
            if (!trash_result || (trash_result === null || trash_result === void 0 ? void 0 : trash_result.status) === 'error') {
                return responseBuilder
                    .speak(textCreator.getMessage(trash_result.msgId))
                    .withShouldEndSession(true)
                    .getResponse();
            }
            if (resolutions && resolutions.resolutionsPerAuthority[0].status.code === 'ER_SUCCESS_MATCH') {
                const slotValue = resolutions.resolutionsPerAuthority[0].values[0].value;
                const trash_data = tsService.getDayByTrashType(trash_result.response, slotValue.id);
                if (trash_data && trash_data.length > 0) {
                    logger.debug('Find Match Trash:' + JSON.stringify(trash_data));
                    responseBuilder
                        .speak(textCreator.getDayByTrashTypeMessage({ type: slotValue.id, name: slotValue.name }, trash_data));
                    yield setUpSellMessage(handlerInput, responseBuilder);
                    return responseBuilder.getResponse();
                }
            }
            // ユーザーの発話がスロット以外 または 合致するデータが登録情報に無かった場合はAPIでのテキスト比較を実施する
            logger.debug('Not match resolutions:' + JSON.stringify(requestEnvelope));
            // ユーザーが発話したゴミ
            const speeched_trash = (_c = requestEnvelope.request.intent.slots) === null || _c === void 0 ? void 0 : _c.TrashTypeSlot.value;
            logger.debug('check freetext trash:' + speeched_trash);
            // 登録タイプotherのみを比較対象とする
            const other_trashes = (_d = trash_result.response) === null || _d === void 0 ? void 0 : _d.filter((value) => {
                return value.type === 'other';
            });
            let trash_data = [];
            // otherタイプの登録があれば比較する
            let speech_prefix = "";
            if (other_trashes && other_trashes.length > 0) {
                const compare_list = [];
                other_trashes.forEach((trash) => {
                    compare_list.push(tsService.compareTwoText(speeched_trash, trash.trash_val));
                });
                try {
                    const compare_result = yield Promise.all(compare_list);
                    logger.info('compare result:' + JSON.stringify(compare_result));
                    const max_score = Math.max(...compare_result);
                    if (max_score >= 0.7) {
                        const index = compare_result.indexOf(max_score);
                        trash_data = tsService.getDayByTrashType([other_trashes[index]], 'other');
                    }
                }
                catch (error) {
                    logger.error(error);
                    return responseBuilder.speak(textCreator.getMessage("ERROR_UNKNOWN")).withShouldEndSession(true).getResponse();
                }
            }
            responseBuilder.speak(speech_prefix + textCreator.getDayByTrashTypeMessage({ type: 'other', name: speeched_trash }, trash_data));
            yield setUpSellMessage(handlerInput, responseBuilder);
            return responseBuilder.getResponse();
        });
    }
};
const CheckReminderHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'SetReminder'
            && (!handlerInput.requestEnvelope.request.intent.confirmationStatus
                || handlerInput.requestEnvelope.request.intent.confirmationStatus === 'NONE');
    },
    handle(handlerInput) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug(`CheckReminderHandler -> ${JSON.stringify(handlerInput, null, 2)}`);
            const { responseBuilder, requestEnvelope } = handlerInput;
            const consentToken = requestEnvelope.context.System.user.permissions
                && requestEnvelope.context.System.user.permissions.consentToken;
            if (!consentToken) {
                // リマインダーのパーミッションが許可されていない場合は許可を促す
                return responseBuilder
                    .speak(textCreator.getMessage("REMINDER_PERMISSION"))
                    .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                    .getResponse();
            }
            const accessToken = (_a = requestEnvelope.session) === null || _a === void 0 ? void 0 : _a.user.accessToken;
            if (!accessToken) {
                // トークン未定義の場合はユーザーにアカウントリンクを促す
                return responseBuilder
                    .speak(textCreator.getMessage("HELP_ACCOUNT"))
                    .withLinkAccountCard()
                    .getResponse();
            }
            init(handlerInput, { client: false, display: false });
            return getEntitledProducts(handlerInput).then((entitledProducts) => {
                var _a, _b;
                if (entitledProducts && entitledProducts.length > 0) {
                    const weekTypeSlot = (_a = requestEnvelope.request.intent.slots) === null || _a === void 0 ? void 0 : _a.WeekTypeSlot.resolutions;
                    if (weekTypeSlot && weekTypeSlot.resolutionsPerAuthority && weekTypeSlot.resolutionsPerAuthority[0].status.code === "ER_SUCCESS_NO_MATCH") {
                        logger.debug("WeekTypeSlot is not match");
                        return responseBuilder
                            .addElicitSlotDirective("WeekTypeSlot")
                            .speak(textCreator.getMessage("REMINDER_WEEK"))
                            .reprompt(textCreator.getMessage("REMINDER_WEEK"))
                            .getResponse();
                    }
                    const timerSlot = (_b = requestEnvelope.request.intent.slots) === null || _b === void 0 ? void 0 : _b.TimerSlot;
                    const dialogState = requestEnvelope.request.dialogState;
                    if (dialogState != 'COMPLETED') {
                        return responseBuilder
                            .addDelegateDirective()
                            .getResponse();
                    }
                    else {
                        return responseBuilder
                            .speak(textCreator.getReminderConfirm(weekTypeSlot.resolutionsPerAuthority[0].values[0].value.name, timerSlot.value))
                            .addConfirmIntentDirective()
                            .getResponse();
                    }
                }
                else {
                    // オプションが購入されていない場合は購入フローへ移る
                    return responseBuilder.addDirective({
                        type: "Connections.SendRequest",
                        name: "Buy",
                        payload: {
                            InSkillProduct: {
                                productId: process.env.REMINDER_PRODUCT_ID
                            }
                        },
                        token: "correlationToken"
                    }).getResponse();
                }
            });
        });
    }
};
const SetReminderHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'SetReminder'
            && handlerInput.requestEnvelope.request.intent.confirmationStatus
            && handlerInput.requestEnvelope.request.intent.confirmationStatus != 'NONE';
    },
    handle(handlerInput) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const { responseBuilder, requestEnvelope, serviceClientFactory } = handlerInput;
            const init_ready = init(handlerInput, { client: true });
            const accessToken = (_a = requestEnvelope.session) === null || _a === void 0 ? void 0 : _a.user.accessToken;
            if (!accessToken) {
                // トークン未定義の場合はユーザーにアカウントリンクを促す
                return responseBuilder
                    .speak(textCreator.getMessage("HELP_ACCOUNT"))
                    .withLinkAccountCard()
                    .getResponse();
            }
            const intent_request = requestEnvelope.request;
            if (intent_request.intent.confirmationStatus === 'CONFIRMED') {
                yield init_ready;
                const trash_data_result = yield tsService.getTrashData(accessToken);
                if (trash_data_result && trash_data_result.status === 'error') {
                    return responseBuilder
                        .speak(textCreator.getMessage(trash_data_result.msgId))
                        .withShouldEndSession(true)
                        .getResponse();
                }
                const weekTypeSlot = intent_request.intent.slots.WeekTypeSlot.resolutions.resolutionsPerAuthority[0].values[0].value;
                const time = (_b = intent_request.intent.slots) === null || _b === void 0 ? void 0 : _b.TimerSlot.value;
                const remind_data = yield tsService.getRemindBody(Number(weekTypeSlot.id), trash_data_result.response || []);
                const locale = requestEnvelope.request.locale || "utc";
                const remind_requests = createRemindRequest(remind_data, time, locale);
                const ReminderManagementServiceClient = serviceClientFactory === null || serviceClientFactory === void 0 ? void 0 : serviceClientFactory.getReminderManagementServiceClient();
                const remind_list = [];
                remind_requests.forEach((request_body) => {
                    remind_list.push(ReminderManagementServiceClient === null || ReminderManagementServiceClient === void 0 ? void 0 : ReminderManagementServiceClient.createReminder(request_body));
                });
                return Promise.all(remind_list).then(() => {
                    return responseBuilder
                        .speak(textCreator.getReminderComplete(weekTypeSlot.name, time))
                        .withShouldEndSession(true)
                        .getResponse();
                }).catch((err) => {
                    logger.error(err);
                    // ReminderManagementServiceClientでは権限が許可されていない場合401エラーが返る
                    if (err.statusCode === 401 || err.statuScode === 403) {
                        return responseBuilder
                            .speak(textCreator.getMessage("REMINDER_PERMISSION"))
                            .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                            .getResponse();
                    }
                    return responseBuilder
                        .speak(textCreator.getMessage("ERROR_UNKNOWN"))
                        .withShouldEndSession(true)
                        .getResponse();
                });
            }
            else if (intent_request.intent.confirmationStatus === 'DENIED') {
                return responseBuilder
                    .speak(textCreator.getMessage("REMINDER_CANCEL"))
                    .withShouldEndSession(true)
                    .getResponse();
            }
            return responseBuilder.speak(textCreator.getMessage("ERROR_GENERAL")).withShouldEndSession(true).getResponse();
        });
    }
};
const PurchaseHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'Purchase';
    },
    handle(handlerInput) {
        return __awaiter(this, void 0, void 0, function* () {
            const { responseBuilder, requestEnvelope, serviceClientFactory } = handlerInput;
            const ms = serviceClientFactory === null || serviceClientFactory === void 0 ? void 0 : serviceClientFactory.getMonetizationServiceClient();
            init(handlerInput, {});
            const locale = requestEnvelope.request.locale || "ja";
            const inSkillProductResponse = yield (ms === null || ms === void 0 ? void 0 : ms.getInSkillProducts(locale));
            try {
                const entitledProducts = inSkillProductResponse === null || inSkillProductResponse === void 0 ? void 0 : inSkillProductResponse.inSkillProducts.filter(record => record.entitled === 'ENTITLED');
                if (entitledProducts && entitledProducts.length > 0) {
                    return responseBuilder.speak(textCreator.getMessage("PURCHASE_ALREADY_PURCHASED")).reprompt(textCreator.getMessage("NOTICE_CONTINUE")).getResponse();
                }
                else {
                    // オプションが購入されていない場合は購入フローへ移る
                    return responseBuilder.addDirective({
                        type: "Connections.SendRequest",
                        name: "Buy",
                        payload: {
                            InSkillProduct: {
                                productId: process.env.REMINDER_PRODUCT_ID
                            }
                        },
                        token: "correlationToken"
                    }).getResponse();
                }
            }
            catch (err) {
                logger.error(err);
                return responseBuilder.speak(textCreator.getMessage("ERROR_GENERAL")).withShouldEndSession(true).getResponse();
            }
        });
    }
};
const CancelPurchaseHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'CancelPurchase';
    },
    handle(handlerInput) {
        init(handlerInput, {});
        return handlerInput.responseBuilder
            .addDirective({
            type: 'Connections.SendRequest',
            name: 'Cancel',
            payload: {
                InSkillProduct: {
                    productId: process.env.REMINDER_PRODUCT_ID
                }
            },
            token: "correlationToken"
        })
            .getResponse();
    }
};
const PurchaseResultHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'Connections.Response';
    },
    handle(handlerInput) {
        init(handlerInput, {});
        const { requestEnvelope, responseBuilder } = handlerInput;
        const purchaseRequest = requestEnvelope.request;
        const purchasePayload = purchaseRequest.payload;
        logger.debug("PurchaseResult:" + JSON.stringify(purchasePayload));
        if ((purchasePayload === null || purchasePayload === void 0 ? void 0 : purchasePayload.purchaseResult) === 'ACCEPTED') {
            if (purchaseRequest.name === 'Buy' || purchaseRequest.name === 'Upsell') {
                return responseBuilder
                    .speak(textCreator.getMessage("PURCHASE_THANKS"))
                    .reprompt(textCreator.getMessage("NOTICE_CONTINUE"))
                    .getResponse();
            }
            else {
                return responseBuilder
                    .speak(textCreator.getMessage("PURCHASE_CANCEL"))
                    .withShouldEndSession(true)
                    .getResponse();
            }
        }
        else if ((purchasePayload === null || purchasePayload === void 0 ? void 0 : purchasePayload.purchaseResult) === 'DECLINED') {
            return responseBuilder
                .speak(textCreator.getMessage("PURCHASE_CANCEL"))
                .withShouldEndSession(true)
                .getResponse();
        }
        else if ((purchasePayload === null || purchasePayload === void 0 ? void 0 : purchasePayload.purchaseResult) === 'ERROR') {
            return responseBuilder
                .speak(textCreator.getMessage("PURCHASE_CANCEL"))
                .withShouldEndSession(true)
                .getResponse();
        }
        else if ((purchasePayload === null || purchasePayload === void 0 ? void 0 : purchasePayload.purchasePayload) === 'ALREADY_PURCHASED') {
            return responseBuilder
                .speak(textCreator.getMessage("PURCHASE_ALREADY_PURCHASED"))
                .reprompt(textCreator.getMessage("NOTICE_CONTINUE"))
                .getResponse();
        }
        return responseBuilder.speak(textCreator.getMessage("ERROR_GENERAL")).getResponse();
    }
};
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        return __awaiter(this, void 0, void 0, function* () {
            init(handlerInput, {});
            const speechOutput = textCreator.getMessage("HELP_DESCRIBE");
            return handlerInput.responseBuilder
                .speak(speechOutput)
                .reprompt(speechOutput)
                .getResponse();
        });
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        return __awaiter(this, void 0, void 0, function* () {
            init(handlerInput, {});
            const speechOutput = textCreator.getMessage("HELP_BYE");
            return handlerInput.responseBuilder.speak(speechOutput).withShouldEndSession(true).getResponse();
        });
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        return __awaiter(this, void 0, void 0, function* () {
            return handlerInput.responseBuilder
                .withShouldEndSession(true)
                .getResponse();
        });
    }
};
const NextPreviousIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PreviousIntent');
    },
    handle(handlerInput) {
        return __awaiter(this, void 0, void 0, function* () {
            init(handlerInput, {});
            const speechOut = textCreator.getMessage("HELP_NEXT_PREVIOUS");
            return handlerInput.responseBuilder
                .speak(speechOut)
                .reprompt(speechOut)
                .getResponse();
        });
    }
};
const createRemindRequest = (remind_body, timer, locale) => {
    const remind_requests = [];
    remind_body.forEach((body) => {
        const message = textCreator.getLaunchResponse(body.body);
        const scheduled_time = tsService.calculateLocalTime(body.target_day);
        const month = scheduled_time.getMonth() + 1 < 9 ? `0${scheduled_time.getMonth() + 1}` : scheduled_time.getMonth() + 1;
        const date = scheduled_time.getDate() < 10 ? `0${scheduled_time.getDate()}` : scheduled_time.getDate();
        remind_requests.push({
            "requestTime": new Date().toISOString(),
            "trigger": {
                "type": "SCHEDULED_ABSOLUTE",
                "scheduledTime": `${scheduled_time.getFullYear()}-${month}-${date}T${timer}:00.000`,
            },
            "alertInfo": {
                "spokenInfo": {
                    "content": [{
                            "locale": locale,
                            "text": message
                        }]
                }
            },
            "pushNotification": {
                "status": "ENABLED"
            }
        });
    });
    return remind_requests;
};

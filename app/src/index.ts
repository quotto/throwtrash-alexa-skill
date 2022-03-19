import {client, TrashData} from "trash-common"
import {DisplayCreator} from "./display-creator"

import  { Skill, SkillBuilders, DefaultApiClient, HandlerInput, ResponseBuilder  } from 'ask-sdk-core'
import {services,RequestEnvelope,IntentRequest, interfaces} from 'ask-sdk-model'
import { DynamoDBAdapter } from "./dynamodb-adapter";
import { GetTrashDataResult, TrashScheduleService, RecentTrashDate, CompareResult } from "trash-common/dist/client";
import { getLogger } from "trash-common"
const {S3PersistenceAdapter} = require('ask-sdk-s3-persistence-adapter');
let textCreator: client.TextCreator,tsService: TrashScheduleService, displayCreator: DisplayCreator
const logger = getLogger();
process.env.RUNLEVEL === "INFO" ? logger.setLevel_INFO() :  logger.setLevel_DEBUG()

const PointDayValue = [
    {value:0},
    {value:1},
    {value:2},
    {value:3,weekday:0},
    {value:4,weekday:1},
    {value:5,weekday:2},
    {value:6,weekday:3},
    {value:7,weekday:4},
    {value:8,weekday:5},
    {value:9,weekday:6}
];

const persistenceAdapter = new S3PersistenceAdapter({bucketName: `throwtrash-skill-preference-${process.env.APP_REGION}`});

interface ClientInfo {
    locale: string,
    timezone: string
}
const CINFO: ClientInfo = {locale: '', timezone: ''};

const init = async (handlerInput: HandlerInput,option: any)=>{
    const { requestEnvelope, serviceClientFactory } = handlerInput;
    const locale: string = requestEnvelope.request.locale || "utc";
    CINFO.locale = locale;
    textCreator = new client.TextCreator(locale);
    if(option.display) {
        displayCreator = new DisplayCreator(locale);
    }
    if(option.client) {
        const deviceId: string = requestEnvelope.context.System.device ? requestEnvelope.context.System.device.deviceId : "";
            let upsServiceClient: services.ups.UpsServiceClient|null = null;
        try {
            upsServiceClient = serviceClientFactory ? serviceClientFactory.getUpsServiceClient() : null;
        } catch(err: any) {
            logger.error(err)
        }
        // タイムゾーン取得後にclientインスタンスを生成
        return (deviceId && upsServiceClient ?
            upsServiceClient.getSystemTimeZone(deviceId) : new Promise(resolve => { resolve('Asia/Tokyo') })
        ).then((timezone: any)=>{
            CINFO.timezone = timezone;
            logger.debug('timezone:'+timezone);
            tsService =  new client.TrashScheduleService(timezone, textCreator, new DynamoDBAdapter());
        });
    }
};

const getEntitledProducts = async(handlerInput: HandlerInput):Promise<services.monetization.InSkillProduct[]>=>{
        const ms: services.monetization.MonetizationServiceClient|undefined = handlerInput.serviceClientFactory ? handlerInput.serviceClientFactory.getMonetizationServiceClient() : undefined;
        const locale: string|undefined = handlerInput.requestEnvelope.request.locale;
        if(ms && locale) {
            const products =  await ms.getInSkillProducts(locale);
            return products.inSkillProducts.filter(record=> record.entitled === 'ENTITLED');
        }
        return []
};

const updateUserHistory = async(handlerInput: HandlerInput): Promise<number>=> {
    // 初回呼び出しおよびエラーが発生した場合には0除算を避けるため1を返す
    try {
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        attributes.get_schedule_count = attributes.get_schedule_count ? attributes.get_schedule_count + 1 : 1;
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        return attributes.get_schedule_count;
    }catch(err: any){
        logger.error(err);
        return 1;
    }
};

const setUpSellMessage = async(handlerInput: HandlerInput, responseBuilder: ResponseBuilder): Promise<boolean> => {
    const user_count = await updateUserHistory(handlerInput);
    logger.debug(`UserCount: ${user_count}`);
    if (handlerInput.requestEnvelope.request.locale === 'ja-JP' && user_count % 5 === 0) {
        try {
            const entitledProducts = await getEntitledProducts(handlerInput);
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
        } catch(err: any) {
            logger.error(err);
        }
    }
    return false;
}

/**
 *
 * RequestEnvelopeからディスプレイを持つデバイスであるかどうかを判定する
 *
 * @param requestEnvelope Alexaデバイスから受け取ったRequestEnvelope
 * @returns ディスプレイを持つデバイスの場合:true, それ以外:false
 */
const isSupportedAPL = function(requestEnvelope: RequestEnvelope): Boolean {
    const device = requestEnvelope.context.System.device;
    return device != undefined && device.supportedInterfaces != undefined &&
            device.supportedInterfaces!["Alexa.Presentation.APL"] != undefined;
}

let skill: Skill;
export const handler  = async function(event:RequestEnvelope ,context: any) {
    if(!skill) {
        skill = SkillBuilders.custom()
            .addRequestHandlers(
                LaunchRequestHandler,
                GetPointDayTrashesHandler,
                GetRegisteredContent,
                GetDayFromTrashTypeIntent,
                CheckReminderHandler,
                SetReminderHandler,
                PurchaseHandler,
                CancelPurchaseHandler,
                PurchaseResultHandler,
                HelpIntentHandler,
                CancelAndStopIntentHandler,
                SessionEndedRequestHandler,
                NextPreviousIntentHandler
            )
            .withSkillId(process.env.APP_ID || "")
            .withPersistenceAdapter(persistenceAdapter)
            .withApiClient(new DefaultApiClient())
            .create();
    }
    return skill.invoke(event,context);
};

const LaunchRequestHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    async handle(handlerInput: HandlerInput){
        logger.debug(JSON.stringify(handlerInput));
        const {requestEnvelope, responseBuilder} = handlerInput;
        const init_ready = init(handlerInput, {client: true, display: true});
        const accessToken: string|undefined = requestEnvelope.session ? requestEnvelope.session.user.accessToken : undefined;
        if(!accessToken) {
            // トークン未定義の場合はユーザーに許可を促す
            return responseBuilder
                .speak(textCreator.getMessage("HELP_ACCOUNT"))
                .withLinkAccountCard()
                .getResponse();
        }
        await init_ready
        const data: GetTrashDataResult | undefined = await tsService.getTrashData(accessToken)
        if (data.status === 'error') {
            return responseBuilder
                .speak(textCreator.getMessage(data.msgId!))
                .withShouldEndSession(true)
                .getResponse();
        }

        const promise_list = [
            tsService.checkEnableTrashes(data?.response!, 0),
            tsService.checkEnableTrashes(data?.response!, 1),
            tsService.checkEnableTrashes(data?.response!, 2)
        ];
        const threedaysTrashSchedule = await Promise.all(promise_list);
        const first = threedaysTrashSchedule[0];
        const second = threedaysTrashSchedule[1];
        const third = threedaysTrashSchedule[2];

        if (isSupportedAPL(requestEnvelope)) {
            const schedule_directive = displayCreator.getThrowTrashesDirective(0, [
                { data: first, date: tsService.calculateLocalTime(0) },
                { data: second, date: tsService.calculateLocalTime(1) },
                { data: third, date: tsService.calculateLocalTime(2) },
            ])
            responseBuilder.addDirective(schedule_directive).withShouldEndSession(true);
        }


        const request: any = handlerInput.requestEnvelope.request
        const metadata: any = request.metadata;

        // 午後であれば明日のゴミ出し予定を答える
        const offset = data.checkedNextday && tsService.calculateLocalTime(0).getHours() >= 12 ? 1 : 0;
        const base_message: string = textCreator.getPointdayResponse(String(offset), threedaysTrashSchedule[offset]);

        logger.debug("From Regular Action");
        responseBuilder.speak(base_message);
        responseBuilder.withShouldEndSession(true);
        return responseBuilder.getResponse();
    }
};

const GetPointDayTrashesHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
                handlerInput.requestEnvelope.request.intent.name === 'GetPointDayTrashes';
    },
    async handle(handlerInput: HandlerInput){
        const {responseBuilder, requestEnvelope} = handlerInput;
        const init_ready = init(handlerInput, { client: true, display: true });
        const accessToken = requestEnvelope.session?.user.accessToken;
        if(accessToken == null) {
            // トークン未定義の場合はユーザーに許可を促す
            return responseBuilder
                .speak(textCreator.getMessage("HELP_ACCOUNT"))
                .withLinkAccountCard()
                .getResponse();
        }
        const intentRequest: IntentRequest = requestEnvelope.request as IntentRequest
        const resolutions = intentRequest.intent.slots?.DaySlot.resolutions;
        if(resolutions && resolutions.resolutionsPerAuthority && resolutions.resolutionsPerAuthority[0].status.code === 'ER_SUCCESS_MATCH') {
            let slotValue = Number(resolutions.resolutionsPerAuthority![0].values[0].value.id);

            await init_ready
            const trash_result = await tsService.getTrashData(accessToken)
            if (!trash_result || trash_result?.status === 'error') {
                return responseBuilder
                    .speak(textCreator.getMessage(trash_result.msgId!))
                    .withShouldEndSession(true)
                    .getResponse();
            }

            let target_day = 0;
            if (slotValue >= 0 && slotValue <= 2) {
                target_day = PointDayValue[slotValue].value;
            } else {
                target_day = tsService.getTargetDayByWeekday(PointDayValue[slotValue].weekday!) || 0;
            }

            const promise_list = [
                tsService.checkEnableTrashes(trash_result.response!, target_day),
                tsService.checkEnableTrashes(trash_result.response!, target_day + 1),
                tsService.checkEnableTrashes(trash_result.response!, target_day + 2)
            ];
            const all = await Promise.all(promise_list);
            const first = all[0];
            const second = all[1];
            const third = all[2];
            responseBuilder.speak(textCreator.getPointdayResponse(String(slotValue), first!));
            if (isSupportedAPL(requestEnvelope)) {
                const schedule_directive = displayCreator.getThrowTrashesDirective(target_day, [
                    { data: first, date: tsService.calculateLocalTime(target_day) },
                    { data: second, date: tsService.calculateLocalTime(target_day + 1) },
                    { data: third, date: tsService.calculateLocalTime(target_day + 2) },
                ]);
                responseBuilder.addDirective(schedule_directive).withShouldEndSession(true);
            }

            await setUpSellMessage(handlerInput, responseBuilder);
            return responseBuilder.getResponse();
        } else {
            const speechOut = textCreator.getMessage("ASK_A_DAY");
            return responseBuilder
                .speak(speechOut)
                .reprompt(speechOut)
                .getResponse();
        }
    }
};

const GetRegisteredContent = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
                handlerInput.requestEnvelope.request.intent.name === 'GetRegisteredContent';
    },
    async handle(handlerInput: HandlerInput) {
        const {requestEnvelope, responseBuilder} = handlerInput;
        const init_ready = init(handlerInput, {client: true, display: true});
        const accessToken = requestEnvelope.session?.user.accessToken;
        if(accessToken == null) {
            // トークン未定義の場合はユーザーに許可を促す
            return responseBuilder
                .speak(textCreator.getMessage("HELP_ACCOUNT"))
                .withLinkAccountCard()
                .getResponse();
        }

        try {
            await init_ready
            const trash_result = await tsService.getTrashData(accessToken)
            if (!trash_result || trash_result?.status === 'error') {
                return responseBuilder
                    .speak(textCreator.getMessage(trash_result.msgId!))
                    .withShouldEndSession(true)
                    .getResponse();
            }
            const schedule_data = textCreator.getAllSchedule(trash_result.response!);
            if (isSupportedAPL(requestEnvelope)) {
                responseBuilder.addDirective(
                    displayCreator.getShowScheduleDirective(schedule_data)
                ).withShouldEndSession(true);
            }
            const card_text = textCreator.getRegisterdContentForCard(schedule_data);

            return responseBuilder.speak(textCreator.getMessage("NOTICE_SEND_SCHEDULE")).withSimpleCard(textCreator.registerd_card_title, card_text).getResponse();
        }catch(err: any){
            logger.error(err)
            return responseBuilder.speak(textCreator.getMessage("ERROR_GENERAL")).withShouldEndSession(true).getResponse();
        }
    }
};
const GetDayFromTrashTypeIntent = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
                handlerInput.requestEnvelope.request.intent.name === 'GetDayFromTrashType';
    },
    async handle(handlerInput: HandlerInput) {
        const {requestEnvelope, responseBuilder} = handlerInput;
        const init_ready = init(handlerInput, { client: true, display: false });
        const accessToken = requestEnvelope.session?.user.accessToken;
        if(accessToken == null) {
            // トークン未定義の場合はユーザーに許可を促す
            return responseBuilder
                .speak(textCreator.getMessage("HELP_ACCOUNT"))
                .withLinkAccountCard()
                .getResponse();
        }
        const resolutions = (requestEnvelope.request as IntentRequest).intent.slots?.TrashTypeSlot.resolutions;
        await  init_ready;
        const trash_result = await tsService.getTrashData(accessToken);
        if (!trash_result || trash_result?.status === 'error') {
            return responseBuilder
                .speak(textCreator.getMessage(trash_result.msgId!))
                .withShouldEndSession(true)
                .getResponse();
        }
        if(resolutions && resolutions.resolutionsPerAuthority![0].status.code === 'ER_SUCCESS_MATCH') {
            const slotValue = resolutions.resolutionsPerAuthority![0].values[0].value;
            const trash_data = tsService.getDayByTrashType(trash_result.response!, slotValue.id);
            if(trash_data && trash_data.length > 0) {
                logger.debug('Find Match Trash:'+JSON.stringify(trash_data));
                responseBuilder
                    .speak(textCreator.getDayByTrashTypeMessage({type: slotValue.id,name: slotValue.name}, trash_data))
                await setUpSellMessage(handlerInput, responseBuilder);
                return responseBuilder.getResponse();
            }
        }
        // ユーザーの発話がスロット以外 または 合致するデータが登録情報に無かった場合はAPIでのテキスト比較を実施する
        logger.debug('Not match resolutions:'+JSON.stringify(requestEnvelope));

        // ユーザーが発話したゴミ
        const speeched_trash: string = (requestEnvelope.request as IntentRequest).intent .slots?.TrashTypeSlot.value as string;
        logger.debug('check freetext trash:' + speeched_trash);
        // 登録タイプotherのみを比較対象とする
        const other_trashes = trash_result.response?.filter((value)=>{
            return value.type === 'other'
        });

        let trash_data: RecentTrashDate[] = [];

        // otherタイプの登録があれば比較する
        let speech_prefix = "";
        if(other_trashes && other_trashes.length > 0) {
            const compare_list: Array<Promise<CompareResult>> = []
            other_trashes.forEach((trash: TrashData)=>{
                compare_list.push(
                    tsService.compareTwoText(speeched_trash,trash.trash_val!)
                );
            });

            try {
                const compare_result: Array<CompareResult> = await Promise.all(compare_list);
                logger.info('compare result:'+JSON.stringify(compare_result));
                const max_data = {trash: "",score: 0, index: 0};
                compare_result.forEach((result,index)=>{
                    if(result.score >= max_data.score) {
                        max_data.trash = result.match
                        max_data.score = result.score
                        max_data.index = index
                    }
                });
                if(max_data.score >= 0.5) {
                    if(max_data.score < 0.7 && max_data.score >= 0.5) {
                        speech_prefix = `${max_data.trash} ですか？`;
                    }
                    trash_data = tsService.getDayByTrashType([other_trashes[max_data.index]],'other');
                }
            } catch(error: any) {
                logger.error(error);
                return responseBuilder.speak(textCreator.getMessage("ERROR_UNKNOWN")).withShouldEndSession(true).getResponse();
            }
        }
        responseBuilder.speak(speech_prefix + textCreator.getDayByTrashTypeMessage({type: 'other', name: speeched_trash}, trash_data));

        await setUpSellMessage(handlerInput, responseBuilder);
        return responseBuilder.getResponse();
    }
};

const CheckReminderHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'SetReminder'
            && (!handlerInput.requestEnvelope.request.intent.confirmationStatus
            || handlerInput.requestEnvelope.request.intent.confirmationStatus === 'NONE');
    },
    async handle(handlerInput: HandlerInput) {
        logger.debug(`CheckReminderHandler -> ${JSON.stringify(handlerInput,null,2)}`)
        const {responseBuilder, requestEnvelope} = handlerInput;
        const consentToken = requestEnvelope.context.System.user.permissions
            && requestEnvelope.context.System.user.permissions.consentToken;
        if (!consentToken) {
            // リマインダーのパーミッションが許可されていない場合は許可を促す
            return responseBuilder
                .speak(textCreator.getMessage("REMINDER_PERMISSION"))
                .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                .getResponse();
        }

        const accessToken = requestEnvelope.session?.user.accessToken;
        if (!accessToken) {
            // トークン未定義の場合はユーザーにアカウントリンクを促す
            return responseBuilder
                .speak(textCreator.getMessage("HELP_ACCOUNT"))
                .withLinkAccountCard()
                .getResponse();
        }

        init(handlerInput, {client: false, display: false});
        return getEntitledProducts(handlerInput).then((entitledProducts)=>{
            if(entitledProducts && entitledProducts.length > 0) {
                const weekTypeSlot = (requestEnvelope.request as IntentRequest).intent.slots?.WeekTypeSlot.resolutions;
                if(weekTypeSlot && weekTypeSlot.resolutionsPerAuthority && weekTypeSlot.resolutionsPerAuthority[0].status.code === "ER_SUCCESS_NO_MATCH") {
                    logger.debug("WeekTypeSlot is not match")
                    return responseBuilder
                        .addElicitSlotDirective("WeekTypeSlot")
                        .speak(textCreator.getMessage("REMINDER_WEEK"))
                        .reprompt(textCreator.getMessage("REMINDER_WEEK"))
                        .getResponse();
                }
                const timerSlot = (requestEnvelope.request as IntentRequest).intent.slots?.TimerSlot;
                const dialogState = (requestEnvelope.request as IntentRequest).dialogState;
                if (dialogState != 'COMPLETED') {
                    return responseBuilder
                        .addDelegateDirective()
                        .getResponse();
                } else {
                    return responseBuilder
                        .speak(textCreator.getReminderConfirm(weekTypeSlot!!.resolutionsPerAuthority!![0].values[0].value.name, timerSlot!!.value!!))
                        .addConfirmIntentDirective()
                        .getResponse();
                }
            } else {
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
    }
}

const SetReminderHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'SetReminder'
            && handlerInput.requestEnvelope.request.intent.confirmationStatus
            && handlerInput.requestEnvelope.request.intent.confirmationStatus != 'NONE';
    },
    async handle(handlerInput: HandlerInput) {
        const {responseBuilder, requestEnvelope, serviceClientFactory} = handlerInput;
        const init_ready = init(handlerInput, { client: true });
        const accessToken = requestEnvelope.session?.user.accessToken;
        if (!accessToken) {
            // トークン未定義の場合はユーザーにアカウントリンクを促す
            return responseBuilder
                .speak(textCreator.getMessage("HELP_ACCOUNT"))
                .withLinkAccountCard()
                .getResponse();
        }
        const intent_request: IntentRequest = requestEnvelope.request as IntentRequest
        if(intent_request.intent.confirmationStatus === 'CONFIRMED') {
            await init_ready
            const trash_data_result = await tsService.getTrashData(accessToken);
            if (trash_data_result && trash_data_result.status === 'error') {
                return responseBuilder
                    .speak(textCreator.getMessage(trash_data_result.msgId!))
                    .withShouldEndSession(true)
                    .getResponse();
            }
            const weekTypeSlot = intent_request.intent.slots!!.WeekTypeSlot.resolutions!!.resolutionsPerAuthority!![0].values[0].value;
            const time = intent_request.intent.slots?.TimerSlot.value!!;
            const remind_data = await tsService.getRemindBody(Number(weekTypeSlot.id), trash_data_result.response || []);

            const locale: string = requestEnvelope.request.locale || "utc";
            const remind_requests = createRemindRequest(remind_data, time, locale);
            logger.debug(`Reminder Body:${JSON.stringify(remind_requests)}`);

            const ReminderManagementServiceClient = serviceClientFactory?.getReminderManagementServiceClient();
            const remind_list: Array<Promise<services.reminderManagement.ReminderResponse> | undefined> = []
            remind_requests.forEach((request_body) => {
                remind_list.push(
                    ReminderManagementServiceClient?.createReminder(request_body)
                );
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
        } else if(intent_request.intent.confirmationStatus === 'DENIED') {
            return responseBuilder
                .speak(textCreator.getMessage("REMINDER_CANCEL"))
                .withShouldEndSession(true)
                .getResponse();
        }
        return responseBuilder.speak(textCreator.getMessage("ERROR_GENERAL")).withShouldEndSession(true).getResponse()
    }
}

const PurchaseHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type ==='IntentRequest' &&
             handlerInput.requestEnvelope.request.intent.name === 'Purchase';
    },
    async handle(handlerInput: HandlerInput) {
        const {responseBuilder, requestEnvelope, serviceClientFactory} = handlerInput;
        const ms = serviceClientFactory?.getMonetizationServiceClient();
        init(handlerInput, {});
        const locale = requestEnvelope.request.locale || "ja";
        const inSkillProductResponse = await ms?.getInSkillProducts(locale)
        try {
            const entitledProducts = inSkillProductResponse?.inSkillProducts.filter(record => record.entitled === 'ENTITLED');
            if (entitledProducts && entitledProducts.length > 0) {
                return responseBuilder.speak(textCreator.getMessage("PURCHASE_ALREADY_PURCHASED")).reprompt(textCreator.getMessage("NOTICE_CONTINUE")).getResponse();
            } else {
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
        } catch (err: any) {
            logger.error(err)
            return responseBuilder.speak(textCreator.getMessage("ERROR_GENERAL")).withShouldEndSession(true).getResponse()
        }
    }
};

const CancelPurchaseHandler = {
    canHandle(handlerInput: HandlerInput){
        return handlerInput.requestEnvelope.request.type ==='IntentRequest'
                && handlerInput.requestEnvelope.request.intent.name === 'CancelPurchase'
    },
    handle(handlerInput: HandlerInput) {
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
}

const PurchaseResultHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type ==='Connections.Response';
    },
    handle(handlerInput: HandlerInput) {
        init(handlerInput, {});
        const {requestEnvelope, responseBuilder} = handlerInput;
        const purchaseRequest:interfaces.connections.ConnectionsRequest = requestEnvelope.request as interfaces.connections.ConnectionsRequest;
        const purchasePayload = purchaseRequest.payload;
        logger.debug("PurchaseResult:" + JSON.stringify(purchasePayload));
        if(purchasePayload?.purchaseResult === 'ACCEPTED') {
            if(purchaseRequest.name === 'Buy' ||  purchaseRequest.name === 'Upsell') {
                return responseBuilder
                    .speak(textCreator.getMessage("PURCHASE_THANKS"))
                    .reprompt(textCreator.getMessage("NOTICE_CONTINUE"))
                    .getResponse();
            } else {
                return responseBuilder
                    .speak(textCreator.getMessage("PURCHASE_CANCEL"))
                    .withShouldEndSession(true)
                    .getResponse();
            }
        } else if(purchasePayload?.purchaseResult === 'DECLINED') {
            return responseBuilder
                .speak(textCreator.getMessage("PURCHASE_CANCEL"))
                .withShouldEndSession(true)
                .getResponse();
        } else if(purchasePayload?.purchaseResult === 'ERROR') {
            return responseBuilder
                .speak(textCreator.getMessage("PURCHASE_CANCEL"))
                .withShouldEndSession(true)
                .getResponse();
        } else if(purchasePayload?.purchasePayload === 'ALREADY_PURCHASED') {
            return responseBuilder
                .speak(textCreator.getMessage("PURCHASE_ALREADY_PURCHASED"))
                .reprompt(textCreator.getMessage("NOTICE_CONTINUE"))
                .getResponse();
        }
        return responseBuilder.speak(textCreator.getMessage("ERROR_GENERAL")).getResponse();
    }
}

const HelpIntentHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
             handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    async handle(handlerInput: HandlerInput) {
        init(handlerInput, {});
        const speechOutput = textCreator.getMessage("HELP_DESCRIBE");
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(speechOutput)
            .getResponse();

    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
                (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    async handle(handlerInput: HandlerInput) {
        init(handlerInput, {});
        const speechOutput = textCreator.getMessage("HELP_BYE");
        return handlerInput.responseBuilder.speak(speechOutput).withShouldEndSession(true).getResponse();

    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    async handle(handlerInput: HandlerInput) {
        return handlerInput.responseBuilder
            .withShouldEndSession(true)
            .getResponse();
    }
};

const NextPreviousIntentHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PreviousIntent');
    },
    async handle(handlerInput: HandlerInput) {
        init(handlerInput, {});
        const speechOut = textCreator.getMessage("HELP_NEXT_PREVIOUS")
        return handlerInput.responseBuilder
            .speak(speechOut)
            .reprompt(speechOut)
            .getResponse();
    }
};

const createRemindRequest = (remind_body: {target_day: number,body: any}[], timer: string, locale: string): services.reminderManagement.ReminderRequest[] =>{
    const remind_requests: services.reminderManagement.ReminderRequest[] = [];
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

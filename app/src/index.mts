import { CompareApiResult, GetTrashDataResult, RecentTrashDate, TextCreator, TrashData, TrashScheduleService } from "trash-common";
import { DisplayCreator } from "./display-creator.mjs";

import LaunchHandler from "./handler/launch.mjs";
import { GetPointDayTrashesHandler } from "./handler/get-pointday-trashes.mjs";
import { GetRegisteredContentHandler } from "./handler/get-registered-content.mjs";
import { GetDayByTrashTypeHandler } from "./handler/get-day-by-trash-type.mjs";

import  { Skill, SkillBuilders, DefaultApiClient, HandlerInput, ResponseBuilder  } from "ask-sdk-core";
import { services,RequestEnvelope,IntentRequest, interfaces } from "ask-sdk-model";
import { Context } from "aws-lambda";
import { DynamoDBAdapter } from "./dynamodb-adapter.mjs";
import { getLogger } from "trash-common";
import { S3PersistenceAdapter } from "ask-sdk-s3-persistence-adapter";
let textCreator: TextCreator,tsService: TrashScheduleService, displayCreator: DisplayCreator
const logger = getLogger();
process.env.RUNLEVEL === "INFO" ? logger.setLevel_INFO() :  logger.setLevel_DEBUG();

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
const CINFO: ClientInfo = {locale: "", timezone: ""};

const init = async (handlerInput: HandlerInput,option: any)=>{
    const { requestEnvelope, serviceClientFactory } = handlerInput;
    const locale: string = requestEnvelope.request.locale || "utc";
    CINFO.locale = locale;
    textCreator = new TextCreator(locale);
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
            upsServiceClient.getSystemTimeZone(deviceId) : new Promise(resolve => { resolve("Asia/Tokyo") })
        ).then((timezone: any)=>{
            CINFO.timezone = timezone;
            logger.debug("timezone:"+timezone);
            tsService =  new TrashScheduleService(
                timezone,
                textCreator,
                new DynamoDBAdapter(),
                {url: process.env.MECAB_API_URL || "", api_key: process.env.MECAB_API_KEY || ""}
            );
        });
    }
};

const getEntitledProducts = async(handlerInput: HandlerInput):Promise<services.monetization.InSkillProduct[]>=>{
        const ms: services.monetization.MonetizationServiceClient|undefined = handlerInput.serviceClientFactory ? handlerInput.serviceClientFactory.getMonetizationServiceClient() : undefined;
        const locale: string|undefined = handlerInput.requestEnvelope.request.locale;
        if(ms && locale) {
            const products =  await ms.getInSkillProducts(locale);
            return products.inSkillProducts.filter(record=> record.entitled === "ENTITLED");
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
    if (handlerInput.requestEnvelope.request.locale === "ja-JP" && user_count % 5 === 0) {
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
export const handler  = async function(event:RequestEnvelope ,context: Context) {
    if(!skill) {
        skill = SkillBuilders.custom()
            .addRequestHandlers(
                LaunchHandler.handle({logger, textCreator, tsService, displayCreator}),
                GetPointDayTrashesHandler.handle({logger, textCreator, tsService, displayCreator}),
                GetRegisteredContentHandler.handle({logger, textCreator, tsService, displayCreator}),
                GetDayByTrashTypeHandler.handle({logger, textCreator, tsService, displayCreator}),
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
    return skill.invoke(event,context).catch(error=>{
        console.error(error);
    });
};

const CheckReminderHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === "IntentRequest"
            && handlerInput.requestEnvelope.request.intent.name === "SetReminder"
            && (!handlerInput.requestEnvelope.request.intent.confirmationStatus
            || handlerInput.requestEnvelope.request.intent.confirmationStatus === "NONE");
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
                .withAskForPermissionsConsentCard(["alexa::alerts:reminders:skill:readwrite"])
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
                if (dialogState != "COMPLETED") {
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
        return handlerInput.requestEnvelope.request.type === "IntentRequest"
            && handlerInput.requestEnvelope.request.intent.name === "SetReminder"
            && handlerInput.requestEnvelope.request.intent.confirmationStatus
            && handlerInput.requestEnvelope.request.intent.confirmationStatus != "NONE";
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
        if(intent_request.intent.confirmationStatus === "CONFIRMED") {
            await init_ready
            const trash_data_result = await tsService.getTrashData(accessToken);
            if (trash_data_result && trash_data_result.status === "error") {
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
                        .withAskForPermissionsConsentCard(["alexa::alerts:reminders:skill:readwrite"])
                        .getResponse();
                }
                return responseBuilder
                    .speak(textCreator.getMessage("ERROR_UNKNOWN"))
                    .withShouldEndSession(true)
                    .getResponse();
            });
        } else if(intent_request.intent.confirmationStatus === "DENIED") {
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
        return handlerInput.requestEnvelope.request.type ==="IntentRequest" &&
             handlerInput.requestEnvelope.request.intent.name === "Purchase";
    },
    async handle(handlerInput: HandlerInput) {
        const {responseBuilder, requestEnvelope, serviceClientFactory} = handlerInput;
        const ms = serviceClientFactory?.getMonetizationServiceClient();
        init(handlerInput, {});
        const locale = requestEnvelope.request.locale || "ja";
        const inSkillProductResponse = await ms?.getInSkillProducts(locale)
        try {
            const entitledProducts = inSkillProductResponse?.inSkillProducts.filter(record => record.entitled === "ENTITLED");
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
        return handlerInput.requestEnvelope.request.type ==="IntentRequest"
                && handlerInput.requestEnvelope.request.intent.name === "CancelPurchase"
    },
    handle(handlerInput: HandlerInput) {
        init(handlerInput, {});
        return handlerInput.responseBuilder
            .addDirective({
                type: "Connections.SendRequest",
                name: "Cancel",
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
        return handlerInput.requestEnvelope.request.type ==="Connections.Response";
    },
    handle(handlerInput: HandlerInput) {
        init(handlerInput, {});
        const {requestEnvelope, responseBuilder} = handlerInput;
        const purchaseRequest:interfaces.connections.ConnectionsRequest = requestEnvelope.request as interfaces.connections.ConnectionsRequest;
        const purchasePayload = purchaseRequest.payload;
        logger.debug("PurchaseResult:" + JSON.stringify(purchasePayload));
        if(purchasePayload?.purchaseResult === "ACCEPTED") {
            if(purchaseRequest.name === "Buy" ||  purchaseRequest.name === "Upsell") {
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
        } else if(purchasePayload?.purchaseResult === "DECLINED") {
            return responseBuilder
                .speak(textCreator.getMessage("PURCHASE_CANCEL"))
                .withShouldEndSession(true)
                .getResponse();
        } else if(purchasePayload?.purchaseResult === "ERROR") {
            return responseBuilder
                .speak(textCreator.getMessage("PURCHASE_CANCEL"))
                .withShouldEndSession(true)
                .getResponse();
        } else if(purchasePayload?.purchasePayload === "ALREADY_PURCHASED") {
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
        return handlerInput.requestEnvelope.request.type === "IntentRequest" &&
             handlerInput.requestEnvelope.request.intent.name === "AMAZON.HelpIntent";
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
        return handlerInput.requestEnvelope.request.type === "IntentRequest" &&
                (handlerInput.requestEnvelope.request.intent.name === "AMAZON.CancelIntent" ||
                handlerInput.requestEnvelope.request.intent.name === "AMAZON.StopIntent");
    },
    async handle(handlerInput: HandlerInput) {
        init(handlerInput, {});
        const speechOutput = textCreator.getMessage("HELP_BYE");
        return handlerInput.responseBuilder.speak(speechOutput).withShouldEndSession(true).getResponse();

    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === "SessionEndedRequest";
    },
    async handle(handlerInput: HandlerInput) {
        return handlerInput.responseBuilder
            .withShouldEndSession(true)
            .getResponse();
    }
};

const NextPreviousIntentHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === "IntentRequest"
        && (handlerInput.requestEnvelope.request.intent.name === "AMAZON.NextIntent"
        || handlerInput.requestEnvelope.request.intent.name === "AMAZON.PreviousIntent");
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

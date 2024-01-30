import { Handler, HandlerParams } from "./types.mjs";
import { RequestHandler, HandlerInput } from "ask-sdk-core";
import { IntentRequest, RequestEnvelope } from "ask-sdk-model";
import { isSupportedAPL, setUpSellMessage } from "../common/common.mjs";

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
export class GetPointDayTrashesHandler extends Handler {
    public static handle(params: HandlerParams): RequestHandler {
        const { logger, textCreator, tsService, displayCreator } = params;
        return {
            canHandle(handlerInput: HandlerInput) {
                return handlerInput.requestEnvelope.request.type === "IntentRequest" &&
                    handlerInput.requestEnvelope.request.intent.name === "GetPointDayTrashes";
            },
            async handle(handlerInput: HandlerInput) {
                const { responseBuilder, requestEnvelope } = handlerInput;
                const accessToken = requestEnvelope.session?.user.accessToken;
                if (accessToken == null) {
                    // トークン未定義の場合はユーザーに許可を促す
                    return responseBuilder
                        .speak(textCreator.getMessage("HELP_ACCOUNT"))
                        .withLinkAccountCard()
                        .getResponse();
                }
                const intentRequest: IntentRequest = requestEnvelope.request as IntentRequest
                const resolutions = intentRequest.intent.slots?.DaySlot.resolutions;
                if (resolutions && resolutions.resolutionsPerAuthority && resolutions.resolutionsPerAuthority[0].status.code === "ER_SUCCESS_MATCH") {
                    let slotValue = Number(resolutions.resolutionsPerAuthority![0].values[0].value.id);

                    const trash_result = await tsService.getTrashData(accessToken)
                    if (!trash_result || trash_result?.status === "error") {
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
                    if (isSupportedAPL(requestEnvelope) && displayCreator) {
                        const schedule_directive = displayCreator.getThrowTrashesDirective(target_day, [
                            { data: first, date: tsService.calculateLocalTime(target_day) },
                            { data: second, date: tsService.calculateLocalTime(target_day + 1) },
                            { data: third, date: tsService.calculateLocalTime(target_day + 2) },
                        ]);
                        responseBuilder.addDirective(schedule_directive).withShouldEndSession(true);
                    }

                    await setUpSellMessage(handlerInput, responseBuilder, textCreator);
                    return responseBuilder.getResponse();
                } else {
                    const speechOut = textCreator.getMessage("ASK_A_DAY");
                    return responseBuilder
                        .speak(speechOut)
                        .reprompt(speechOut)
                        .getResponse();
                }
            }
        }
    }
}
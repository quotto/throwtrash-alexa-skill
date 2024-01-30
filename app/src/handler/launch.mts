import { HandlerInput, RequestHandler } from "ask-sdk";
import { Handler, HandlerParams } from "./types.mjs";
import { GetTrashDataResult } from "trash-common";
import { isSupportedAPL } from "../common/common.mjs";

class LaunchHandler extends Handler {
    public static handle(params: HandlerParams): RequestHandler {
        return {
            canHandle(handlerInput: HandlerInput) {
                return handlerInput.requestEnvelope.request.type === "LaunchRequest";
            },
            async handle(handlerInput: HandlerInput) {
                const { logger, textCreator, tsService, displayCreator } = params;
                logger.debug(JSON.stringify(handlerInput));
                const {requestEnvelope, responseBuilder} = handlerInput;
                const accessToken: string|undefined = requestEnvelope.session ? requestEnvelope.session.user.accessToken : undefined;
                if(!accessToken) {
                    // トークン未定義の場合はユーザーに許可を促す
                    return responseBuilder
                        .speak(textCreator.getMessage("HELP_ACCOUNT"))
                        .withLinkAccountCard()
                        .getResponse();
                }
                const data: GetTrashDataResult | undefined = await tsService.getTrashData(accessToken)
                if (data.status === "error") {
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
            
                if (isSupportedAPL(requestEnvelope) && displayCreator) {
                    const schedule_directive = displayCreator.getThrowTrashesDirective(0, [
                        { data: first, date: tsService.calculateLocalTime(0) },
                        { data: second, date: tsService.calculateLocalTime(1) },
                        { data: third, date: tsService.calculateLocalTime(2) },
                    ])
                    responseBuilder.addDirective(schedule_directive).withShouldEndSession(true);
                }
            
                // 午後であれば明日のゴミ出し予定を答える
                const offset = data.checkedNextday && tsService.calculateLocalTime(0).getHours() >= 12 ? 1 : 0;
                const base_message: string = textCreator.getPointdayResponse(String(offset), threedaysTrashSchedule[offset]);
            
                responseBuilder.speak(base_message);
                responseBuilder.withShouldEndSession(true);
                return responseBuilder.getResponse();
            }
        }
    }
}

export default LaunchHandler;
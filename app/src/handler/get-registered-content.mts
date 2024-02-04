import { HandlerInput, RequestHandler } from "ask-sdk";
import { Handler, HandlerParams } from "./types.mjs"
import { isSupportedAPL } from "../common/handler-helper.mjs";

export class GetRegisteredContentHandler extends Handler {
    public static handle(params: HandlerParams): RequestHandler {
        const { logger, textCreator, tsService, displayCreator } = params;
        return {
            canHandle(handlerInput: HandlerInput) {
                return handlerInput.requestEnvelope.request.type === "IntentRequest" &&
                    handlerInput.requestEnvelope.request.intent.name === "GetRegisteredContent";
            },
            async handle (handlerInput: HandlerInput) {
                const { requestEnvelope, responseBuilder } = handlerInput;
                const accessToken = requestEnvelope.session?.user.accessToken;
                if (accessToken == null) {
                    // トークン未定義の場合はユーザーに許可を促す
                    return responseBuilder
                        .speak(textCreator.getMessage("HELP_ACCOUNT"))
                        .withLinkAccountCard()
                        .getResponse();
                }

                try {
                    const trash_result = await tsService.getTrashData(accessToken)
                    if (!trash_result || trash_result?.status === "error") {
                        return responseBuilder
                            .speak(textCreator.getMessage(trash_result.msgId!))
                            .withShouldEndSession(true)
                            .getResponse();
                    }
                    const schedule_data = textCreator.getAllSchedule(trash_result.response!);
                    if (isSupportedAPL(requestEnvelope) && displayCreator) {
                        responseBuilder.addDirective(
                            displayCreator.getShowScheduleDirective(schedule_data)
                        ).withShouldEndSession(true);
                    }
                    const card_text = textCreator.getRegisterdContentForCard(schedule_data);

                    return responseBuilder.speak(textCreator.getMessage("NOTICE_SEND_SCHEDULE")).withSimpleCard(textCreator.registerd_card_title, card_text).getResponse();
                } catch (err: any) {
                    logger.error(err)
                    return responseBuilder.speak(textCreator.getMessage("ERROR_GENERAL")).withShouldEndSession(true).getResponse();
                }
            }
        };
    }
}
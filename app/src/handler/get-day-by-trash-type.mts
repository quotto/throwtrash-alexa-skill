import { IntentRequest } from "ask-sdk-model";
import { HandlerInput, RequestHandler, ResponseBuilder } from "ask-sdk";
import { Handler, HandlerParams } from "./types.mjs";
import { CompareApiResult, RecentTrashDate, TrashData, TrashScheduleService } from "trash-common";
import { setUpSellMessage } from "../common/handler-helper.mjs";
export class GetDayByTrashTypeHandler extends Handler {
    public static handle(params: HandlerParams): RequestHandler {
        const { logger, textCreator, tsService, displayCreator } = params;
        return {
            canHandle(handlerInput: HandlerInput) {
                return handlerInput.requestEnvelope.request.type === "IntentRequest" &&
                    handlerInput.requestEnvelope.request.intent.name === "GetDayFromTrashType";
            },
            async handle(handlerInput: HandlerInput) {
                const { requestEnvelope, responseBuilder } = handlerInput;
                const accessToken = requestEnvelope.session?.user.accessToken;
                if (accessToken == null) {
                    // トークン未定義の場合はユーザーに許可を促す
                    return responseBuilder
                        .speak(textCreator.getMessage("HELP_ACCOUNT"))
                        .withLinkAccountCard()
                        .getResponse();
                }
                const resolutions = (requestEnvelope.request as IntentRequest).intent.slots?.TrashTypeSlot.resolutions;
                const trash_result = await tsService.getTrashData(accessToken);
                if (!trash_result || trash_result?.status === "error") {
                    return responseBuilder
                        .speak(textCreator.getMessage(trash_result.msgId!))
                        .withShouldEndSession(true)
                        .getResponse();
                }
                if (resolutions && resolutions.resolutionsPerAuthority![0].status.code === "ER_SUCCESS_MATCH") {
                    const slotValue = resolutions.resolutionsPerAuthority![0].values[0].value;
                    const trash_data = tsService.getDayByTrashType(trash_result.response!, slotValue.id);
                    if (trash_data && trash_data.length > 0) {
                        logger.debug("Find Match Trash:" + JSON.stringify(trash_data));
                        responseBuilder
                            .speak(textCreator.getDayByTrashTypeMessage({ type: slotValue.id, name: slotValue.name }, trash_data))
                        await setUpSellMessage(handlerInput, responseBuilder, textCreator);
                        return responseBuilder.getResponse();
                    }
                }
                // ユーザーの発話がスロット以外 または 合致するデータが登録情報に無かった場合はAPIでのテキスト比較を実施する
                logger.debug("Not match resolutions:" + JSON.stringify(requestEnvelope));

                // ユーザーが発話したゴミ
                const speeched_trash: string = (requestEnvelope.request as IntentRequest).intent.slots?.TrashTypeSlot.value as string;
                logger.debug("check freetext trash:" + speeched_trash);
                // 登録タイプotherのみを比較対象とする
                const other_trashes = trash_result.response?.filter((value) => {
                    return value.type === "other"
                });

                let trash_data: RecentTrashDate[] = [];

                // otherタイプの登録があれば比較する
                let speech_prefix = "";
                if (other_trashes && other_trashes.length > 0) {
                    try {
                        const compare_result: CompareApiResult[] =
                            await tsService.compareMultipleTrashText(speeched_trash, other_trashes.map((trash: TrashData): string => trash.trash_val || ""));
                        logger.info("compare result:" + JSON.stringify(compare_result));
                        const max_data = { trash: "", score: 0, index: 0 };
                        compare_result.forEach((result, index) => {
                            if (result.score >= max_data.score) {
                                max_data.trash = result.match
                                max_data.score = result.score
                                max_data.index = index
                            }
                        });
                        if (max_data.score >= 0.5) {
                            if (max_data.score < 0.7 && max_data.score >= 0.5) {
                                speech_prefix = `${max_data.trash} ですか？`;
                            }
                            trash_data = tsService.getDayByTrashType([other_trashes[max_data.index]], "other");
                        }
                    } catch (error: any) {
                        logger.error(error);
                        return responseBuilder.speak(textCreator.getMessage("ERROR_UNKNOWN")).withShouldEndSession(true).getResponse();
                    }
                }
                responseBuilder.speak(speech_prefix + textCreator.getDayByTrashTypeMessage({ type: "other", name: speeched_trash }, trash_data));

                await setUpSellMessage(handlerInput, responseBuilder, textCreator);
                return responseBuilder.getResponse();
            }
        }
    }
}
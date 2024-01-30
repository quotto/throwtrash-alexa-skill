import { HandlerInput, ResponseBuilder } from "ask-sdk";
import { services, RequestEnvelope } from "ask-sdk-model";
import { TextCreator } from "trash-common";
/**
 *
 * RequestEnvelopeからディスプレイを持つデバイスであるかどうかを判定する
 *
 * @param requestEnvelope Alexaデバイスから受け取ったRequestEnvelope
 * @returns ディスプレイを持つデバイスの場合:true, それ以外:false
 */
export const isSupportedAPL = function(requestEnvelope: RequestEnvelope): Boolean {
    const device = requestEnvelope.context.System.device;
    return device != undefined && device.supportedInterfaces != undefined &&
            device.supportedInterfaces!["Alexa.Presentation.APL"] != undefined;
}

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
        return 1;
    }
};
export const setUpSellMessage = async(handlerInput: HandlerInput, responseBuilder: ResponseBuilder, textCreator: TextCreator): Promise<boolean> => {
    const user_count = await updateUserHistory(handlerInput);
    if (handlerInput.requestEnvelope.request.locale === "ja-JP" && user_count % 5 === 0) {
        try {
            const entitledProducts = await getEntitledProducts(handlerInput);
            if (!entitledProducts || entitledProducts.length === 0) {
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
        }
    }
    return false;
}
import { RequestEnvelope } from "ask-sdk-model";
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
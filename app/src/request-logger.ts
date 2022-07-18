import {RequestEnvelope} from 'ask-sdk-model'
export interface RequestLogger {
    logRequest(request: RequestEnvelope):void
    logErrorRequest(request: RequestEnvelope): void
}
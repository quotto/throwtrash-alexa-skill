import { RequestEnvelope } from 'ask-sdk-model'
export interface RequestLogger {
    logRequest(request: RequestEnvelope,prefix: string):void
    logErrorRequest(request: RequestEnvelope, prefix: string): void
}
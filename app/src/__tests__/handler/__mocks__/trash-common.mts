import { jest } from '@jest/globals';
import { HandlerInput, ResponseBuilder } from 'ask-sdk';
import { ui,Response,Directive, Intent, canfulfill, interfaces } from "ask-sdk-model";
import { DBAdapter, LocaleText, TextCreator, TrashData, TrashDataText, TrashScheduleService, TrashTypeValue } from 'trash-common';
import { DisplayCreator } from '../../../display-creator.mjs';

export const MockedTextCreator = {
    newInstance: (): TextCreator => ({
        getMessage: jest.fn<(message_id: keyof LocaleText) => string>(),
        getPointdayResponse: jest.fn((offset, data) => "今日出せるゴミは燃えるゴミです。"),
        createTrashMessageBody: jest.fn<(trash_items: TrashTypeValue[])=>string>(),
        getLaunchResponse: jest.fn<(trash_items: TrashTypeValue[])=>string>(),
        getDayByTrashTypeMessage: jest.fn<(slot_value: TrashTypeValue, target_trash: { key: string; recent: Date; }[])=>string>(),
        getReminderConfirm: jest.fn<(week_type: string, time: string)=>string>(),
        getReminderComplete: jest.fn<(week_type: string, time: string)=>string>(),
        getTrashName: jest.fn<(trash_type: string)=>string>(),
        getAllSchedule: jest.fn<(trashes: TrashData[])=>TrashDataText[]>(),
        getRegisterdContentForCard: jest.fn<(schedule_data: TrashDataText[])=>string>()
    } as unknown as TextCreator)
}

export const MockedTrashScheduleService =  {
    newInstance: (): TrashScheduleService => ({
        getTrashData: jest.fn(),
        checkEnableTrashes: jest.fn(), 
        dbAdapter: jest.mock<DBAdapter>,
        calculateLocalTime: jest.fn(),
        timezone: jest.fn(),
        textCreator: jest.fn(),
        getTargetDayByWeekday: jest.fn(),
        getEnableTrashData: jest.fn(),
    } as unknown as TrashScheduleService)
}

export const MockedDisplayCreator = {
    newInstance: (): DisplayCreator => ({
        getThrowTrashesDirective: jest.fn<(target_day: number, schedules: {data: TrashTypeValue[], date: Date}[])=>Directive>(),
        getShowScheduleDirective: jest.fn<(regis_data: TrashDataText[])=>Directive>()
    } as unknown as DisplayCreator)
}

class MockedResponseBuilderClass implements ResponseBuilder {
    speak(speechOutput: string, playBehavior?: ui.PlayBehavior | undefined): this {
        throw new Error('Method not implemented.');
    }
    reprompt(repromptSpeechOutput: string, playBehavior?: ui.PlayBehavior | undefined): this {
        throw new Error('Method not implemented.');
    }
    withSimpleCard(cardTitle: string, cardContent: string): this {
        throw new Error('Method not implemented.');
    }
    withStandardCard(cardTitle: string, cardContent: string, smallImageUrl?: string | undefined, largeImageUrl?: string | undefined): this {
        throw new Error('Method not implemented.');
    }
    withLinkAccountCard(): this {
        throw new Error('Method not implemented.');
    }
    withAskForPermissionsConsentCard(permissionArray: string[]): this {
        throw new Error('Method not implemented.');
    }
    addDelegateDirective(updatedIntent?: Intent | undefined): this {
        throw new Error('Method not implemented.');
    }
    addElicitSlotDirective(slotToElicit: string, updatedIntent?: Intent | undefined): this {
        throw new Error('Method not implemented.');
    }
    addConfirmSlotDirective(slotToConfirm: string, updatedIntent?: Intent | undefined): this {
        throw new Error('Method not implemented.');
    }
    addConfirmIntentDirective(updatedIntent?: Intent | undefined): this {
        throw new Error('Method not implemented.');
    }
    addAudioPlayerPlayDirective(playBehavior: interfaces.audioplayer.PlayBehavior, url: string, token: string, offsetInMilliseconds: number, expectedPreviousToken?: string | undefined, audioItemMetadata?: interfaces.audioplayer.AudioItemMetadata | undefined): this {
        throw new Error('Method not implemented.');
    }
    addAudioPlayerStopDirective(): this {
        throw new Error('Method not implemented.');
    }
    addAudioPlayerClearQueueDirective(clearBehavior: interfaces.audioplayer.ClearBehavior): this {
        throw new Error('Method not implemented.');
    }
    addRenderTemplateDirective(template: interfaces.display.Template): this {
        throw new Error('Method not implemented.');
    }
    addHintDirective(text: string): this {
        throw new Error('Method not implemented.');
    }
    addVideoAppLaunchDirective(source: string, title?: string | undefined, subtitle?: string | undefined): this {
        throw new Error('Method not implemented.');
    }
    withCanFulfillIntent(canFulfillIntent: canfulfill.CanFulfillIntent): this {
        throw new Error('Method not implemented.');
    }
    withShouldEndSession(val: boolean): this {
        throw new Error('Method not implemented.');
    }
    addDirective(directive: Directive): this {
        throw new Error('Method not implemented.');
    }
    addDirectiveToReprompt(directive: Directive): this {
        throw new Error('Method not implemented.');
    }
    withApiResponse(apiResponse: any): this {
        throw new Error('Method not implemented.');
    }
    addExperimentTrigger(experimentId: string): this {
        throw new Error('Method not implemented.');
    }
    getResponse(): Response {
        throw new Error('Method not implemented.');
    }
    
}

function mockResponseBuilder(mockedResponseBuilder: ResponseBuilder): void {
    mockedResponseBuilder.speak = jest.fn<(speechOutput: string, playBehavior?: ui.PlayBehavior | undefined) => ResponseBuilder>((speechOutput: string, playBehavior?: ui.PlayBehavior | undefined) => mockedResponseBuilder);
    mockedResponseBuilder.withLinkAccountCard = jest.fn<() => ResponseBuilder>(() => mockedResponseBuilder);
    mockedResponseBuilder.getResponse = jest.fn<() => Response>();
    mockedResponseBuilder.addDirective = jest.fn<(directive: Directive) => ResponseBuilder>((directive: Directive) => mockedResponseBuilder);
    mockedResponseBuilder.withShouldEndSession = jest.fn<(val: boolean) => ResponseBuilder>((val: boolean) => mockedResponseBuilder);
    mockedResponseBuilder.withSimpleCard = jest.fn<(cardTitle: string, cardContent: string) => ResponseBuilder>((cardTitle: string, cardContent: string) => mockedResponseBuilder);
    mockedResponseBuilder.withStandardCard = jest.fn<(cardTitle: string, cardContent: string, smallImageUrl?: string) => ResponseBuilder>((cardTitle: string, cardContent: string, smallImageUrl?: string) => mockedResponseBuilder);
    mockedResponseBuilder.withAskForPermissionsConsentCard = jest.fn<(permissionArray: string[]) => ResponseBuilder>((permissionArray: string[]) => mockedResponseBuilder);
    mockedResponseBuilder.reprompt = jest.fn<(repromptSpeechOutput: string, playBehavior?: ui.PlayBehavior | undefined) => ResponseBuilder>((repromptSpeechOutput: string, playBehavior?: ui.PlayBehavior | undefined) => mockedResponseBuilder);
    mockedResponseBuilder.addDelegateDirective = jest.fn<(updatedIntent?: Intent | undefined) => ResponseBuilder>((updatedIntent?: Intent | undefined) => mockedResponseBuilder);
    mockedResponseBuilder.addElicitSlotDirective = jest.fn<(slotToElicit: string, updatedIntent?: Intent | undefined) => ResponseBuilder>((slotToElicit: string, updatedIntent?: Intent | undefined) => mockedResponseBuilder);
    mockedResponseBuilder.addConfirmSlotDirective = jest.fn<(slotToConfirm: string, updatedIntent?: Intent | undefined) => ResponseBuilder>((slotToConfirm: string, updatedIntent?: Intent | undefined) => mockedResponseBuilder);
    mockedResponseBuilder.addConfirmIntentDirective = jest.fn<(updatedIntent?: Intent | undefined) => ResponseBuilder>((updatedIntent?: Intent | undefined) => mockedResponseBuilder);
    mockedResponseBuilder.addAudioPlayerPlayDirective = jest.fn<(playBehavior: interfaces.audioplayer.PlayBehavior, url: string, token: string, offsetInMilliseconds: number, expectedPreviousToken?: string | undefined, audioItemMetadata?: interfaces.audioplayer.AudioItemMetadata | undefined) => ResponseBuilder>((playBehavior: interfaces.audioplayer.PlayBehavior, url: string, token: string, offsetInMilliseconds: number, expectedPreviousToken?: string | undefined, audioItemMetadata?: interfaces.audioplayer.AudioItemMetadata | undefined) => mockedResponseBuilder);
    mockedResponseBuilder.addAudioPlayerStopDirective = jest.fn<() => ResponseBuilder>(() => mockedResponseBuilder);
    mockedResponseBuilder.addRenderTemplateDirective = jest.fn<(template: interfaces.display.Template) => ResponseBuilder>((template: interfaces.display.Template) => mockedResponseBuilder);
    mockedResponseBuilder.addHintDirective = jest.fn<(text: string) => ResponseBuilder>((text: string) => mockedResponseBuilder);
    mockedResponseBuilder.addVideoAppLaunchDirective = jest.fn<(source: string, title?: string | undefined, subtitle?: string | undefined) => ResponseBuilder>((source: string, title?: string | undefined, subtitle?: string | undefined) => mockedResponseBuilder);
    mockedResponseBuilder.addDirectiveToReprompt = jest.fn<(directive: Directive) => ResponseBuilder>((directive: Directive) => mockedResponseBuilder);
    mockedResponseBuilder.addAudioPlayerClearQueueDirective = jest.fn<(clearBehavior: interfaces.audioplayer.ClearBehavior, clearBehaviorArg?: string | undefined) => ResponseBuilder>((clearBehavior: interfaces.audioplayer.ClearBehavior, clearBehaviorArg?: string | undefined) => mockedResponseBuilder);
    mockedResponseBuilder.addExperimentTrigger = jest.fn<(trigger: string) => ResponseBuilder>((trigger: string) => mockedResponseBuilder);
    mockedResponseBuilder.withApiResponse = jest.fn<(apiResponse: any) => ResponseBuilder>((apiResponse: any) => mockedResponseBuilder);
    mockedResponseBuilder.withCanFulfillIntent = jest.fn<(canFulfillIntent: canfulfill.CanFulfillIntent) => ResponseBuilder>((canFulfillIntent: canfulfill.CanFulfillIntent) => mockedResponseBuilder);
}

export const MockedResponseBuilder = {
    newInstance: (): ResponseBuilder => {
        const mockedResponseBuilder = new MockedResponseBuilderClass();
        mockResponseBuilder(mockedResponseBuilder);
        return mockedResponseBuilder;
    }
}

export const MockedHandlerInput = {
    newInstance: (): HandlerInput => ({
        requestEnvelope: {
        version: 'testVersion',
        context: {
            System: {
            application: {
                applicationId: 'testApplicationId'
            },
            user: {
                userId: 'testUserId'
            },
            device: {
                deviceId: 'testDeviceId',
                supportedInterfaces: {
                'Alexa.Presentation.APL': {}
                }
            },
            apiEndpoint: 'testApiEndpoint'
            }
        },
        request: {
            type: 'LaunchRequest',
            requestId: 'testRequestId',
            timestamp: 'testTimestamp'
        },
        session: {
            user: {
            accessToken: 'testToken',
            userId: 'testUserId'
            },
            sessionId: 'testSessionId',
            application: {
            applicationId: 'testApplicationId'
            },
            new: true
        }
        },  
        responseBuilder: MockedResponseBuilder.newInstance(),
        attributesManager: {
        getSessionAttributes: jest.fn<() => any>(),
        setSessionAttributes: jest.fn<(sessionAttributes: any) => void>(),
        getPersistentAttributes: jest.fn<() => Promise<any>>(),
        setPersistentAttributes: jest.fn<(attributes: any) => Promise<void>>(),
        savePersistentAttributes: jest.fn<() => Promise<void>>(),
        deletePersistentAttributes: jest.fn<() => Promise<void>>(),
        getRequestAttributes: jest.fn<() => any>(),
        setRequestAttributes: jest.fn<(requestAttributes: any) => void>()
        }
    })
}
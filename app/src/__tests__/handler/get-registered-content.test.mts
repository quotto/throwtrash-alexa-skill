import { jest } from '@jest/globals';
import { HandlerInput, RequestHandler } from 'ask-sdk';
import { IntentRequest, slu } from 'ask-sdk-model';
import { TextCreator, TrashData, TrashScheduleService, TrashTypeValue, getLogger, TrashDataText } from 'trash-common';
import { DisplayCreator } from '../../display-creator.mjs';
import { MockedDisplayCreator, MockedHandlerInput, MockedTextCreator, MockedTrashScheduleService } from './__mocks__/trash-common.mjs';
import { GetRegisteredContentHandler } from '../../handler/get-registered-content.mjs';

const mockedHandlerInput: HandlerInput = MockedHandlerInput.newInstance();
const mockedTrashScheduleService: TrashScheduleService = MockedTrashScheduleService.newInstance();
const mockedTextCreator: TextCreator = MockedTextCreator.newInstance();
const mockedDisplayCreator: DisplayCreator = MockedDisplayCreator.newInstance();
const testTrashData: TrashData[] = [
  { type: 'burn', trash_val: '燃えるゴミ', schedules: [{ type: 'weekday', value: '0' }] },
  { type: 'unburn', trash_val: '燃えないゴミ', schedules: [{ type: 'weekday', value: '1' }] },
  { type: 'bottole', trash_val: 'ペットボトル', schedules: [{ type: 'weekday', value: '2' }] },
  { type: 'can', trash_val: 'カン', schedules: [{ type: 'weekday', value: '3' }] },
  { type: 'papaer', trash_val: '古紙', schedules: [{ type: 'weekday', value: '4' }] },
  { type: 'resource', trash_val: '資源ごみ', schedules: [{ type: 'weekday', value: '5' }] },
  { type: 'other', trash_val: 'そのほか', schedules: [{ type: 'weekday', value: '6' }] }
];
const testTrashDataText: TrashDataText[] = testTrashData.map((data) => ({type: data.type, typeText: data.trash_val!, schedules: [data.schedules[0].value]} as TrashDataText));
const timezoneOffset = new Date().getTimezoneOffset()
describe('GetRegisteredContentHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedHandlerInput.requestEnvelope.request.type = 'IntentRequest';
    mockedHandlerInput.requestEnvelope.request = {
      type: 'IntentRequest',
      requestId: 'testRequestId',
      timestamp: '2020-01-01T00:00:00Z',
      locale: 'ja-JP',
      intent: {
        name: 'GetRegisteredContent',
        slots: {}
      }
    } as IntentRequest;
  });

  test.each([
    {title: "ディスプレイ対応", supportedDisplay: true},
    {title: "ディスプレイ非対応", supportedDisplay: false},
  ])('正常実行（$title）', async ({title, supportedDisplay}) => {
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockImplementation(async(access_token)=>{ 
      return {status: 'success', response: testTrashData, checkedNextday: true }
    });  
    (mockedTextCreator.getAllSchedule as jest.Mock).mockReturnValue(testTrashDataText);

    if(supportedDisplay){
      mockedHandlerInput.requestEnvelope.context.System.device = {
        deviceId: 'testDeviceId',
        supportedInterfaces: {
          'Alexa.Presentation.APL': {}
        }
      } 
    } else {
      mockedHandlerInput.requestEnvelope.context.System.device = undefined;
    }
    
    const instance = GetRegisteredContentHandler.handle({
      logger: getLogger(),
      textCreator: mockedTextCreator,
      tsService: mockedTrashScheduleService,
      displayCreator: mockedDisplayCreator
    });
    
    expect(instance.canHandle(mockedHandlerInput)).toBe(true); 

    await instance.handle(mockedHandlerInput);
    
    if(supportedDisplay){
      console.log("ディスプレイ対応デバイスの場合はディスプレイディレクティブを追加すること");
      expect(mockedDisplayCreator.getShowScheduleDirective).toHaveBeenCalledWith(testTrashDataText);
      expect(mockedHandlerInput.responseBuilder.addDirective).toHaveBeenCalledWith(mockedDisplayCreator.getShowScheduleDirective(testTrashDataText));
      console.log("ディスプレイ対応デバイスの場合はセッションを終了すること");
      expect(mockedHandlerInput.responseBuilder.withShouldEndSession).toHaveBeenCalledWith(true);
    } else {
      console.log("ディスプレイ非対応デバイスの場合はディスプレイディレクティブを追加しないこと");
      expect(mockedDisplayCreator.getShowScheduleDirective).not.toHaveBeenCalled();
      expect(mockedHandlerInput.responseBuilder.addDirective).not.toHaveBeenCalled();
    }
    console.log("レスポンスに格納するテキストを生成すること");
    expect(mockedTextCreator.getRegisterdContentForCard).toHaveBeenCalledWith(testTrashDataText);
    expect(mockedTextCreator.getMessage).toHaveBeenCalledWith('NOTICE_SEND_SCHEDULE');  
    expect(mockedHandlerInput.responseBuilder.withSimpleCard).toHaveBeenCalled();

  });
  test('トークン未定義の場合はユーザーに許可を促す', async () => {
    mockedHandlerInput.requestEnvelope.session = undefined;
    (mockedTextCreator.getMessage as jest.Mock).mockReturnValue('アカウントリンクを行ってください。');
    const handler: RequestHandler = 
      GetRegisteredContentHandler.handle(
        { logger: getLogger(),  textCreator: mockedTextCreator, tsService: mockedTrashScheduleService, displayCreator: mockedDisplayCreator}
      );

    console.log("LaunchRequestをハンドルすること")
    expect(handler.canHandle(mockedHandlerInput)).toBe(true);
    
    const response = await handler.handle(mockedHandlerInput);

    console.log("トークン未定義の場合はユーザーに許可を促すこと");
    expect(mockedHandlerInput.responseBuilder.speak).toHaveBeenCalledWith('アカウントリンクを行ってください。');
    console.log("リンクアカウントカードが返却されること");
    expect(mockedHandlerInput.responseBuilder.withLinkAccountCard).toHaveBeenCalled();

    // sessionのリストア
    mockedHandlerInput.requestEnvelope.session = {
      new: false,
      sessionId: 'testSessionId',
      application: {
        applicationId: 'testApplicationId'
      },
      attributes: {},
      user: {
        userId: 'testUserId',
        accessToken: 'testAccessToken',
        permissions: {
          consentToken: 'testConsentToken'
        }
      }
    }
  });
  test('ゴミ出し予定の取得に失敗した場合はエラーメッセージを返す', async () => {
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockImplementation(async(accessToken) => {
      return { 
        status: 'error', 
        msgId: 'ERROR_GET_TRASH_SCHEDULE'
      };
    });

    const handler: RequestHandler = 
      GetRegisteredContentHandler.handle(
        { logger: getLogger(),  textCreator: mockedTextCreator, tsService: mockedTrashScheduleService, displayCreator: mockedDisplayCreator}
      );

    await handler.handle(mockedHandlerInput);

    console.log("エラーメッセージを設定すること");
    expect(mockedTextCreator.getMessage).toHaveBeenCalledWith('ERROR_GET_TRASH_SCHEDULE');
    console.log("セッションを終了すること");
    expect(mockedHandlerInput.responseBuilder.withShouldEndSession).toHaveBeenCalledWith(true);
  });
  test('ゴミ出し情報の取得に失敗した場合はエラーメッセージを返す', async () => {
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockImplementation(async(accessToken) => {
      return {
        status: 'error',
        msgId: 'SOME_ERROR'
      };
    });

    const handler: RequestHandler = 
      GetRegisteredContentHandler.handle(
        { logger: getLogger(),  textCreator: mockedTextCreator, tsService: mockedTrashScheduleService, displayCreator: mockedDisplayCreator}
      );

    await handler.handle(mockedHandlerInput);

    console.log("エラーメッセージを設定すること");
    expect(mockedTextCreator.getMessage).toHaveBeenCalledWith('SOME_ERROR');
    console.log("セッションを終了すること");
    expect(mockedHandlerInput.responseBuilder.withShouldEndSession).toHaveBeenCalledWith(true);
  });
  test('想定外のエラーが発生した場合はエラーメッセージを返す', async () => {
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockImplementation(async(accessToken) => {
      throw new Error('testError');
    });

    const handler: RequestHandler = 
      GetRegisteredContentHandler.handle(
        { logger: getLogger(),  textCreator: mockedTextCreator, tsService: mockedTrashScheduleService, displayCreator: mockedDisplayCreator}
      );

    await handler.handle(mockedHandlerInput);

    console.log("エラーメッセージを設定すること");
    expect(mockedTextCreator.getMessage).toHaveBeenCalledWith('ERROR_GENERAL');
    console.log("セッションを終了すること");
    expect(mockedHandlerInput.responseBuilder.withShouldEndSession).toHaveBeenCalledWith(true);
  });
});
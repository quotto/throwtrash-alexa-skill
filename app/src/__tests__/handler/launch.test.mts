import { jest } from "@jest/globals";
import {  HandlerInput, RequestHandler } from "ask-sdk";
import {  TextCreator,  TrashData,  TrashScheduleService, getLogger } from "trash-common";
import { DisplayCreator } from "../../display-creator.mjs";
import LaunchHandler from '../../handler/launch.mjs'; // Assuming this is the correct import path
import { MockedDisplayCreator, MockedHandlerInput,  MockedTextCreator, MockedTrashScheduleService } from "./__mocks__/trash-common.mjs";

const mockedHandlerInput: HandlerInput = MockedHandlerInput.newInstance();
const mockedTrashScheduleService: TrashScheduleService = MockedTrashScheduleService.newInstance();
const mockedTextCreator: TextCreator = MockedTextCreator.newInstance();
const mockedDisplayCreator: DisplayCreator = MockedDisplayCreator.newInstance();
const testTrashData: TrashData[] = [
  { type: 'burn', trash_val: '燃えるゴミ', schedules: [{ type: 'weekday', value: '0' }] },
  { type: 'unburn', trash_val: '燃えないゴミ', schedules: [{ type: 'weekday', value: '1' }] },
  { type: 'bottole', trash_val: 'ペットボトル', schedules: [{ type: 'weekday', value: '2' }] }
];
const timezoneOffset = new Date().getTimezoneOffset()
describe('LaunchHandler', () => {
  const logger = getLogger();
  beforeEach(() => {
    jest.clearAllMocks();
    mockedHandlerInput.requestEnvelope.request.type = 'LaunchRequest';
  });

  test.each([
    {title: "ディスプレイ対応-明日のゴミ出し通知あり-現在時刻0時",supportedDisplay: true, checkedNextday: true, currentDate: new Date(new Date('2020-01-01T00:00:00').getTime() + timezoneOffset * 60 * 1000)},  
    {title: "ディスプレイ対応-明日のゴミ出し通知あり-現在時刻11時",supportedDisplay: true, checkedNextday: true, currentDate: new Date(new Date('2020-01-01T11:00:00').getTime() + timezoneOffset * 60 * 1000)},  
    {title: "ディスプレイ対応-明日のゴミ出し通知あり-現在時刻12時",supportedDisplay: true, checkedNextday: true, currentDate: new Date(new Date('2020-01-01T12:00:00').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-明日のゴミ出し通知あり-現在時刻23時",supportedDisplay: true, checkedNextday: true, currentDate: new Date(new Date('2020-01-01T23:00:00').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-明日のゴミ出し通知なし-現在時刻12時",supportedDisplay: true, checkedNextday: false, currentDate: new Date(new Date('2020-01-01T12:00:00').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ非対応-明日のゴミ出し通知あり-現在時刻0時",supportedDisplay: false, checkedNextday: true, currentDate: new Date(new Date('2020-01-01T00:00:00').getTime() + timezoneOffset * 60 * 1000)},  
  ])('正常実行($title)', async ({title, supportedDisplay, checkedNextday: checkedNextday, currentDate}) => {
    mockedHandlerInput.requestEnvelope.context.System.device = supportedDisplay ? {
      deviceId: 'testDeviceId',
      supportedInterfaces: {
        'Alexa.Presentation.APL': {}
      } 
    } : undefined;

    // currentDateから1日後の日付
    const nextDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    // currentDate2
    const dayAfterTommorowDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000 * 2);
    (mockedTrashScheduleService.calculateLocalTime as jest.Mock).mockImplementation((target_day)=> {
      switch(target_day) {
        case 0:
          return currentDate;
        case 1:
          return nextDate;
        case 2:
          return dayAfterTommorowDate;
      }
    });
    (mockedTrashScheduleService.checkEnableTrashes as jest.Mock).mockImplementation(async(data, target_day) => {
      switch(target_day) {
        case 0:
          return [{ name: testTrashData[0].trash_val, type: testTrashData[0].type }];
        case 1:
          return [{ name: testTrashData[1].trash_val, type: testTrashData[1].type }];
        case 2:
          return [{ name: testTrashData[2].trash_val, type: testTrashData[2].type }];
      }
    });
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockImplementation(async(accessToken) => {
      return { 
        status: 'success', 
        response: testTrashData,
        checkedNextday: checkedNextday
      };
    });
    (mockedTextCreator.getPointdayResponse as jest.Mock).mockImplementation((offset, trashData) => {
      switch(offset) {
        case '0':
          return `今日出せるゴミは${testTrashData[0].trash_val}です。`;
        case '1':
          return `明日出せるゴミは${testTrashData[1].trash_val}です。`;
      }
    });
    const handler: RequestHandler = 
      LaunchHandler.handle(
        { logger: logger,  textCreator: mockedTextCreator, tsService: mockedTrashScheduleService, displayCreator: mockedDisplayCreator}
      );

    console.log("LaunchRequestをハンドルすること")
    expect(handler.canHandle(mockedHandlerInput)).toBe(true);
    
    const response = await handler.handle(mockedHandlerInput);

    if(supportedDisplay) {
      console.log("ディスプレイ対応デバイスの場合は3日分のDirecviteを取得すること");
      expect(mockedDisplayCreator.getThrowTrashesDirective).toHaveBeenCalledWith(0, [
        { data: [{ name: testTrashData[0].trash_val, type: testTrashData[0].type }], date: currentDate },
        { data: [{ name: testTrashData[1].trash_val, type: testTrashData[1].type }], date: nextDate},
        { data: [{ name: testTrashData[2].trash_val, type: testTrashData[2].type }], date: dayAfterTommorowDate },
      ]);

      console.log("ディスプレイ対応デバイスの場合はAPLのディレクティブが追加されること");
      expect(mockedHandlerInput.responseBuilder.addDirective).toHaveBeenCalled();
    } else {
      console.log("ディスプレイ非対応デバイスの場合はDirecviteを取得しないこと");
      expect(mockedDisplayCreator.getThrowTrashesDirective).not.toHaveBeenCalled();

      console.log("ディスプレイ非対応デバイスの場合はAPLのディレクティブが追加されないこと");
      expect(mockedHandlerInput.responseBuilder.addDirective).not.toHaveBeenCalled();
    }
    
    if(!checkedNextday || currentDate.getHours() < 12) {
      console.log("明日の通知設定なしまたは現在の時刻が12時より前の場合は今日のゴミ出し予定を答える");
      expect(mockedTextCreator.getPointdayResponse).toHaveBeenCalledWith('0', [{ name: testTrashData[0].trash_val, type: testTrashData[0].type }]);
      console.log("応答メッセージはgetPointdayResponseの値が設定されること");
      expect((mockedHandlerInput.responseBuilder.speak as jest.Mock).mock.calls[0][0]).toBe(`今日出せるゴミは${testTrashData[0].trash_val}です。`);
    } else {
      console.log("明日の通知設定ありかつ現在の時刻が12時以降の場合は明日のゴミ出し予定を答える");
      expect(mockedTextCreator.getPointdayResponse).toHaveBeenCalledWith('1', [{ name: testTrashData[1].trash_val, type: testTrashData[1].type }]);
      console.log("応答メッセージはgetPointdayResponseの値が設定されること");
      expect((mockedHandlerInput.responseBuilder.speak as jest.Mock).mock.calls[0][0]).toBe(`明日出せるゴミは${testTrashData[1].trash_val}です。`);
    }
  });
  test('トークン未定義の場合はユーザーに許可を促す', async () => {
    mockedHandlerInput.requestEnvelope.session = undefined;
    (mockedTextCreator.getMessage as jest.Mock).mockReturnValue('アカウントリンクを行ってください。');
    const handler: RequestHandler = 
      LaunchHandler.handle(
        { logger: logger,  textCreator: mockedTextCreator, tsService: mockedTrashScheduleService, displayCreator: mockedDisplayCreator}
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
    (mockedTextCreator.getMessage as jest.Mock).mockReturnValue('エラーメッセージ');
    const handler: RequestHandler = 
      LaunchHandler.handle(
        { logger: logger,  textCreator: mockedTextCreator, tsService: mockedTrashScheduleService, displayCreator: mockedDisplayCreator}
      );

    console.log("LaunchRequestをハンドルすること")
    expect(handler.canHandle(mockedHandlerInput)).toBe(true);
    
    await handler.handle(mockedHandlerInput);

    console.log("ゴミ出し予定の取得に失敗した場合はエラーメッセージを返すこと");
    expect(mockedHandlerInput.responseBuilder.speak).toHaveBeenCalledWith('エラーメッセージ');
    console.log("セッションを終了すること");
    expect(mockedHandlerInput.responseBuilder.withShouldEndSession).toHaveBeenCalledWith(true);
  });
  test('リクエストタイプがLaunchRequest以外の場合はハンドルしない', async () => {
    mockedHandlerInput.requestEnvelope.request.type = 'IntentRequest';
    const handler: RequestHandler = 
      LaunchHandler.handle(
        { logger: logger,  textCreator: mockedTextCreator, tsService: mockedTrashScheduleService, displayCreator: mockedDisplayCreator}
      );

    console.log("LaunchRequest以外の場合はハンドルしないこと")
    expect(handler.canHandle(mockedHandlerInput)).toBe(false);
  });
});
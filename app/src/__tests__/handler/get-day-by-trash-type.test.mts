import { jest } from '@jest/globals';
import { HandlerInput, RequestHandler } from 'ask-sdk';
import { IntentRequest } from 'ask-sdk-model';
import { RecentTrashDate, TextCreator, TrashData, TrashScheduleService, getLogger } from 'trash-common';
import { DisplayCreator } from '../../display-creator.mjs';
import { MockedDisplayCreator, MockedHandlerInput, MockedTextCreator, MockedTrashScheduleService } from './__mocks__/trash-common.mjs';
import { GetDayByTrashTypeHandler } from '../../handler/get-day-by-trash-type.mjs';

const mockedHandlerInput: HandlerInput = MockedHandlerInput.newInstance();
const mockedTrashScheduleService: TrashScheduleService = MockedTrashScheduleService.newInstance();
const mockedTextCreator: TextCreator = MockedTextCreator.newInstance();
const mockedDisplayCreator: DisplayCreator = MockedDisplayCreator.newInstance();
const timezoneOffset = new Date().getTimezoneOffset()
const testDateList = [
  new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000),
  new Date(new Date('2020-01-02T00:00:00Z').getTime() + timezoneOffset * 60 * 1000),
]
describe('GetPointdayTrashesHandler', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockedHandlerInput.requestEnvelope.request.type = 'IntentRequest';
      (mockedHandlerInput.requestEnvelope.request as IntentRequest) = {
        type: 'IntentRequest',
        requestId: 'testRequestId',
        timestamp: '2020-01-01T00:00:00Z',
        locale: 'ja-JP',
        intent: {
          // Alexaの登録したインテント名を指定する
          name: 'GetDayFromTrashType',
          confirmationStatus: 'NONE',
          slots: {
            TrashTypeSlot: {
              name: 'DaySlot',
              value: '0',
              confirmationStatus: 'NONE',
              resolutions: {
                resolutionsPerAuthority: [
                  {
                    authority: 'amzn1.er-authority.echo-sdk.<skill-id>.DaySlot',
                    status: {
                      code: 'ER_SUCCESS_MATCH'
                    },
                    values: [
                      {
                        value: {
                          name: '今日',
                          id: '0'
                        }
                      }
                    ]
                  }
                ]
              }
            }
          }
        },
        dialogState: 'STARTED'
      };
    });

  test.each([
    {title: "登録情報1件",  slot: {name: "今日", id: "0"}, 
      getDayResult: [
        { key: '燃えるゴミ',  schedules: [{ type: 'weekday', value: '0' }], excludes: [], recent: testDateList[0], list: testDateList },
      ],
      dayIndex: 0,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "登録情報2件",  slot: {name: "今日", id: "0"}, 
      getDayResult: [
        { key: '燃えるゴミ',  schedules: [{ type: 'weekday', value: '0' }], excludes: [], recent: testDateList[0], list: testDateList },
        { key: '燃えないゴミ',  schedules: [{ type: 'weekday', value: '2' }], excludes: [], recent: testDateList[1], list: testDateList },
      ],
      dayIndex: 0,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
  ])('プリセットのゴミと登録情報が一致（$title）', async ({title, slot, dayIndex, currentDate}) => {
    const testTrashData: TrashData[] = [
      { type: 'burn', trash_val: '燃えるゴミ', schedules: [{ type: 'weekday', value: '0' }] },
      { type: 'unburn', trash_val: '燃えないゴミ', schedules: [{ type: 'weekday', value: '1' }] },
      { type: 'bottole', trash_val: 'ペットボトル', schedules: [{ type: 'weekday', value: '2' }] },
      { type: 'can', trash_val: 'カン', schedules: [{ type: 'weekday', value: '3' }] },
      { type: 'papaer', trash_val: '古紙', schedules: [{ type: 'weekday', value: '4' }] },
      { type: 'resource', trash_val: '資源ごみ', schedules: [{ type: 'weekday', value: '5' }] },
      { type: 'other', trash_val: 'そのほか', schedules: [{ type: 'weekday', value: '6' }] }
    ];
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockImplementation(async(access_token)=>{ 
      return {status: 'success', response: testTrashData, checkedNextday: true }
    });  
    (mockedTrashScheduleService.getDayByTrashType as jest.Mock<(trashes: TrashData[], target: string)=>RecentTrashDate[]>).mockReturnValue(
      [
        { key: '燃えるゴミ',  schedules: [{ type: 'weekday', value: '0' }], excludes: [], recent: currentDate, list: [currentDate] },
      ]);
    (mockedHandlerInput.requestEnvelope.request as IntentRequest).intent.slots!.TrashTypeSlot.resolutions!.resolutionsPerAuthority![0].values[0].value = slot;

    const instance = GetDayByTrashTypeHandler.handle({
      logger: getLogger(),
      textCreator: mockedTextCreator,
      tsService: mockedTrashScheduleService,
      displayCreator: mockedDisplayCreator
    });
    expect(instance.canHandle(mockedHandlerInput)).toBe(true);
    await GetDayByTrashTypeHandler.handle({
      logger: getLogger(),
      textCreator: mockedTextCreator,
      tsService: mockedTrashScheduleService,
      displayCreator: mockedDisplayCreator
    }).handle(mockedHandlerInput);
    
    console.log("スロット値と登録情報が一致した場合は次のゴミ出し日をそのまま返答する");
    expect(mockedTrashScheduleService.getDayByTrashType).toHaveBeenCalledWith(testTrashData, slot.id);
    expect(mockedTextCreator.getDayByTrashTypeMessage).toHaveBeenCalledWith({ type: slot.id, name: slot.name }, [{ key: '燃えるゴミ',  schedules: [{ type: 'weekday', value: '0' }], excludes: [], recent: currentDate, list: [currentDate] }]);
  });
  test.each([
    {
      title: "登録情報その他1件-比較結果1件-比較スコア0.7",
      mockedSlotValue: "そのほかのゴミ",
      mockedTrashData: [
        { type: 'other', trash_val: 'その他', schedules: [{ type: 'weekday', value: '0' }] }
      ],
      mockedCompareMultipleTrashTextResult: [{ match: 'その他', score: 0.7 }],
      expectedMaxScoreIndex: 0,
      expectedMaxScore: 0.7,
      mockedResponseMessage: '次にその他のゴミを出せるのは、明日です。'
    },
    {
      title: "登録情報プリセット1件,その他2件-比較結果2件-比較スコア0.7",
      mockedSlotValue: "そのほかのゴミ",
      mockedTrashData: [
        { type: 'burn', trash_val: '燃えるゴミ', schedules: [{ type: 'weekday', value: '0' }] },
        { type: 'other', trash_val: 'その他', schedules: [{ type: 'weekday', value: '0' }] },
        { type: 'other', trash_val: '生ごみ', schedules: [{ type: 'weekday', value: '0' }] }
      ],
      mockedCompareMultipleTrashTextResult: [{match: '生ごみ', score: 0.3},{ match: 'その他', score: 0.7 }],
      expectedMaxScoreIndex: 1,
      expectedMaxScore: 0.7,
      mockedResponseMessage: '次にその他のゴミを出せるのは、明日です。'
    },
    {
      title: "登録情報プリセット1件,その他1件-比較結果1件-比較スコア0.6",
      mockedSlotValue: "そのほかのゴミ",
      mockedTrashData: [
        { type: 'burn', trash_val: '燃えるゴミ', schedules: [{ type: 'weekday', value: '0' }] },
        { type: 'other', trash_val: 'その他', schedules: [{ type: 'weekday', value: '0' }] },
      ],
      mockedCompareMultipleTrashTextResult: [{ match: 'その他', score: 0.6 }],
      expectedMaxScoreIndex: 0,
      expectedMaxScore: 0.6,
      mockedResponseMessage: '次にその他のゴミを出せるのは、明日です。'
    },
    {
      title: "登録情報プリセット0件,その他2件-比較結果2件-比較スコア0.5",
      mockedSlotValue: "そのほかのゴミ",
      mockedTrashData: [
        { type: 'other', trash_val: 'その他', schedules: [{ type: 'weekday', value: '0' }] },
        { type: 'other', trash_val: '生ごみ', schedules: [{ type: 'weekday', value: '0' }] }
      ],
      mockedCompareMultipleTrashTextResult: [{ match: 'その他', score: 0.5 },{match: '生ごみ', score: 0.3}],
      expectedMaxScoreIndex: 0,
      expectedMaxScore: 0.5,
      mockedResponseMessage: '次にその他のゴミを出せるのは、明日です。'
    },
    {
      title: "登録情報プリセット0件,その他2件-比較結果2件-比較スコア0.4",
      mockedSlotValue: "そのほかのゴミ",
      mockedTrashData: [
        { type: 'other', trash_val: 'その他', schedules: [{ type: 'weekday', value: '0' }] },
        { type: 'other', trash_val: '生ごみ', schedules: [{ type: 'weekday', value: '0' }] }
      ],
      mockedCompareMultipleTrashTextResult: [{ match: 'その他', score: 0.4 },{match: '生ごみ', score: 0.3}],
      expectedMaxScoreIndex: 0,
      expectedMaxScore: 0.4,
      mockedResponseMessage: 'そのようなゴミは登録されていません。'
    },
    {
      title: "登録情報プリセット2件,その他0件-比較結果0件-比較スコア0.0",
      mockedSlotValue: "そのほかのゴミ",
      mockedTrashData: [
        { type: 'burn', trash_val: '燃えるゴミ', schedules: [{ type: 'weekday', value: '0' }] },
        { type: 'unburn', trash_val: '燃えないゴミ', schedules: [{ type: 'weekday', value: '0' }] }
      ],
      mockedCompareMultipleTrashTextResult: [],
      expectedMaxScoreIndex: 0,
      expectedMaxScore: 0.0,
      mockedResponseMessage: 'そのようなゴミは登録されていません。'
    }
  ])('プリセットのゴミと登録情報が一致しない場合はAPIでのテキスト比較を実施する', async ({title,mockedSlotValue,mockedTrashData ,mockedCompareMultipleTrashTextResult,expectedMaxScoreIndex,expectedMaxScore,mockedResponseMessage}) => {
    (mockedHandlerInput.requestEnvelope.request as IntentRequest).intent.slots!.TrashTypeSlot.resolutions!.resolutionsPerAuthority![0].status.code = 'ER_SUCCESS_NO_MATCH';
    (mockedHandlerInput.requestEnvelope.request as IntentRequest).intent.slots!.TrashTypeSlot.value = mockedSlotValue;
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockReturnValue({
      status: 'success',
      response: mockedTrashData,
      checkedNextday: true
    });
    const dummyResult: RecentTrashDate[] = [
      { key: 'その他',  schedules: [{ type: 'weekday', value: '0' }], excludes: [], recent: testDateList[0], list: testDateList }
    ];
    (mockedTrashScheduleService.getDayByTrashType as jest.Mock).mockReturnValue(dummyResult);
    (mockedTrashScheduleService.compareMultipleTrashText as jest.Mock).mockReturnValue(mockedCompareMultipleTrashTextResult);
    (mockedTextCreator.getDayByTrashTypeMessage as jest.Mock).mockReturnValue(mockedResponseMessage);
    
    
    await GetDayByTrashTypeHandler.handle({
      logger: getLogger(),
      textCreator: mockedTextCreator,
      tsService: mockedTrashScheduleService,
      displayCreator: mockedDisplayCreator
    }).handle(mockedHandlerInput);
    
    const filteredMockedTrashData = mockedTrashData.filter((value) => value.type === 'other');
    if(filteredMockedTrashData.length > 0){
      console.log("その他のゴミが登録されている場合はAPIでのテキスト比較を実施すること");
      expect(mockedTrashScheduleService.compareMultipleTrashText).toHaveBeenCalledWith(
        mockedSlotValue,
        filteredMockedTrashData.map((trash: TrashData): string => trash.trash_val || ""));
    } else {
      console.log("その他のゴミが登録されていない場合は何もしないこと");
      expect(mockedTrashScheduleService.compareMultipleTrashText).not.toHaveBeenCalled();
    }
    if(expectedMaxScore >= 0.7){
      console.log("最高スコアが0.7以上の場合はゴミを確定して返答すること");
      expect(mockedTrashScheduleService.getDayByTrashType).toHaveBeenCalledWith([filteredMockedTrashData[expectedMaxScoreIndex]], 'other');
      expect(mockedTextCreator.getDayByTrashTypeMessage).toHaveBeenCalledWith({ type: 'other', name: mockedSlotValue }, dummyResult);
      expect(mockedHandlerInput.responseBuilder.speak).toHaveBeenCalledWith(mockedResponseMessage);
    } else if(expectedMaxScore < 0.7 && expectedMaxScore >= 0.5) {
      console.log("最高スコアが0.7未満かつ0.5以上の場合は確認メッセージを追加して返答すること");
      expect(mockedTrashScheduleService.getDayByTrashType).toHaveBeenCalledWith([filteredMockedTrashData[expectedMaxScoreIndex]], 'other');
      expect(mockedTextCreator.getDayByTrashTypeMessage).toHaveBeenCalledWith({ type: 'other', name: mockedSlotValue }, dummyResult);
      expect(mockedHandlerInput.responseBuilder.speak).toHaveBeenCalledWith(`${mockedCompareMultipleTrashTextResult[expectedMaxScoreIndex].match} ですか？${mockedResponseMessage}`);
    } else {
      console.log("最高スコアが0.5未満の場合はゴミの日を特定しないこと");
      expect(mockedTrashScheduleService.getDayByTrashType).not.toHaveBeenCalled();
      expect(mockedTextCreator.getDayByTrashTypeMessage).toHaveBeenCalledWith({ type: 'other', name: mockedSlotValue }, []);
      expect(mockedHandlerInput.responseBuilder.speak).toHaveBeenCalledWith(mockedResponseMessage);
    }
  });
  test('トークン未定義の場合はユーザーに許可を促す', async () => {
    mockedHandlerInput.requestEnvelope.session = undefined;
    (mockedTextCreator.getMessage as jest.Mock).mockReturnValue('アカウントリンクを行ってください。');
    const handler: RequestHandler = 
      GetDayByTrashTypeHandler.handle(
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
      GetDayByTrashTypeHandler.handle(
        { logger: getLogger(),  textCreator: mockedTextCreator, tsService: mockedTrashScheduleService, displayCreator: mockedDisplayCreator}
      );

    await handler.handle(mockedHandlerInput);

    console.log("エラーメッセージを設定すること");
    expect(mockedTextCreator.getMessage).toHaveBeenCalledWith('ERROR_GET_TRASH_SCHEDULE');
    console.log("セッションを終了すること");
    expect(mockedHandlerInput.responseBuilder.withShouldEndSession).toHaveBeenCalledWith(true);
  });
});
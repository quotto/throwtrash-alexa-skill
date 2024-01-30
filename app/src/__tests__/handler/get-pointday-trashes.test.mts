import { jest } from '@jest/globals';
import { HandlerInput } from 'ask-sdk';
import { IntentRequest } from 'ask-sdk-model';
import { TextCreator, TrashData, TrashScheduleService, getLogger } from 'trash-common';
import { DisplayCreator } from '../../display-creator.mjs';
import { MockedDisplayCreator, MockedHandlerInput, MockedTextCreator, MockedTrashScheduleService } from './__mocks__/trash-common.mjs';
import { GetPointDayTrashesHandler } from '../../handler/get-pointday-trashes.mjs';

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
          name: 'GetPointDayTrashes',
          confirmationStatus: 'NONE',
          slots: {
            DaySlot: {
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
    {title: "ディスプレイ対応-今日", supportedDisplay: true, slot: {name: "今日", id: "0"}, currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
  ])('正常実行（$title）', async ({title, supportedDisplay, slot, currentDate}) => {
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockImplementation(async(access_token)=>{ 
      return {status: 'success', response: testTrashData, checkedNextday: true }
    });  
    (mockedTrashScheduleService.getTargetDayByWeekday as jest.Mock).mockImplementation((weekday)=>{ 
      return 1;
    });
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
    (mockedDisplayCreator.getThrowTrashesDirective as jest.Mock).mockImplementation((target_day, trashes) => {
      return {
        type: 'testDirectiveType',
        target_day: target_day,
        trashes: trashes
      }
    });
    await GetPointDayTrashesHandler.handle({
      logger: getLogger(),
      textCreator: mockedTextCreator,
      tsService: mockedTrashScheduleService,
      displayCreator: mockedDisplayCreator
    }).handle(mockedHandlerInput);
    
    console.log("スロット値が取得できた場合はゴミ出し予定を取得すること");
    expect(mockedTrashScheduleService.getTrashData).toHaveBeenCalled();
    console.log("3日分のゴミ出し可能日を取得すること");
    expect(mockedTrashScheduleService.checkEnableTrashes).toHaveBeenCalledWith(testTrashData, 0);
    expect(mockedTrashScheduleService.checkEnableTrashes).toHaveBeenCalledWith(testTrashData, 1);
    expect(mockedTrashScheduleService.checkEnableTrashes).toHaveBeenCalledWith(testTrashData, 2);
    
    console.log("レスポンスの応答に今日のゴミ出し予定が設定されること");
    expect(mockedTextCreator.getPointdayResponse).toHaveBeenCalledWith('0', [{ name: testTrashData[0].trash_val, type: testTrashData[0].type }]);
    
    console.log("ディスプレイ対応デバイスの場合は3日分のDirecviteを取得すること");
    expect(mockedDisplayCreator.getThrowTrashesDirective).toHaveBeenCalledWith(0, [
      { data: [{ name: testTrashData[0].trash_val, type: testTrashData[0].type }], date: new Date('2020-01-01T00:00:00Z') },
      { data: [{ name: testTrashData[1].trash_val, type: testTrashData[1].type }], date: new Date('2020-01-02T00:00:00Z') },
      { data: [{ name: testTrashData[2].trash_val, type: testTrashData[2].type }], date: new Date('2020-01-03T00:00:00Z') },
    ]);
    expect(mockedHandlerInput.responseBuilder.addDirective).toHaveBeenCalledWith({
      type: 'testDirectiveType',
      target_day: 0,
      trashes: [
        { data: [{ name: testTrashData[0].trash_val, type: testTrashData[0].type }], date: new Date('2020-01-01T00:00:00Z') },
        { data: [{ name: testTrashData[1].trash_val, type: testTrashData[1].type }], date: new Date('2020-01-02T00:00:00Z') },
        { data: [{ name: testTrashData[2].trash_val, type: testTrashData[2].type }], date: new Date('2020-01-03T00:00:00Z') },
      ]
    });
  });
});
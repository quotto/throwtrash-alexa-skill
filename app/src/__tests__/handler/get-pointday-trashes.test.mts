import { jest } from '@jest/globals';
import { HandlerInput, RequestHandler } from 'ask-sdk';
import { IntentRequest } from 'ask-sdk-model';
import { TextCreator, TrashData, TrashScheduleService, TrashTypeValue, getLogger } from 'trash-common';
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
  { type: 'bottole', trash_val: 'ペットボトル', schedules: [{ type: 'weekday', value: '2' }] },
  { type: 'can', trash_val: 'カン', schedules: [{ type: 'weekday', value: '3' }] },
  { type: 'papaer', trash_val: '古紙', schedules: [{ type: 'weekday', value: '4' }] },
  { type: 'resource', trash_val: '資源ごみ', schedules: [{ type: 'weekday', value: '5' }] },
  { type: 'other', trash_val: 'そのほか', schedules: [{ type: 'weekday', value: '6' }] }
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
    {title: "ディスプレイ対応-今日", supportedDisplay: true, slot: {name: "今日", id: "0"}, dayIndex: 0,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-明日", supportedDisplay: true, slot: {name: "明日", id: "1"}, dayIndex: 1,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-明後日", supportedDisplay: true, slot: {name: "明後日", id: "2"}, dayIndex: 2,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-日曜日", supportedDisplay: true, slot: {name: "日曜日", id: "3"}, dayIndex: 0,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-月曜日", supportedDisplay: true, slot: {name: "月曜日", id: "4"}, dayIndex: 1,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-火曜日", supportedDisplay: true, slot: {name: "火曜日", id: "5"}, dayIndex: 2,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-水曜日", supportedDisplay: true, slot: {name: "水曜日", id: "6"}, dayIndex: 3,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-木曜日", supportedDisplay: true, slot: {name: "木曜日", id: "7"}, dayIndex: 4,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-金曜日", supportedDisplay: true, slot: {name: "金曜日", id: "8"}, dayIndex: 5,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
    {title: "ディスプレイ対応-土曜日", supportedDisplay: true, slot: {name: "土曜日", id: "9"}, dayIndex: 6,currentDate: new Date(new Date('2020-01-01T00:00:00Z').getTime() + timezoneOffset * 60 * 1000)},
  ])('正常実行（$title）', async ({title, supportedDisplay, slot, dayIndex, currentDate}) => {
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockImplementation(async(access_token)=>{ 
      return {status: 'success', response: testTrashData, checkedNextday: true }
    });  
    (mockedTrashScheduleService.getTargetDayByWeekday as jest.Mock).mockImplementation((weekday)=>{ 
      return dayIndex;
    });
    (mockedTrashScheduleService.calculateLocalTime as jest.Mock<(target_day: number)=>Date>).mockImplementation((target_day: number)=> {
      return new Date(currentDate.getTime() + 24 * 60 * 60 * 1000 * target_day);
    });
    (mockedTrashScheduleService.checkEnableTrashes as jest.Mock<(data: TrashData[], target_day: number)=>Promise<TrashTypeValue[]>>).mockImplementation(async(data: TrashData[], target_day: number): Promise<TrashTypeValue[]> => {
      // targtet_dayが6を超える場合は、0に戻す
      const index = target_day > 6 ? target_day - 7 : target_day;
      return [{ name: testTrashData[index].trash_val!, type: testTrashData[index].type }];
    });
    (mockedDisplayCreator.getThrowTrashesDirective as jest.Mock).mockImplementation((target_day, trashes) => {
      return {
        type: 'testDirectiveType',
        target_day: target_day,
        trashes: trashes
      }
    });
    (mockedHandlerInput.requestEnvelope.request as IntentRequest).intent.slots!.DaySlot.resolutions!.resolutionsPerAuthority![0].values[0].value = slot;

    await GetPointDayTrashesHandler.handle({
      logger: getLogger(),
      textCreator: mockedTextCreator,
      tsService: mockedTrashScheduleService,
      displayCreator: mockedDisplayCreator
    }).handle(mockedHandlerInput);
    
    console.log("スロット値が取得できた場合はゴミ出し予定を取得すること");
    expect(mockedTrashScheduleService.getTrashData).toHaveBeenCalled();
    console.log("スロット値を起点として3日分のゴミ出し可能日を取得すること");
    expect(mockedTrashScheduleService.checkEnableTrashes).toHaveBeenCalledWith(testTrashData, dayIndex);
    expect(mockedTrashScheduleService.checkEnableTrashes).toHaveBeenCalledWith(testTrashData, dayIndex+1);
    expect(mockedTrashScheduleService.checkEnableTrashes).toHaveBeenCalledWith(testTrashData, dayIndex+2);
    
    console.log(`レスポンスの応答に${slot.name}のゴミ出し予定が設定されること`);
    expect(mockedTextCreator.getPointdayResponse).toHaveBeenCalledWith(String(slot.id), [{ name: testTrashData[dayIndex].trash_val, type: testTrashData[dayIndex].type }]);
    
    if(supportedDisplay){
      console.log("ディスプレイ対応デバイスの場合は3日分のDirecviteを取得すること");
      // 3日分の日付インデックスを求める
      // 6を超える場合は0に戻す
      const firstDayIndex = dayIndex > 6 ? dayIndex - 7 : dayIndex;
      const secondDayIndex = dayIndex+1 > 6 ? dayIndex+1 - 7 : dayIndex+1;
      const thirdDayIndex = dayIndex+2 > 6 ? dayIndex+2 - 7 : dayIndex+2;
      expect(mockedDisplayCreator.getThrowTrashesDirective).toHaveBeenCalledWith(dayIndex, [
        { data: [{ name: testTrashData[firstDayIndex].trash_val, type: testTrashData[firstDayIndex].type }], date: mockedTrashScheduleService.calculateLocalTime(dayIndex) },
        { data: [{ name: testTrashData[secondDayIndex].trash_val, type: testTrashData[secondDayIndex].type }], date: mockedTrashScheduleService.calculateLocalTime(dayIndex+1) },
        { data: [{ name: testTrashData[thirdDayIndex].trash_val, type: testTrashData[thirdDayIndex].type }], date: mockedTrashScheduleService.calculateLocalTime(dayIndex+2) }
      ]);
      expect(mockedHandlerInput.responseBuilder.addDirective).toHaveBeenCalledWith({
        type: 'testDirectiveType',
        target_day: firstDayIndex,
        trashes: [
          { data: [{ name: testTrashData[firstDayIndex].trash_val, type: testTrashData[firstDayIndex].type }], date: mockedTrashScheduleService.calculateLocalTime(dayIndex) },
          { data: [{ name: testTrashData[secondDayIndex].trash_val, type: testTrashData[secondDayIndex].type }], date: mockedTrashScheduleService.calculateLocalTime(dayIndex+1) },
          { data: [{ name: testTrashData[thirdDayIndex].trash_val, type: testTrashData[thirdDayIndex].type }], date: mockedTrashScheduleService.calculateLocalTime(dayIndex+2) }
        ]
      });
    }
  });
});
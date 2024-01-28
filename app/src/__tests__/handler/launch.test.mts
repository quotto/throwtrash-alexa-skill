import { jest } from "@jest/globals";
import {  RequestHandler } from "ask-sdk";
import {  TextCreator,  TrashScheduleService, getLogger } from "trash-common";
import { DisplayCreator } from "../../display-creator.mjs";
import LaunchHandler from '../../handler/launch.mjs'; // Assuming this is the correct import path
import { MockedHandlerInput, MockedResponseBuilder, MockedTextCreator, MockedTrashScheduleService } from "./__mocks__/trash-common.mjs";

const mockedHandlerInput = MockedHandlerInput.newInstance();
const mockedTrashScheduleService = MockedTrashScheduleService.newInstance() as unknown as TrashScheduleService;
const mockedTextCreator = MockedTextCreator.newInstance() as unknown as TextCreator;
describe('LaunchHandler', () => {
  const logger = getLogger();
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle correctly', async () => {
    const displayCreator = new DisplayCreator('ja-JP');

    mockedHandlerInput.requestEnvelope.context.System.device = {
      deviceId: 'testDeviceId',
      supportedInterfaces: {
        'Alexa.Presentation.APL': {}
      }
    };

    (mockedTrashScheduleService.calculateLocalTime as jest.Mock).mockImplementation((target_day)=> {
      switch(target_day) {
        case 0:
          return new Date('2020-01-01T00:00:00+09:00');
        case 1:
          return new Date('2020-01-02T00:00:00+09:00');
        case 2:
          return new Date('2020-01-03T00:00:00+09:00');
      }
    });
    (mockedTrashScheduleService.checkEnableTrashes as jest.Mock).mockImplementation(async(data, target_day) => {
      switch(target_day) {
        case 0:
          return [{ name: '燃えるゴミ', type: 'burn' }];
        case 1:
          return [{ name: '燃えないゴミ', type: 'unburn' }];
        case 2:
          return [{ name: 'ペットボトル', type: 'bottole' }];
      }
    });
    (mockedTrashScheduleService.getTrashData as jest.Mock).mockImplementation(async(accessToken) => {
      return { status: 'success', response: [
        {type: 'burn', name: '燃えるゴミ', schedules: [{type: 'weekday',val: 0}]},
        {type: 'unburn', name: '燃えないゴミ', schedules: [{type: 'weekday',val: 1}]},
        {type: 'bottole', name: 'ペットボトル', schedules: [{type: 'weekday',val: 2}]},
      ] };
    });
    const handler: RequestHandler = 
      LaunchHandler.handle(
        { logger,  textCreator: MockedTextCreator as unknown as TextCreator, tsService: MockedTrashScheduleService as unknown as TrashScheduleService, displayCreator}
      );

    expect(handler.canHandle(mockedHandlerInput)).toBe(true);

    const response = await handler.handle(mockedHandlerInput);
    // ディスプレイ対応デバイスの場合はAPLのディレクティブが追加される
    expect((mockedHandlerInput.responseBuilder.addDirective as jest.Mock)).toHaveBeenCalled();
    // 12時以前の場合は今日のゴミ出し予定を答える
    expect(mockedTextCreator.getPointdayResponse).toHaveBeenCalledWith('0', [{ name: '燃えるゴミ', type: 'burn' }]);
    expect((mockedHandlerInput.responseBuilder.speak as jest.Mock).mock.calls[0][0]).toBe('今日出せるゴミは燃えるゴミです。');
  });
  test('should handle correctly when no display', async () => {
    mockedHandlerInput.responseBuilder.addDirective({} as any).withShouldEndSession(true);
  });
});
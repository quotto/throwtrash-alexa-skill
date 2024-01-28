import { HandlerInput, RequestHandler } from "ask-sdk";
import { Handler, HandlerParams } from "../../handler/types.mjs";
import { DBAdapter, GetTrashDataResult, Logger, TextCreator, TrashScheduleService } from "trash-common";
import { DisplayCreator } from "../../display-creator.mjs";
import { isSupportedAPL } from "../../common/common.mjs";
import LaunchHandler from '../../handler/launch.mjs'; // Assuming this is the correct import path
import { chain } from "lodash";

describe('LaunchHandler', () => {
  let handlerInput: HandlerInput;
  let params: HandlerParams;
  let logger: Logger;
  let textCreator: TextCreator;
  let tsService: TrashScheduleService;
  let displayCreator: DisplayCreator;

  beforeEach(() => {
    // Initialize your mocks here
    handlerInput = {
      requestEnvelope: {
        request: {
          type: 'LaunchRequest'
        },
        session: {
          user: {
            accessToken: 'testToken'
          }
        }
      },
      responseBuilder: {
        speak: jest.fn().mockReturnThis(),
        withLinkAccountCard: jest.fn().mockReturnThis(),
        getResponse: jest.fn().mockReturnThis(),
        withShouldEndSession: jest.fn().mockReturnThis()
      }
    } as unknown as HandlerInput;

    logger = { debug: jest.fn() };
    textCreator = { getMessage: jest.fn() };
    tsService = { 
        getTrashData: jest.fn(),
        checkEnableTrashes: jest.fn(), 
        dbAdapter: jest.mock<DBAdapter>,
        calculateLocalTime: jest.fn(),
        timezone: jest.fn(),
        textCreator: jest.fn(),
        getTargetDayByWeekday: jest.fn(),
        getEnableTrashData: jest.fn(),
    };
    displayCreator = {};

    params = { logger, textCreator, tsService, displayCreator };
  });

  it('should handle correctly', async () => {
    const tsService = jest.mocked(TrashScheduleService); 
    const handler: RequestHandler = LaunchHandler.handle({ logger, textCreator, tsService, displayCreator});

    expect(handler.canHandle(handlerInput)).toBe(true);

    await handler.handle(handlerInput);

    expect(logger.debug).toHaveBeenCalledWith(JSON.stringify(handlerInput));
    expect(tsService.getTrashData).toHaveBeenCalledWith('testToken');
    // Add more assertions based on your logic
  });
});
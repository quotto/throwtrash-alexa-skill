import { Logger, TextCreator, TrashScheduleService } from "trash-common";
import { DisplayCreator } from "../display-creator.mjs";
import { RequestHandler } from "ask-sdk-core";

export interface HandlerParams {
    logger: Logger,
    textCreator: TextCreator,
    tsService: TrashScheduleService,
    displayCreator: DisplayCreator | undefined
}
export abstract class Handler {
    public static handle(params: HandlerParams): RequestHandler {throw new Error("Not Implemented")};
}
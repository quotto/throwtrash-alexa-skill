import { TrashDataText, TrashTypeValue } from "trash-common";
import { Directive } from "ask-sdk-model";
import { cloneDeep } from "lodash-es";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import dateFormat from "dateformat";

const create_response_trash_text = (data: TrashTypeValue[]): string=> {
    const response_text: string[] = [];
    data.forEach((trash_data) => {
        response_text.push(trash_data.name);
    });
    return response_text.join("/");
};

interface DiaplayDateItem {
    data: TrashTypeValue[],
    date: Date
};

export class DisplayCreator {
    private locale: string;
    private displayText: any;
    private commonText: any;
    constructor(locale: string) {
        this.locale = locale;
        this.displayText = require(`./resource/template_text/${locale}.display.json`);
        this.commonText = require(`./resource/template_text/${this.locale}.common.json`);
    }

    getThrowTrashesDirective(target_day: number, schedules: DiaplayDateItem[]): Directive {
        const document = require("./resource/display/apl_template_export.json");
        const datasources = cloneDeep(require("./resource/display/datasources.json"));
        schedules.forEach(schedule=>{
            const item = cloneDeep(require("./resource/display/item_format.json"));
            item.listItemIdentifier = new String(schedule.date);
            item.token = new String(target_day);
            item.textContent.primaryText.text = dateFormat(schedule.date, "yyyy/mm/dd") + `(${this.commonText.weekday[schedule.date.getDay()]})`;
            item.textContent.secondaryText.text = schedule.data.length > 0 ? create_response_trash_text(schedule.data) : this.displayText.nothing;
            if (schedule.data.length > 0) {
                schedule.data.forEach((trashdata) => {
                    const filename = `https://s3-ap-northeast-1.amazonaws.com/myskill-image/throwtrash/${this.locale}/${trashdata.type}.png`;
                    item.image.sources.push(
                        {
                            url: filename,
                            size: "small",
                            widthPixels: 0,
                            heightPixels: 0
                        }
                    );
                });
            }
            datasources.dataSources.listTemplate2ListData.listPage.listItems.push(item);
        })
        datasources.dataSources.listTemplate2Metadata.title = this.displayText.scheduletitle;
        return {
            type: "Alexa.Presentation.APL.RenderDocument",
            document: document.document,
            datasources: datasources.dataSources
        }
    }

    getShowScheduleDirective(regist_data: TrashDataText[]): Directive {
        const document = require("./resource/display/apl_template_export.json");
        const datasources = cloneDeep(require("./resource/display/datasources.json"));
        datasources.dataSources.listTemplate2Metadata.title = this.displayText.title;
        datasources.dataSources.listTemplate2ListData.totalNumberOfItems = regist_data.length;
        regist_data.forEach((trash) => {
            const item = cloneDeep(require("./resource/display/item_format.json"));
            item.listItemIdentifier = trash.type;
            item.token = trash.type;
            item.textContent.primaryText.text = trash.typeText;
            item.textContent.secondaryText.text = trash.schedules.join("<br>");
            item.image.sources.push(
                {
                    url: `https://s3-ap-northeast-1.amazonaws.com/myskill-image/throwtrash/${this.locale}/${trash.type}.png`,
                    size: "small",
                    widthPixels: 0,
                    heightPixels: 0
                }
            );
            datasources.dataSources.listTemplate2ListData.listPage.listItems.push(item);
        });
        return {
            type: "Alexa.Presentation.APL.RenderDocument",
            document: document.document,
            datasources: datasources.dataSources
        }
    }

}
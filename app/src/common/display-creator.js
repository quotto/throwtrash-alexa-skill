'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisplayCreator = void 0;
const _ = require('lodash');
const dateformat = require('dateformat');
const create_response_trash_text = (data) => {
    const response_text = [];
    data.forEach((trash_data) => {
        response_text.push(trash_data.name);
    });
    return response_text.join('/');
};
class DisplayCreator {
    constructor(locale) {
        this.locale = locale;
        this.displayText = require(`./template_text/${locale}.display.json`);
        this.commonText = require(`./template_text/${this.locale}.common.json`);
    }
    getThrowTrashesDirective(target_day, schedules) {
        const document = require('./display/apl_template_export.json');
        const datasources = _.cloneDeep(require('./display/datasources.json'));
        const item = _.cloneDeep(require('./display/item_format.json'));
        schedules.forEach(schedule => {
            item.listItemIdentifier = new String(schedule.date);
            item.token = new String(target_day);
            item.textContent.primaryText.text = dateformat(schedule.date, 'yyyy/mm/dd') + `(${this.commonText.weekday[schedule.date.getDay()]})`;
            item.textContent.secondaryText.text = schedule.data.length > 0 ? create_response_trash_text(schedule.data) : this.displayText.nothing;
            if (schedule.data.length > 0) {
                schedule.data.forEach((trashdata) => {
                    const filename = `https://s3-ap-northeast-1.amazonaws.com/myskill-image/throwtrash/${this.locale}/${trashdata.type}.png`;
                    item.image.sources.push({
                        url: filename,
                        size: 'small',
                        widthPixels: 0,
                        heightPixels: 0
                    });
                });
            }
            datasources.dataSources.listTemplate2ListData.listPage.listItems.push(item);
        });
        datasources.dataSources.listTemplate2Metadata.title = this.displayText.scheduletitle;
        return {
            type: 'Alexa.Presentation.APL.RenderDocument',
            document: document.document,
            datasources: datasources.dataSources
        };
    }
    getShowScheduleDirective(regist_data) {
        const document = require('./display/apl_template_export.json');
        const datasources = _.cloneDeep(require('./display/datasources.json'));
        datasources.dataSources.listTemplate2Metadata.title = this.displayText.registerdtitle;
        datasources.dataSources.listTemplate2ListData.totalNumberOfItems = regist_data.length;
        regist_data.forEach((trash) => {
            const item = _.cloneDeep(require('./display/item_format.json'));
            item.listItemIdentifier = trash.type;
            item.token = trash.type;
            item.textContent.primaryText.text = trash.typeText;
            item.textContent.secondaryText.text = trash.schedules.join('<br>');
            item.image.sources.push({
                url: `https://s3-ap-northeast-1.amazonaws.com/myskill-image/throwtrash/${this.locale}/${trash.type}.png`,
                size: 'small',
                widthPixels: 0,
                heightPixels: 0
            });
            datasources.dataSources.listTemplate2ListData.listPage.listItems.push(item);
        });
        return {
            type: 'Alexa.Presentation.APL.RenderDocument',
            document: document.document,
            datasources: datasources.dataSources
        };
    }
}
exports.DisplayCreator = DisplayCreator;

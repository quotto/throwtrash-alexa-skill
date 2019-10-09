'use strict';

const get_num_sufix = (number)=> {
    let suffix = 'th';
    if (number === '1') {
        suffix = 'st';
    } else if (number === '2') {
        suffix = 'nd';
    } else if (number === '3') {
        suffix = 'rd';
    }

    return String(number) + suffix;
}

class TextCreator {

    /**
     * 
     * @param {string} locale  デバイスから取得できるロケール情報
     */
    constructor(locale) {
        this.locale = locale;
        this.localeText = require(`./template_text/${this.locale}.text.json`);
        this.commonText = require(`./template_text/${this.locale}.common.json`);
    }

    createTrashMessageBody(trash_items) {
        const trash_name_list = [];
        trash_items.forEach((item) => {
            trash_name_list.push(
                item.type === 'other' ? item.name : this.commonText.trashname[item.type]
            );
        });
        const response_trashes = trash_name_list.join(this.localeText.separate);
        return response_trashes;
    }

    /**
     * 今日出せるゴミをテキスト化する
     * @param {Array<object>} trash_items typeとnameを要素に持つJSONオブジェクトの配列
     * @return {string} レスポンスに格納するテキスト
     */
    getLaunchResponse(trash_items) {
        if(trash_items.length === 0) {
            return this.localeText.result.launchnothing;
        } else {
            const body = this.createTrashMessageBody(trash_items);
            return this.localeText.result.launch.replace('%s', body);
        }
    }

    getPointdayResponse(target_day, trash_items) {
        if(trash_items.length === 0) {
            return this.localeText.result.pointnothing.replace('%s', this.commonText.pointday[target_day]);
        } else {
            const body = this.createTrashMessageBody(trash_items);
            return this.localeText.result.pointday.replace('%s1', this.commonText.pointday[target_day]).replace('%s2', body);
        }
    }

    getDayFromTrashTypeMessage(slot_value, target_trash) {
        if(Object.keys(target_trash).length === 0) {
            return this.localeText.result.fromtrashnothing.replace('%s', slot_value.name);
        }
        if(slot_value.id === 'other') {
            const part_text = []
            Object.keys(target_trash).forEach((key) => {
                part_text.push(
                    this.localeText.result.fromtrashtypepart.replace('%s1', key)
                        .replace('%s2', this.localeText.result.fromtrashdate
                            .replace("%m", this.commonText.month ? this.commonText.month[target_trash[key].recent.getMonth()] : target_trash[key].recent.getMonth() + 1)
                            .replace('%d', target_trash[key].recent.getDate())
                            .replace('%w', this.commonText.weekday[target_trash[key].recent.getDay()]
                            ))
                );
            });
            const body = part_text.join(this.localeText.separate);
            return this.localeText.result.fromtrashtype.replace('%s', body);
        }
        else {
            return this.localeText.result.fromtrashtype.replace('%s', this.localeText.result.fromtrashtypepart
                .replace('%s1', slot_value.name)
                .replace('%s2', this.localeText.result.fromtrashdate
                    .replace("%m", this.commonText.month ? this.commonText.month[target_trash[slot_value.id].recent.getMonth()] : target_trash[slot_value.id].recent.getMonth() + 1)
                    .replace('%d', target_trash[slot_value.id].recent.getDate())
                    .replace('%w', this.commonText.weekday[target_trash[slot_value.id].recent.getDay()])
                ));

        }
    }

    get all_schedule() {
        return this.localeText.notice.registerdresponse;
    }

    get launch_reprompt() {
        return this.localeText.notice.continue;
    }

    get require_account_link() {
        return this.localeText.help.account;
    }

    get ask_point_day() {
        return this.localeText.notice.pointdayquestion;
    }

    get ask_trash_type() {
        return this.localeText.notice.fromtrashquestion;
    }

    get help() {
        return this.localeText.help.help;
    }

    get goodbye() {
        return this.localeText.help.bye;
    }

    get next_previous() {
        return this.localeText.help.nextprevious;
    }

    get require_reminder_permission() {
        return this.localeText.reminder.permission;
    }

    get ask_reminder_week() {
        return this.localeText.reminder.week;
    }

    get ask_reminder_time() {
        return this.localeText.reminder.time;
    }

    get finish_set_remind() {
        return this.localeText.reminder.finish;
    }

    get general_error() {
        return this.localeText.error.general;
    }

    get id_not_found_error() {
        return this.localeText.error.idnotfound;
    }

    get thanks() {
        return this.localeText.purchase.thanks;
    }

    get already() {
        return this.localeText.purchase.already;
    }
    get reprompt() {
        return this.localeText.purchase.reprompt;
    }

    get cancel() {
        return this.localeText.purchase.cancel;
    }

    get ok() {
        return this.localeText.purchase.ok;
    }

    get upsell() {
        return this.localeText.purchase.upsell;
    }

    get reminder_cancel() {
        return this.localeText.reminder.cancel;
    }

    get unknown_error() {
        return this.localeText.error.unknown;
    }

    getReminderConfirm(week_type, time) {
        return this.localeText.reminder.confirm.replace('%s1', week_type).replace('%s2', time);
    }

    getReminderComplete(week_type, time) {
        return this.localeText.reminder.complete.replace('%s1', week_type).replace('%s2', time);
    }

    getTrashName(trash_type) {
        return this.commonText.trashname[trash_type];
    }

    /*
    全てのゴミ出し予定を整形された文書データで返す
    trashes: DynamoDBから取得したJSON形式のパラメータ
    */
    getAllSchedule(trashes) {
        const return_data = [];
        trashes.forEach((trash)=>{
            const trash_data = {};
            trash_data.type = trash.type;
            trash_data.typeText = trash.type != 'other' ? this.getTrashName(trash.type) : trash.trash_val;

            trash_data.schedules = [];
            trash.schedules.forEach((schedule)=>{
                if(schedule.type == 'weekday') {
                    trash_data.schedules.push(`${this.commonText.schedule.weekday.replace('%s',this.commonText.weekday[schedule.value])}`);
                } else if(schedule.type == 'biweek') {
                    const matches = schedule.value.match(/(\d)-(\d)/);
                    const weekday = matches[1];
                    const turn = this.locale === 'en-US' ? get_num_sufix(matches[2]) : matches[2];
                    trash_data.schedules.push(this.commonText.schedule.biweek.replace('%s1',turn).replace('%s2',this.commonText.weekday[weekday]));
                } else if(schedule.type == 'month') {
                    const day = this.locale === 'en-US' ? get_num_sufix(schedule.value) : schedule.value;
                    trash_data.schedules.push(`${this.commonText.schedule.month.replace('%s',day)}`);
                } else if(schedule.type == 'evweek') {
                    trash_data.schedules.push(`${this.commonText.schedule.evweek.replace('%s',this.commonText.weekday[schedule.value.weekday])}`);
                }
            });
            return_data.push(trash_data);
        });
        return return_data;
    }

    get registerd_card_title() {
        return this.localeText.card.registerd_title;
    }

    getRegisterdContentForCard(schedule_data) {
        let card_text = '';
        schedule_data.forEach((data) => {
            card_text += `${data.typeText}: ${data.schedules.join(this.localeText.separate)}\n`;
        });

        return card_text;
    }
}

module.exports = TextCreator;
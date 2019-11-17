'use strict';

const _ = require('lodash');
const moment = require('moment-timezone');

const AWS = require('aws-sdk');

const dynamoClient = new AWS.DynamoDB.DocumentClient({region: process.env.AWS_REGION});
class Client {
    constructor(_timezone, _text_creator){
        this.timezone = _timezone || 'utc';
        this.textCreator = _text_creator;
    }

    /**
    access_token: ユーザーを特定するためのuuid
    target_day: 0:今日,1:明日
    **/
    static getTrashData(access_token) {
        const params = {
            TableName: 'TrashSchedule',
            Key: {
                id: access_token
            }
        };
        return dynamoClient.get(params).promise().then(data=>{
            if(typeof(data['Item'])==='undefined') {
                console.log(`[ERROR] User Not Found => ${access_token}`);
                return {
                        status:'error',
                        msgId: 'id_not_found_error' 
                };
            } else {
                return {
                        status:'success',
                        response:JSON.parse(data['Item']['description'])
                };
            }
        }).catch(err=>{
            console.log(err);
            return {
                    status:'error',
                    msgId: 'general_error'
            };
        });
    }

    /**
    target_day: 対象とする日を特定するための値。0なら今日、1なら明日……となる。
    **/
    calculateLocalTime(target_day) {
        const utcdt = new Date(); //UTC時刻
        const localeoffset = moment.tz.zone(this.timezone).utcOffset(utcdt.getTime());
        // 稼働するロケールのオフセットを差し引くことで、new Date(localtime)のロケールのオフセットを打ち消す
        const localtime = utcdt.getTime() + (utcdt.getTimezoneOffset() * 60 * 1000) + ((-1 * localeoffset) * 60 * 1000) + (60 * 24 * 60 * 1000 * target_day);
        const dt = new Date(localtime);
        return dt;
    }

    /**
     * 計算対象日を求める
     * 指定された曜日が現時点から何日後かを返す
    **/
    getTargetDayByWeekday(target_weekday) {
        const dt = this.calculateLocalTime(0);
        const now_weekday = dt.getDay();
        let target_day = target_weekday - now_weekday;
        //1より小さい場合は翌週分
        if(target_day < 1) {
            target_day += 7;
        }
        return target_day;
    }

    async getEnableTrashData(trash,dt) {
        const trash_name = trash['type'] ==='other' ? trash['trash_val'] : this.textCreator.getTrashName(trash['type']);
        const trash_data = {
            type: trash['type'],
            name: trash_name
        };

        const check = (schedule)=>{
            if(schedule['type'] === 'weekday') {
                if(Number(schedule['value']) === dt.getDay()) {
                    return true;
                }
            } else if(schedule['type'] === 'biweek') {
                var matches = schedule['value'].match(/(\d)-(\d)/);
                var weekday = Number(matches[1]);
                var turn = Number(matches[2]);

                // 現在何週目かを求める
                var nowturn = 0;
                var targetdate = dt.getDate();
                while(targetdate > 0) {
                    nowturn += 1;
                    targetdate -= 7;
                }

                if(weekday === dt.getDay() && turn === nowturn) {
                    return true;
                }
            } else if(schedule['type'] === 'month') {
                if(dt.getDate() === Number(schedule['value'])) {
                    return true;
                }
            } else if(schedule['type'] === 'evweek') {
                if(Number(schedule.value.weekday) === dt.getDay()) {
                    const start_dt = new Date(schedule.value.start);
                    start_dt.setHours(0);
                    start_dt.setMinutes(0);
                    start_dt.setSeconds(0);
                    start_dt.setMilliseconds(0);

                    // 今週の日曜日を求める
                    let current_dt = new Date(dt.toISOString());
                    current_dt.setHours(0);
                    current_dt.setMinutes(0);
                    current_dt.setSeconds(0);
                    current_dt.setMilliseconds(0);
                    current_dt.setDate(current_dt.getDate() - current_dt.getDay());

                    // 登録されている日付からの経過日数を求める
                    const past_date = (current_dt - start_dt) / 1000 / 60 / 60 / 24;

                    // 差が0またはあまりが0であれば隔週に該当
                    trash_data.schedule = [];
                    if(past_date === 0 || (past_date / 7) % 2 === 0) {
                        return true;
                    }
                }
            }
        }
        if(trash['schedules'].some(check)) {
            return trash_data;
        }
        return {};
    }

    /**
    trashes:   DynamoDBから取得したJSON形式のパラメータ。
    target_day: チェックするn日目。0なら今日、1なら明日......
    **/
    async checkEnableTrashes(trashes,target_day) {
        const dt = this.calculateLocalTime(target_day);
        let promise_list = [];
        trashes.forEach((trash) => {
            promise_list.push(
                this.getEnableTrashData(trash,dt)
            );
        });
        const result = await Promise.all(promise_list);
        // 同名のゴミがあった場合に重複を排除する
        const keys = [];
        return result.filter((value)=>{
            const key = value.type+value.name;
            if(!value.type || keys.indexOf(key) >= 0) {
                return false;
            } else {
                keys.push(key);
                return true;
            }
        });
    }

    /*
    指定したごみの種類から直近のゴミ捨て日を求める
    trashes: DynamoDBから取得したJSON形式のパラメータ
    target_type: ごみの種類
    */
    getDayFromTrashType(trashes,target_type,timezone) {
        const match_date_list = [];
        trashes.forEach((trash)=>{
            if(trash.type === target_type) {
                const key = trash.type === 'other' ? trash.trash_val : trash.type;
                // schedules:登録されているスケジュール,list:登録スケジュールに対応する直近の日にち,recent:listのうち最も近い日にち
                if(!match_date_list[key]) match_date_list[key] = {schedules: [],list: [],recent: null};
                trash.schedules.forEach((schedule)=>{
                    match_date_list[key].schedules.push(schedule);
                });
            }
        });

        const today_dt = this.calculateLocalTime(0,timezone);
        Object.keys(match_date_list).forEach((key)=>{
            const match_data = match_date_list[key];
            let recently = new Date('9999/12/31');
            match_data.schedules.forEach((schedule)=>{
                let next_dt = _.cloneDeep(today_dt);
                if(schedule.type === 'weekday') {
                    let diff_day = Number(schedule.value) - today_dt.getDay();
                    diff_day < 0 ? next_dt.setDate(today_dt.getDate() + (7 + diff_day)) : next_dt.setDate(today_dt.getDate() + diff_day);
                } else if ((schedule.type === 'month')) {
                    let now_date = today_dt.getDate();
                    while(now_date != schedule.value) {
                        // スケジュールと現在の日にちの差分を取る
                        let diff_date = Number(schedule.value) - now_date;
                        if(diff_date < 0) {
                            // 現在日>設定日の場合は翌月の1日をセットする
                            next_dt.setMonth(next_dt.getMonth() + 1);
                            next_dt.setDate(1);
                            console.log(next_dt);
                        } else {
                            // 現在日<設定日の場合は差分の分だけ日にちを進める
                            next_dt.setDate(next_dt.getDate() + diff_date);
                        }
                        now_date = next_dt.getDate();
                    }
                } else if(schedule.type === 'biweek') {
                    // 設定値
                    const matches = schedule['value'].match(/(\d)-(\d)/);
                    const weekday = Number(matches[1]);
                    const turn = Number(matches[2]);

                    // 直近の同じ曜日の日にちを設定
                    let diff_day = weekday - today_dt.getDay();
                    diff_day < 0 ? next_dt.setDate(today_dt.getDate() + (7 + diff_day)) : next_dt.setDate(today_dt.getDate() + diff_day);

                    // 何週目かを求める
                    let nowturn = 0;
                    let targetdate = next_dt.getDate();
                    while(targetdate > 0) {
                        nowturn += 1;
                        targetdate -= 7;
                    }


                    let current_month = next_dt.getMonth();
                    while(turn != nowturn) {
                        next_dt.setDate(next_dt.getDate()+7);
                        if(current_month != next_dt.getMonth()) {
                            nowturn = 1;
                            current_month = next_dt.getMonth();
                        } else {
                            nowturn += 1;
                        }
                    }
                } else if(schedule.type === 'evweek') {
                    const start_dt = new Date(schedule.value.start);
                    start_dt.setHours(0);
                    start_dt.setMinutes(0);
                    start_dt.setSeconds(0);
                    start_dt.setMilliseconds(0);

                    // 直近の同じ曜日の日にちを設定
                    let diff_date = Number(schedule.value.weekday) - today_dt.getDay();
                    diff_date < 0 ? next_dt.setDate(today_dt.getDate() + (7 + diff_date)) : next_dt.setDate(today_dt.getDate() + diff_date);

                    // 直近の同じ曜日の日にちの日曜日を取得
                    let current_dt = _.cloneDeep(next_dt);
                    current_dt.setHours(0);
                    current_dt.setMinutes(0);
                    current_dt.setSeconds(0);
                    current_dt.setMilliseconds(0);
                    current_dt.setDate(current_dt.getDate() - current_dt.getDay());

                    // 登録されている日付からの経過日数を求める
                    const past_date = (current_dt - start_dt) / 1000 / 60 / 60 / 24;

                    // 差が0以外かつあまりが0でなければ1週間進める
                    if(past_date != 0 && (past_date / 7) % 2 != 0) {
                        next_dt.setDate(next_dt.getDate()+7);
                    }
                }
                if(recently.getTime() > next_dt.getTime()) {
                    recently = next_dt;
                }
                match_data.list.push(_.cloneDeep(next_dt));
            });
            match_data.recent = recently;
        });
        return match_date_list;
    }

    /**
     * 
     * @param {Number} target_week  0:今週, 1:来週
     * @returns {Array} {target_day: オブジェクト配列
     */
    getRemindBody(target_week, trash_data) {
        const result_list = [];
        const today_dt = this.calculateLocalTime(0);
        const weekNum = today_dt.getDay()
        if(target_week === 0) {
            // 今週の場合は明日以降の土曜日までの日にちを算出する
            for(let i=0; i<(6 - weekNum); i++) {
                const target_day = i+1;
                const result = this.checkEnableTrashes(trash_data, target_day)
                result_list.push({
                    target_day: target_day,
                    body: result
                });
            }
        } else if(target_week === 1) {
            const padding_date = 7 - weekNum;
            // 来週の場合は次の日曜日を求める
            for(let i=0; i<7; i++) {
                const target_day = i+padding_date
                const result = this.checkEnableTrashes(trash_data, target_day);
                result_list.push({
                    target_day:  target_day,
                    body: result
                });
            }
        }
        return result_list;
    }
}

module.exports = Client;
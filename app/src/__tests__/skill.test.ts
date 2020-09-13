'use strict'
const common = require("trash-common");
const logger = common.getLogger();
logger.LEVEL =  logger.DEBUG;

// デバッガログの出力設定
process.env.RUNLEVEL = 'DEBUG';
process.env.APP_REGION = "us-west-2"

import {client} from "trash-common"
import { GetTrashDataResult } from "trash-common/dist/client";

import {VirtualAlexa} from 'virtual-alexa';
const model = './src/__tests__/model.json';
import {handler} from '../index'; //テスト実行ディレクトリを起点とした相対パス
const assert = require('assert');


describe('Launch',()=>{
    const spyCalc = jest.spyOn(client.TrashScheduleService.prototype, "calculateLocalTime").mockReturnValue(new Date(1554298037605));
    const spyGetTrashData = jest.spyOn(client.TrashScheduleService.prototype, "getTrashData").mockImplementation((access_token: string)=> {return new Promise(resolve => {
            resolve({
                status: 'sccess',
                response: [{ "type": "bin", "schedules": [{ "type": "biweek", "value": "3-4" }, { "type": "weekday", "value": "4" }, { "type": "none", "value": "" }] }, { "type": "can", "schedules": [{ "type": "weekday", "value": "3" }, { "type": "month", "value": "26" }, { "type": "none", "value": "" }] }]
            });
    })});
    const alexa = VirtualAlexa.Builder()
        .handler(handler)
        .interactionModelFile(model)
        .create();
    alexa.dynamoDB().mock();
    it('Launch without accesstoken', async ()=>{
        const request = alexa.request().launch()
            .set('request.locale', 'ja-JP')
            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        assert.equal(response.prompt(), `<speak>このスキルではごみ出し予定の登録のためにアカウントリンクが必要です。Alexaアプリのホーム画面に表示されたアカウントリンク用カードから、設定を行ってください。</speak>`);
    });
    it('Launch with accesstoken', async()=>{
        const request = alexa.request().launch()
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata')
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        expect(spyGetTrashData).toHaveBeenCalled()
        assert.equal(response.prompt(), `<speak>今日出せるゴミは、カン、です。他に知りたい日にち、あるいはゴミの種類を言ってください。</speak>`);
    });
    it('Launch via RegularAction', async()=>{
        const request = alexa.request().launch()
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata')
                            .set('request.metadata.referrer', 'amzn1.alexa-speechlet-client.SequencedSimpleIntentHandler')
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        assert.equal(response.prompt(), `<speak>今日出せるゴミは、カン、です。</speak>`);
    });
    afterAll(()=>{
        spyCalc.mockRestore()
        spyGetTrashData.mockRestore()
    })
});

describe('GetDayFromTrashes',()=>{
    let spyCalc: any
    let spyGetTrashData: any
    beforeAll(()=>{
        spyCalc = jest.spyOn(client.TrashScheduleService.prototype, "calculateLocalTime").mockReturnValue(new Date(1554298037605));//2019/4/3 Wed 13h
        spyGetTrashData = jest.spyOn(client.TrashScheduleService.prototype, "getTrashData").mockImplementation((access_token) => {
            let return_value: GetTrashDataResult = { status: "error" }
            if (access_token === "testdata") {
                return_value = {
                    status: 'success',
                    response: [{ type: 'other', trash_val: '野菜ジュース', schedules: [{ type: 'weekday', value: '2' }] }]
                }
            } else if (access_token === "testdata2") {
                return_value = {
                    status: 'success',
                    response: [{ type: 'other', trash_val: '不燃ごみ', schedules: [{ type: 'weekday', value: '2' }] }]
                }
            } else if (access_token === "testdata3") {
                return_value = {
                    status: 'success',
                    response: [
                        { type: 'burn', schedules: [{ type: 'weekday', value: '3' }] },
                        { type: 'other', trash_val: '不燃ごみ', schedules: [{ type: 'weekday', value: '2' }] },
                        { type: 'other', trash_val: 'ビンとペットボトル', schedules: [{ type: 'weekday', value: '4' }] },
                    ]
                }
            } else if (access_token === "testdata4") {
                return_value = {
                    status: 'success',
                    response: [{ type: 'burn', schedules: [{ type: 'weekday', value: '2' }] }]
                }
            }
            return new Promise(resolve => {
                resolve(return_value)
            })
        })
    });
    it('一致：登録情報がotherで発話が標準スロット外',async()=>{
        const spyCompare = jest.spyOn(client.TrashScheduleService.prototype, "compareTwoText").mockReturnValue(new Promise(resolve=>resolve(0.8)))
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent('GetDayFromTrashType')
                .set('request.locale', 'ja-JP')
                .set('session.user.accessToken', 'testdata')
                .set('request.intent.slots.TrashTypeSlot',
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: 'NO_MATCH' } }] },
                        value: '野菜のジュース'
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは一致した登録データのtrash_val
            assert.equal(response.prompt(), '<speak>次に野菜ジュースを出せるのは4月9日 火曜日です。</speak>');
        } finally {
            spyCompare.mockRestore()
        }
    });
    it('不一致：登録情報がotherで発話もother（スコアが低い）',async()=>{
        const spyCompare = jest.spyOn(client.TrashScheduleService.prototype, "compareTwoText").mockReturnValue(new Promise(resolve=>resolve(0.1)))
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent('GetDayFromTrashType')
                .set('request.locale', 'ja-JP')
                .set('session.user.accessToken', 'testdata')
                .set('request.intent.slots.TrashTypeSlot',
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: 'NO_MATCH' } }] },
                        value: 'データ上には存在しないゴミ'
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは発話したゴミの名前
            assert.equal(response.prompt(), '<speak>データ上には存在しないゴミはごみ出し予定に登録されていません。</speak>');
        } finally {
            spyCompare.mockRestore()
        }
    });
    it('一致：登録情報がotherで発話が標準スロット',async()=>{
        const spyCompare = jest.spyOn(client.TrashScheduleService.prototype, "compareTwoText").mockReturnValue(new Promise(resolve=>resolve(0.9)))
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent('GetDayFromTrashType')
                .set('request.locale', 'ja-JP')
                .set('session.user.accessToken', 'testdata2')
                .set('request.intent.slots.TrashTypeSlot',
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: 'ER_SUCCESS_MATCH' }, values: [{ value: { id: 'unburn', name: '燃えないゴミ' } }] }] },
                        value: '不燃ゴミ'
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは登録データotherのtrash_val
            assert.equal(response.prompt(), '<speak>次に不燃ごみを出せるのは4月9日 火曜日です。</speak>');
        } finally {
            spyCompare.mockRestore();
        }
    });
    it('不一致：登録情報がotherで発話がスロット外（スコアが低い）',async()=>{
        const spyCompare = jest.spyOn(client.TrashScheduleService.prototype, "compareTwoText").mockReturnValue(new Promise(resolve=>resolve(0.1)))
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent('GetDayFromTrashType')
                .set('request.locale', 'ja-JP')
                .set('session.user.accessToken', 'testdata2')
                .set('request.intent.slots.TrashTypeSlot',
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: 'ER_SUCCESS_MATCH' }, values: [{ value: { id: 'can', name: 'カン' } }] }] },
                        value: '空き缶'
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは発話したゴミの名前
            assert.equal(response.prompt(), '<speak>空き缶はごみ出し予定に登録されていません。</speak>');
        } finally {
            spyCompare.mockRestore()
        }
    });
    it('一致：登録情報が複数のotherで発話が標準スロット外',async()=>{
        const spyCompare = jest.spyOn(client.TrashScheduleService.prototype, "compareTwoText").mockImplementation((text1,text2)=>{
            let result = 0
            if(text1 === "ペットボトル" && text2 === "不燃ごみ") {
                result = 0.1
            } else if(text1 === "ペットボトル" && text2 === "ビンとペットボトル") {
                result = 0.8
            }
            return new Promise(resolve=>resolve(result));
        });
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent('GetDayFromTrashType')
                                .set('request.locale', 'ja-JP')
                                .set('session.user.accessToken','testdata3')
                                .set('request.intent.slots.TrashTypeSlot',
                                    {
                                        resolutions: { resolutionsPerAuthority: [{ status: { code: 'NO_MATCH' } }] },
                                        value: 'ペットボトル'
                                    }
                                )
                                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは登録データで最も一致率が高かったデータのtrash_val
            assert.equal(response.prompt(), '<speak>次にビンとペットボトルを出せるのは4月4日 木曜日です。</speak>');
        } finally {
            spyCompare.mockRestore();
        }
    });
    it('一致：登録情報がother以外で発話が標準スロット',async()=>{
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model)
            .create();
        alexa.dynamoDB().mock();
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata4')
                            .set('request.intent.slots.TrashTypeSlot',
                                {
                                    resolutions: { resolutionsPerAuthority: [{ status: { code: 'ER_SUCCESS_MATCH' }, values: [{ value: { id: 'burn', name: '燃えるゴミ' } }] }] },
                                    value: '可燃ゴミ'
                                }
                            )
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        // レスポンスは登録データのtypeにもとづく標準名称
        assert.equal(response.prompt(), '<speak>次に燃えるゴミを出せるのは4月9日 火曜日です。</speak>');
    });
    it('一致：登録情報がother以外で発話がスロット外r',async()=>{
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model)
            .create();
        alexa.dynamoDB().mock();
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata4')
                            .set('request.intent.slots.TrashTypeSlot',
                                {
                                    resolutions: {resolutionsPerAuthority:[{status:{code: 'NO_MATCH'}}]},
                                    value: '燃えるゴミ'
                                }
                            )
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        // レスポンスは登録情報なし
        assert.equal(response.prompt(), '<speak>燃えるゴミはごみ出し予定に登録されていません。</speak>');
    });
    it('一致：登録情報がotherで発話がother',async()=>{
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model)
            .create();
        alexa.dynamoDB().mock();
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata3')
                            .set('request.intent.slots.TrashTypeSlot',
                                {
                                    resolutions: {resolutionsPerAuthority:[{status:{code: 'ER_SUCCESS_MATCH'},values:[{value: {id: 'other', name: 'その他のゴミ'}}]}]},
                                    value: 'その他のゴミ'
                                }
                            )
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        // レスポンスは登録情報なし
        assert.equal(response.prompt(), '<speak>次に不燃ごみを出せるのは4月9日 火曜日、ビンとペットボトルを出せるのは4月4日 木曜日です。</speak>');
    });

    it('APIエラー',async ()=>{
        const spyCompare = jest.spyOn(client.TrashScheduleService.prototype, "compareTwoText").mockReturnValue(Promise.reject("err"));
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent('GetDayFromTrashType')
                .set('request.locale', 'ja-JP')
                .set('session.user.accessToken', 'testdata')
                .set('request.intent.slots.TrashTypeSlot',
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: 'NO_MATCH' } }] },
                        value: '野菜ジュース'
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            process.env.MecabAPI_URL = '';
            const response = await request.send();
            assert.equal(response.prompt(), `<speak>エラーが発生しました。開発者にお問合せください。</speak>`);
        } finally {
            spyCompare.mockRestore()
        }
    })
    afterAll(()=>{
        spyCalc.mockRestore()
        spyGetTrashData.mockClear()
    })
})
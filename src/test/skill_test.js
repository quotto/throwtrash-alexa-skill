'use strict'
const va = require('virtual-alexa');
const model = require('./model.json');
const handler = './index.js'; //テスト実行ディレクトリを基準とした相対パス
const jp_message = require('../common/template_text/ja-JP.text.json');
const alexa = va.VirtualAlexa.Builder()
                .handler(handler)
                .interactionModel(model)
                .create();
alexa.dynamoDB().mock();
const assert = require('assert');
const Client = require('../client.js');
const sinon = require('sinon');

// デバッガログの出力設定
process.env.LEVEL = 'TEST';

describe('Launch',()=>{
    before(()=>{
        sinon.stub(Client.prototype,'calculateLocalTime').returns(new Date(1554298037605));//2019/4/3 Wed 13h
        sinon.stub(Client, 'getTrashData').withArgs('testdata').returns({
            status: 'sccess',
            response: [{"type": "bin", "schedules": [{ "type": "biweek", "value": "3-4" }, { "type": "weekday", "value": "4" }, { "type": "none", "value": "" } ] }, { "type": "can", "schedules": [ { "type": "weekday", "value": "3" }, { "type": "month", "value": "26" }, { "type": "none", "value": "" } ] }]
        });
    });
    it('Launch without accesstoken', async ()=>{
        const request = alexa.request().launch().set('request.locale', 'ja-JP')
        const response = await request.send();
        assert.equal(response.prompt(), `<speak>${jp_message.help.account}</speak>`);
    });
    it('Launch with accesstoken', async()=>{
        const request = alexa.request().launch()
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata')
        const response = await request.send();
        assert.equal(response.prompt(), `<speak>今日出せるゴミは、カン、です。他に知りたい日にち、あるいはゴミの種類を言ってください。</speak>`);
    });
    after(()=>{
        sinon.restore();
    })
});

describe('GetDayFromTrashes',()=>{
    before(()=>{
        sinon.stub(Client.prototype,'calculateLocalTime').withArgs(0).returns(new Date(1554298037605));//2019/4/3 Wed 13h
        const client_stub = sinon.stub(Client, 'getTrashData');
        client_stub.withArgs('testdata').returns({
            status: 'success',
            response: [{type: 'other', trash_val: '野菜ジュース', schedules:[{type: 'weekday', value: '2'}]}]
        });
        client_stub.withArgs('testdata2').returns({
             status: 'success',
            response: [{type: 'other', trash_val: '不燃ごみ',schedules:[{type: 'weekday', value: '2'}]}]
        });
        client_stub.withArgs('testdata3').returns({
             status: 'success',
            response: [
                {type: 'other', trash_val: '不燃ごみ',schedules:[{type: 'weekday', value: '2'}]},
                {type: 'other', trash_val: '空き缶',schedules:[{type: 'weekday', value: '4'}]},
            ]
        });
        client_stub.withArgs('testdata4').returns({
             status: 'success',
            response: [{type: 'burn', trash_val: '燃えるゴミ',schedules:[{type: 'weekday', value: '2'}]}]
        });
    });
    it('一致：登録情報がotherで発話もother',async()=>{
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata')
                            .set('request.intent.slots.TrashTypeSlot',
                                    {
                                        resolutions: {resolutionsPerAuthority:[{status:{code: 'NO_MATCH'}}]},
                                        value: '野菜ジュース'
                                    }
                                );
        const response = await request.send();
        assert.equal(response.prompt(), '<speak>次に野菜ジュースを出せるのは4月9日 火曜日です。</speak>');
    });
    it('不一致：登録情報がotherで発話もother（スコアが低い）',async()=>{
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata')
                            .set('request.intent.slots.TrashTypeSlot',
                                    {
                                        resolutions: {resolutionsPerAuthority:[{status:{code: 'NO_MATCH'}}]},
                                        value: 'データ上には存在しないゴミ'
                                    }
                                );
        const response = await request.send();
        assert.equal(response.prompt(), '<speak>データ上には存在しないゴミはごみ出し予定に登録されていません。</speak>');
    });
    it('一致：登録情報がotherで発話がother以外',async()=>{
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata2')
                            .set('request.intent.slots.TrashTypeSlot',
                                    {
                                        resolutions: {resolutionsPerAuthority:[{status:{code: 'ER_SUCCESS_MATCH'},values:[{value: {id: 'unburn', name: '燃えないゴミ'}}]}]},
                                        value: '不燃ゴミ'
                                    }
                                );
        const response = await request.send();
        assert.equal(response.prompt(), '<speak>次に不燃ゴミを出せるのは4月9日 火曜日です。</speak>');
    });
    it('不一致：登録情報がotherで発話がother以外（スコアが低い）',async()=>{
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata2')
                            .set('request.intent.slots.TrashTypeSlot',
                                    {
                                        resolutions: {resolutionsPerAuthority:[{status:{code: 'ER_SUCCESS_MATCH'},values:[{value: {id: 'can', name: 'カン'}}]}]},
                                        value: '空き缶'
                                    }
                                );
        const response = await request.send();
        assert.equal(response.prompt(), '<speak>空き缶はごみ出し予定に登録されていません。</speak>');
    });
    it('一致：登録情報が複数のotherで発話がother',async()=>{
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata3')
                            .set('request.intent.slots.TrashTypeSlot',
                                    {
                                        resolutions: {resolutionsPerAuthority:[{status:{code: 'NO_MATCH'}}]},
                                        value: '空き缶'
                                    }
                                );
        const response = await request.send();
        assert.equal(response.prompt(), '<speak>次に空き缶を出せるのは4月4日 木曜日です。</speak>');
    });
    it('一致：登録情報がother以外で発話がother以外',async()=>{
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata4')
                            .set('request.intent.slots.TrashTypeSlot',
                                    {
                                        resolutions: {resolutionsPerAuthority:[{status:{code: 'ER_SUCCESS_MATCH'},values:[{value: {id: 'burn', name: '燃えるゴミ'}}]}]},
                                        value: '可燃ゴミ'
                                    }
                                );
        const response = await request.send();
        assert.equal(response.prompt(), '<speak>次に燃えるゴミを出せるのは4月9日 火曜日です。</speak>');
    });
    it('APIエラー',async ()=>{
        const before_url = process.env.MecabApi_URL;
        const request = alexa.request().intent('GetDayFromTrashType')
                            .set('request.locale', 'ja-JP')
                            .set('session.user.accessToken','testdata')
                            .set('request.intent.slots.TrashTypeSlot',
                                    {
                                        resolutions: {resolutionsPerAuthority:[{status:{code: 'NO_MATCH'}}]},
                                        value: '野菜ジュース'
                                    }
                                );
        try {
            process.env.MecabApi_URL = '';
            const response = await request.send();
            assert.equal(response.prompt(), `<speak>${jp_message.error.unknown}</speak>`);
        } finally {
            // eslint-disable-next-line require-atomic-updates
            process.env.MecabApi_URL = before_url;
        }
    })
    after(()=>{
        sinon.restore();
    })
    })
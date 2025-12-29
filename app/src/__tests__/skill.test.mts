// ESModuleをテストする場合は、jestモジュールを明示的にインポートする必要がある
// https://jestjs.io/docs/ecmascript-modules
import { jest } from "@jest/globals";
import { CompareApiResult, GetTrashDataResult, TrashScheduleService, getLogger } from "trash-common";
const logger = getLogger();
logger.setLevel_DEBUG();

// デバッガログの出力設定
process.env.RUNLEVEL = "DEBUG";
process.env.APP_REGION = "us-west-2"
process.env.APP_ID = "amzn1.ask.skill.test"

import {VirtualAlexa} from "virtual-alexa";
import {handler} from "../index.mjs"; //テスト実行ディレクトリを起点とした相対パス
import assert from "assert";

const model_file_path = "./src/__tests__/model.json";

describe("Launch",()=>{
    let spyGetTrashData: jest.SpiedFunction<(access_token: string) => Promise<GetTrashDataResult>>;
    beforeEach(()=>{
         jest.spyOn(Date,"now").mockReturnValue(1554253200000); // 2019-04-03(Wed) 01:00:00 UTC
         spyGetTrashData = jest.spyOn(TrashScheduleService.prototype, "getTrashData").mockImplementation((_access_token: string)=> {return new Promise(resolve => {
            let checkedNextday = true;
            if (_access_token === "testdata_with_checkedNextday_false") {
                checkedNextday = false;
            }
            resolve({
                status: "sccess",
                response: [
                    { "type": "can", "schedules": [{ "type": "weekday", "value": "3" }, { "type": "month", "value": "26" }, { "type": "none", "value": "" }] },
                    { "type": "burn", "schedules": [{ "type": "weekday", "value": "4" }, { "type": "month", "value": "26" }, { "type": "none", "value": "" }] }],
                checkedNextday: checkedNextday
            });
        })});
    });
    afterEach(()=>{
        jest.restoreAllMocks();
    })
    const alexa = VirtualAlexa.Builder()
        .handler(handler)
        .interactionModelFile(model_file_path)
        .create();
    alexa.dynamoDB().mock();
    it("アクセストークン無しで起動", async ()=>{
        const request = alexa.request().launch()
            .set("request.locale", "ja-JP")
            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        assert.equal(response.prompt(), `<speak>このスキルではごみ出し予定の登録のためにアカウントリンクが必要です。Alexaアプリのホーム画面に表示されたアカウントリンク用カードから、設定を行ってください。</speak>`);
    });
    it("アクセストークン有りで起動-午前中", async()=>{
        const request = alexa.request().launch()
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata")
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        expect(spyGetTrashData).toHaveBeenCalled()
        expect(response.prompt()).toBe(`<speak>今日出せるゴミは、カン、です。</speak>`);
        // supportedIntarfacesが無いのでdisplayは設定されない
        expect(response.display()).toBeUndefined();
    });
    it("アクセストークン有りで起動-午後", async()=>{
         jest.spyOn(Date, "now").mockReturnValue(1554292800000); // 2019-04-03(Wed) 12:00:00 UTC
        const request = alexa.request().launch()
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata_with_checkedNextday_false")
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        expect(spyGetTrashData).toHaveBeenCalled()
        expect(response.prompt()).toBe(`<speak>今日出せるゴミは、カン、です。</speak>`);
        // supportedIntarfacesが無いのでdisplayは設定されない
        expect(response.display()).toBeUndefined();
    });
    it("ディスプレイインターフェース有り",async()=>{
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();

        const request = alexa.request().launch()
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata")
                            .set("context.System.application.applicationId", process.env.APP_ID)
                            .set('context.System.device.supportedInterfaces["Alexa.Presentation.APL"]', {runtime: {maxVersion: '1.7'}});
        const response = await request.send();
        // 中身はdisplay-creatorで検証
        expect(response.directive("Alexa.Presentation.APL.RenderDocument")).toBeDefined();
    });
    it("ディスプレイインターフェース無し（supportedIntarfacesがDisplay）",async()=>{
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();

        const request = alexa.request().launch()
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata")
                            .set("context.System.application.applicationId", process.env.APP_ID)
                            .set("context.System.device.supportedInterfaces.Display", {runtime: {maxVersion: "1.7"}});
        const response = await request.send();
        // 中身はdisplay-creatorで検証
        expect(response.directive("Alexa.Presentation.APL.RenderDocument")).toBeUndefined();
    });
    it("定型アクションで起動-午前-nextdayflagがTrue", async()=>{
        const request = alexa.request().launch()
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata")
                            .set("request.metadata.referrer", "amzn1.alexa-speechlet-SequencedSimpleIntentHandler")
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        expect(response.prompt()).toBe(`<speak>今日出せるゴミは、カン、です。</speak>`);
    });
    it("定型アクションで起動-午後-nextdayflagがTrue", async()=>{
         jest.spyOn(Date, "now").mockReturnValue(1554292800000); // 2019-04-03(Wed) 12:00:00 UTC
        const request = alexa.request().launch()
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata")
                            .set("request.metadata.referrer", "amzn1.alexa-speechlet-SequencedSimpleIntentHandler")
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        expect(response.prompt()).toBe(`<speak>あした出せるゴミは、もえるゴミ、です。</speak>`);
    });
    it("定型アクションで起動-午前-nextdayflagがFalse", async()=>{
        const request = alexa.request().launch()
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata_with_checkedNextday_false")
                            .set("request.metadata.referrer", "amzn1.alexa-speechlet-SequencedSimpleIntentHandler")
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        expect(response.prompt()).toBe(`<speak>今日出せるゴミは、カン、です。</speak>`);
    });
    it("定型アクションで起動-午後-nextdayflagがFalse", async()=>{
         jest.spyOn(Date, "now").mockReturnValue(1554292800000); // 2019-04-03(Wed) 12:00:00 UTC
        const request = alexa.request().launch()
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata_with_checkedNextday_false")
                            .set("request.metadata.referrer", "amzn1.alexa-speechlet-SequencedSimpleIntentHandler")
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        expect(response.prompt()).toBe(`<speak>今日出せるゴミは、カン、です。</speak>`);
    });
});

describe("GetDayFromTrashes",()=>{
    let spyCalc: jest.SpiedFunction<(target_day: number)=>Date>;
    let spyGetTrashData: jest.SpiedFunction<(access_token: string)=>Promise<GetTrashDataResult>>;
    beforeAll(()=>{
        spyCalc = jest.spyOn(TrashScheduleService.prototype, "calculateLocalTime").mockReturnValue(new Date(1554298037605));//2019/4/3 Wed 13h
        spyGetTrashData = jest.spyOn(TrashScheduleService.prototype, "getTrashData").mockImplementation((access_token) => {
            let return_value: GetTrashDataResult = { status: "error" }
            if (access_token === "testdata") {
                return_value = {
                    status: "success",
                    response: [{ type: "other", trash_val: "野菜ジュース", schedules: [{ type: "weekday", value: "2" }] }]
                }
            } else if (access_token === "testdata2") {
                return_value = {
                    status: "success",
                    response: [{ type: "other", trash_val: "不燃ごみ", schedules: [{ type: "weekday", value: "2" }] }]
                }
            } else if (access_token === "testdata3") {
                return_value = {
                    status: "success",
                    response: [
                        { type: "burn", schedules: [{ type: "weekday", value: "3" }] },
                        { type: "other", trash_val: "不燃ごみ", schedules: [{ type: "weekday", value: "2" }] },
                        { type: "other", trash_val: "ビンとペットボトル", schedules: [{ type: "weekday", value: "4" }] },
                    ]
                }
            } else if (access_token === "testdata4") {
                return_value = {
                    status: "success",
                    response: [{ type: "burn", schedules: [{ type: "weekday", value: "2" }] }]
                }
            }
            return new Promise(resolve => {
                resolve(return_value)
            })
        })
    });
    it("一致：登録情報がotherで発話が標準スロット外",async()=>{
        const spyCompare = jest.spyOn(
            TrashScheduleService.prototype, "compareMultipleTrashText").mockReturnValue(
                new Promise(resolve=>resolve([{match: "野菜ジュース",score:0.8}]))
            );
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent("GetDayFromTrashType")
                .set("request.locale", "ja-JP")
                .set("session.user.accessToken", "testdata")
                .set("request.intent.slots.TrashTypeSlot",
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: "NO_MATCH" } }] },
                        value: "野菜のジュース"
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは一致した登録データのtrash_val
            expect(response.prompt()).toBe("<speak>次に野菜ジュースを出せるのは4月9日 火曜日です。</speak>");
        } finally {
            spyCompare.mockRestore()
        }
    });
    it("不一致：登録情報がotherで発話もother（スコアが低い）",async()=>{
        const spyCompare = jest.spyOn(TrashScheduleService.prototype, "compareMultipleTrashText").mockReturnValue(
            new Promise(resolve=>resolve([{match:"もえるごみ",score:0.1}]))
        )
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent("GetDayFromTrashType")
                .set("request.locale", "ja-JP")
                .set("session.user.accessToken", "testdata")
                .set("request.intent.slots.TrashTypeSlot",
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: "NO_MATCH" } }] },
                        value: "データ上には存在しないゴミ"
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは発話したゴミの名前
            expect(response.prompt()).toBe("<speak>データ上には存在しないゴミはごみ出し予定に登録されていません。</speak>");
        } finally {
            spyCompare.mockRestore()
        }
    });
    it("一致：登録情報がotherで発話が標準スロット",async()=>{
        const spyCompare = jest.spyOn(TrashScheduleService.prototype, "compareMultipleTrashText").mockReturnValue(
            new Promise(resolve=>resolve([{match:"もえないゴミ",score:0.9}]))
        )
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent("GetDayFromTrashType")
                .set("request.locale", "ja-JP")
                .set("session.user.accessToken", "testdata2")
                .set("request.intent.slots.TrashTypeSlot",
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: "ER_SUCCESS_MATCH" }, values: [{ value: { id: "unburn", name: "燃えないゴミ" } }] }] },
                        value: "不燃ゴミ"
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは登録データotherのtrash_val
            expect(response.prompt()).toBe("<speak>次に不燃ごみを出せるのは4月9日 火曜日です。</speak>");
        } finally {
            spyCompare.mockRestore();
        }
    });
    it("不一致：登録情報がotherで発話がスロット外（スコアが低い）",async()=>{
        const spyCompare = jest.spyOn(TrashScheduleService.prototype, "compareMultipleTrashText").mockReturnValue(
            new Promise(resolve=>resolve([{match: "びん",score:0.1}]))
        )
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent("GetDayFromTrashType")
                .set("request.locale", "ja-JP")
                .set("session.user.accessToken", "testdata2")
                .set("request.intent.slots.TrashTypeSlot",
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: "ER_SUCCESS_MATCH" }, values: [{ value: { id: "can", name: "カン" } }] }] },
                        value: "空き缶"
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは発話したゴミの名前
            expect(response.prompt()).toBe("<speak>空き缶はごみ出し予定に登録されていません。</speak>");
        } finally {
            spyCompare.mockRestore()
        }
    });
    it("一致：登録情報が複数のotherで発話が標準スロット外",async()=>{
        const spyCompare = jest.spyOn(TrashScheduleService.prototype, "compareMultipleTrashText").mockImplementation((_target: string,_comparisons: string[])=>{
            const result: CompareApiResult[] = [
                {match: "不燃ごみ", score:0.1},
                {match: "ビンとペットボトル", score:0.8}
            ];
            return new Promise(resolve=>resolve(result));
        });
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent("GetDayFromTrashType")
                                .set("request.locale", "ja-JP")
                                .set("session.user.accessToken","testdata3")
                                .set("request.intent.slots.TrashTypeSlot",
                                    {
                                        resolutions: { resolutionsPerAuthority: [{ status: { code: "NO_MATCH" } }] },
                                        value: "ペットボトル"
                                    }
                                )
                                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは登録データで最も一致率が高かったデータのtrash_val
            expect(response.prompt()).toBe("<speak>次にビンとペットボトルを出せるのは4月4日 木曜日です。</speak>");
        } finally {
            spyCompare.mockRestore();
        }
    });
    it("一致：登録情報が複数のotherで発話が標準スロット外かつ最高スコアが0.5より大きく0.7未満",async()=>{
        const spyCompare = jest.spyOn(TrashScheduleService.prototype, "compareMultipleTrashText").mockImplementation((_target: string,_comparisons: string[])=>{
            const result: CompareApiResult[] = [
                {match: "不燃ごみ", score:0.6},
                {match: "ビンとペットボトル", score:0.1}
            ];
            return new Promise(resolve=>resolve(result));
        });
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent("GetDayFromTrashType")
                                .set("request.locale", "ja-JP")
                                .set("session.user.accessToken","testdata3")
                                .set("request.intent.slots.TrashTypeSlot",
                                    {
                                        resolutions: { resolutionsPerAuthority: [{ status: { code: "NO_MATCH" } }] },
                                        value: "もえないゴミ"
                                    }
                                )
                                .set("context.System.application.applicationId", process.env.APP_ID)
            const response = await request.send();
            // レスポンスは登録データで最も一致率が高かったデータのtrash_val、スコアが0.5より大きく0.7未満の場合は確認を入れる
            expect(response.prompt()).toBe("<speak>不燃ごみ ですか？次に不燃ごみを出せるのは4月9日 火曜日です。</speak>");
        } finally {
            spyCompare.mockRestore();
        }
    });
    it("一致：登録情報がother以外で発話が標準スロット",async()=>{
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        const request = alexa.request().intent("GetDayFromTrashType")
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata4")
                            .set("request.intent.slots.TrashTypeSlot",
                                {
                                    resolutions: { resolutionsPerAuthority: [{ status: { code: "ER_SUCCESS_MATCH" }, values: [{ value: { id: "burn", name: "燃えるゴミ" } }] }] },
                                    value: "可燃ゴミ"
                                }
                            )
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        // レスポンスは登録データのtypeにもとづく標準名称
        expect(response.prompt()).toBe("<speak>次に燃えるゴミを出せるのは4月9日 火曜日です。</speak>");
    });
    it("一致：登録情報がother以外で発話がスロット外r",async()=>{
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        const request = alexa.request().intent("GetDayFromTrashType")
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata4")
                            .set("request.intent.slots.TrashTypeSlot",
                                {
                                    resolutions: {resolutionsPerAuthority:[{status:{code: "NO_MATCH"}}]},
                                    value: "燃えるゴミ"
                                }
                            )
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        // レスポンスは登録情報なし
        expect(response.prompt()).toBe("<speak>燃えるゴミはごみ出し予定に登録されていません。</speak>");
    });
    it("一致：登録情報がotherで発話がother",async()=>{
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        const request = alexa.request().intent("GetDayFromTrashType")
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata3")
                            .set("request.intent.slots.TrashTypeSlot",
                                {
                                    resolutions: {resolutionsPerAuthority:[{status:{code: "ER_SUCCESS_MATCH"},values:[{value: {id: "other", name: "その他のゴミ"}}]}]},
                                    value: "その他のゴミ"
                                }
                            )
                            .set("context.System.application.applicationId", process.env.APP_ID)
        const response = await request.send();
        // レスポンスは登録情報なし
        expect(response.prompt()).toBe("<speak>次に不燃ごみを出せるのは4月9日 火曜日、ビンとペットボトルを出せるのは4月4日 木曜日です。</speak>");
    });

    it("APIエラー",async ()=>{
        const spyCompare = jest.spyOn(TrashScheduleService.prototype, "compareMultipleTrashText").mockImplementation(
            (_target: string,_comparisons: string[])=>{throw new Error("APIエラー")}
        );
        const alexa = VirtualAlexa.Builder()
            .handler(handler)
            .interactionModelFile(model_file_path)
            .create();
        alexa.dynamoDB().mock();
        try {
            const request = alexa.request().intent("GetDayFromTrashType")
                .set("request.locale", "ja-JP")
                .set("session.user.accessToken", "testdata")
                .set("request.intent.slots.TrashTypeSlot",
                    {
                        resolutions: { resolutionsPerAuthority: [{ status: { code: "NO_MATCH" } }] },
                        value: "野菜ジュース"
                    }
                )
                .set("context.System.application.applicationId", process.env.APP_ID)
            process.env.MECAB_API_URL = "";
            process.env.MECAB_API_KEY = "";
            const response = await request.send();
            expect(response.prompt()).toBe(`<speak>エラーが発生しました。開発者にお問合せください。</speak>`);
        } finally {
            spyCompare.mockRestore()
        }
    })
    afterAll(()=>{
        spyCalc.mockRestore()
        spyGetTrashData.mockClear()
    })
});

describe("GetPointDayTrashes",()=>{
    let spyGetTrashData: any;
    beforeEach(()=>{
         jest.spyOn(Date,"now").mockReturnValue(1554253200000); // 2019-04-03(Wed) 01:00:00 UTC
         spyGetTrashData = jest.spyOn(TrashScheduleService.prototype, "getTrashData").mockImplementation((_access_token: string)=> {return new Promise(resolve => {
                resolve({
                    status: "sccess",
                    response: [
                        { "type": "can", "schedules": [{ "type": "weekday", "value": "3" }, { "type": "month", "value": "26" }, { "type": "none", "value": "" }] },
                        { "type": "burn", "schedules": [{ "type": "weekday", "value": "4" }, { "type": "month", "value": "26" }, { "type": "none", "value": "" }] }]
                });
        })});
    });
    afterEach(()=>{
        jest.restoreAllMocks();
    })
    const alexa = VirtualAlexa.Builder()
        .handler(handler)
        .interactionModelFile(model_file_path)
        .create();
    alexa.dynamoDB().mock();
    it("今日出せるゴミ-午前中", async()=>{
        const request = alexa.request().intent("GetPointDayTrashes")
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata")
                            .set("context.System.application.applicationId", process.env.APP_ID)
                            .set("request.intent.slots.DaySlot.resolutions.resolutionsPerAuthority",[{
                                status: {
                                    code: "ER_SUCCESS_MATCH"
                                },
                                values: [
                                    {
                                        value: {
                                            id: 0
                                        }
                                    }
                                ]
                            }])
        const response = await request.send();
        expect(spyGetTrashData).toHaveBeenCalled()
        expect(response.prompt()).toBe(`<speak>今日出せるゴミは、カン、です。</speak>`);
        // supportedIntarfacesが無いのでdisplayは設定されない
        expect(response.display()).toBeUndefined();
    });
    it("今日出せるゴミ-午後", async()=>{
        jest.spyOn(Date, "now").mockReturnValue(1554292800000); // 2019-04-03(Wed) 12:00:00 UTC
        const request = alexa.request().intent("GetPointDayTrashes")
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata")
                            .set("context.System.application.applicationId", process.env.APP_ID)
                            .set("request.intent.slots.DaySlot.resolutions.resolutionsPerAuthority",[{
                                status: {
                                    code: "ER_SUCCESS_MATCH"
                                },
                                values: [
                                    {
                                        value: {
                                            id: 0
                                        }
                                    }
                                ]
                            }])
        const response = await request.send();
        expect(spyGetTrashData).toHaveBeenCalled()
        expect(response.prompt()).toBe(`<speak>今日出せるゴミは、カン、です。</speak>`);
        // supportedIntarfacesが無いのでdisplayは設定されない
        expect(response.display()).toBeUndefined();
    });
    it("あした出せるゴミ-午前中", async()=>{
        const request = alexa.request().intent("GetPointDayTrashes")
                            .set("request.locale", "ja-JP")
                            .set("session.user.accessToken","testdata")
                            .set("context.System.application.applicationId", process.env.APP_ID)
                            .set("request.intent.slots.DaySlot.resolutions.resolutionsPerAuthority",[{
                                status: {
                                    code: "ER_SUCCESS_MATCH"
                                },
                                values: [
                                    {
                                        value: {
                                            id: 1
                                        }
                                    }
                                ]
                            }])
        const response = await request.send();
        expect(spyGetTrashData).toHaveBeenCalled()
        expect(response.prompt()).toBe(`<speak>あした出せるゴミは、もえるゴミ、です。</speak>`);
        // supportedIntarfacesが無いのでdisplayは設定されない
        expect(response.display()).toBeUndefined();
    });
    it("あした出せるゴミ-午後", async()=>{
        jest.spyOn(Date, "now").mockReturnValue(1554292800000); // 2019-04-03(Wed) 12:00:00 UTC
        const request = alexa.request().intent("GetPointDayTrashes")
                            .set("request.locale", "ja-JP")
                            .set('session.user.accessToken','testdata')
                            .set("context.System.application.applicationId", process.env.APP_ID)
                            .set("request.intent.slots.DaySlot.resolutions.resolutionsPerAuthority",[{
                                status: {
                                    code: "ER_SUCCESS_MATCH"
                                },
                                values: [
                                    {
                                        value: {
                                            id: 1
                                        }
                                    }
                                ]
                            }])
        const response = await request.send();
        expect(spyGetTrashData).toHaveBeenCalled()
        expect(response.prompt()).toBe(`<speak>あした出せるゴミは、もえるゴミ、です。</speak>`);
        // supportedIntarfacesが無いのでdisplayは設定されない
        expect(response.display()).toBeUndefined();
    });
})

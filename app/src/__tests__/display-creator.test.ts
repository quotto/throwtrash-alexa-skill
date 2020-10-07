import {DisplayCreator} from "../display-creator"
const displayCreator = new DisplayCreator("ja-JP")
import * as _ from "lodash"

const templateDocument = require("../resource/display/apl_template_export.json")
const templateDataSources = require("../resource/display/datasources.json")

describe("getThrowTrashesDirective",()=>{
    it("single schedule",()=>{
        const displayDataItem = [{
            data: [
                {
                    type: "burn",
                    name: "燃えるごみ"
                }
            ],
            date: new Date(2020,9,5) //2020/10/05
        }]
        const resultDirective = displayCreator.getThrowTrashesDirective(0,displayDataItem)
        const expectDocument = _.cloneDeep(templateDocument)
        const expectDataSources = _.cloneDeep(templateDataSources)
        expectDataSources.dataSources.listTemplate2Metadata.title = "3日間のごみ出し予定"
        expectDataSources.dataSources.listTemplate2ListData.listPage.listItems = [
            {
                "listItemIdentifier": new String(displayDataItem[0].date),
                "textContent": {
                    "primaryText": {
                        "type": "PlainText",
                        "text": "2020/10/05(月曜日)"
                    },
                    "secondaryText": {
                        "type": "PlainText",
                        "text": "燃えるごみ"
                    },
                    "tertiaryText": {
                        "type": "PlainText",
                        "text": ""
                    }
                },
                "image": {
                    "contentDescription": null,
                    "smallSourceUrl": null,
                    "largeSourceUrl": null,
                    "sources": [{
                        url: "https://s3-ap-northeast-1.amazonaws.com/myskill-image/throwtrash/ja-JP/burn.png",
                        size: "small",
                        widthPixels: 0,
                        heightPixels: 0
                    }]
                },
                "token": "0"
            }
        ]
        const expectDirective = {
            type: "Alexa.Presentation.APL.RenderDocument",
            document: expectDocument.document,
            datasources: expectDataSources.dataSources
        }

        expect(JSON.stringify(resultDirective)).toBe(JSON.stringify(expectDirective))
    });
    it("multi schedule",()=>{
        const displayDataItem = [
            {
                data: [
                    {
                        type: "burn",
                        name: "燃えるごみ"
                    },
                ],
                date: new Date(2020, 9, 5) //2020/10/05
            },
            {
                data: [{
                    type: "plastic",
                    name: "プラスチック"
                },
                {
                    type: "other",
                    name: "生ゴミ"
                }],
                date: new Date(2020,9,6)
            },
            {
                data: [],
                date: new Date(2020,9,7)
            }
        ]
        const resultDirective = displayCreator.getThrowTrashesDirective(0,displayDataItem)
        const expectDocument = _.cloneDeep(templateDocument)
        const expectDataSources = _.cloneDeep(templateDataSources)
        expectDataSources.dataSources.listTemplate2Metadata.title = "3日間のごみ出し予定"
        expectDataSources.dataSources.listTemplate2ListData.listPage.listItems = [
            {
                "listItemIdentifier": new String(displayDataItem[0].date),
                "textContent": {
                    "primaryText": {
                        "type": "PlainText",
                        "text": "2020/10/05(月曜日)"
                    },
                    "secondaryText": {
                        "type": "PlainText",
                        "text": "燃えるごみ"
                    },
                    "tertiaryText": {
                        "type": "PlainText",
                        "text": ""
                    }
                },
                "image": {
                    "contentDescription": null,
                    "smallSourceUrl": null,
                    "largeSourceUrl": null,
                    "sources": [
                        {
                            url: "https://s3-ap-northeast-1.amazonaws.com/myskill-image/throwtrash/ja-JP/burn.png",
                            size: "small",
                            widthPixels: 0,
                            heightPixels: 0
                        }
                    ]
                },
                "token": "0"
            },
            {
                "listItemIdentifier": new String(displayDataItem[1].date),
                "textContent": {
                    "primaryText": {
                        "type": "PlainText",
                        "text": "2020/10/06(火曜日)"
                    },
                    "secondaryText": {
                        "type": "PlainText",
                        "text": "プラスチック/生ゴミ"
                    },
                    "tertiaryText": {
                        "type": "PlainText",
                        "text": ""
                    }
                },
                "image": {
                    "contentDescription": null,
                    "smallSourceUrl": null,
                    "largeSourceUrl": null,
                    "sources": [
                        {
                            url: "https://s3-ap-northeast-1.amazonaws.com/myskill-image/throwtrash/ja-JP/plastic.png",
                            size: "small",
                            widthPixels: 0,
                            heightPixels: 0
                        },
                        {
                            url: "https://s3-ap-northeast-1.amazonaws.com/myskill-image/throwtrash/ja-JP/other.png",
                            size: "small",
                            widthPixels: 0,
                            heightPixels: 0
                        }
                    ]
                },
                "token": "0"
            },
            {
                "listItemIdentifier": new String(displayDataItem[2].date),
                "textContent": {
                    "primaryText": {
                        "type": "PlainText",
                        "text": "2020/10/07(水曜日)"
                    },
                    "secondaryText": {
                        "type": "PlainText",
                        "text": "なし"
                    },
                    "tertiaryText": {
                        "type": "PlainText",
                        "text": ""
                    }
                },
                "image": {
                    "contentDescription": null,
                    "smallSourceUrl": null,
                    "largeSourceUrl": null,
                    "sources": []
                },
                "token": "0"
            }
        ]
        const expectDirective = {
            type: "Alexa.Presentation.APL.RenderDocument",
            document: expectDocument.document,
            datasources: expectDataSources.dataSources
        }

        expect(JSON.stringify(resultDirective)).toBe(JSON.stringify(expectDirective))
    })
})

describe("getShowScheduleDirective",()=>{
    it("single registered data",()=>{
        const trashData = [
           {
               type: "burn",
               typeText: "燃えるごみ",
               schedules: ["10月5日"]
           } 
        ]
        const resultDirective = displayCreator.getShowScheduleDirective(trashData)
        const expectDocument = _.cloneDeep(templateDocument)
        const expectDataSources = _.cloneDeep(templateDataSources)
        expectDataSources.dataSources.listTemplate2Metadata.title = "登録されているゴミ出し予定"
        expectDataSources.dataSources.listTemplate2ListData.totalNumberOfItems = 1
        expectDataSources.dataSources.listTemplate2ListData.listPage.listItems = [
            {
                "listItemIdentifier": "burn",
                "textContent": {
                    "primaryText": {
                        "type": "PlainText",
                        "text": "燃えるごみ"
                    },
                    "secondaryText": {
                        "type": "PlainText",
                        "text": "10月5日"
                    },
                    "tertiaryText": {
                        "type": "PlainText",
                        "text": ""
                    }
                },
                "image": {
                    "contentDescription": null,
                    "smallSourceUrl": null,
                    "largeSourceUrl": null,
                    "sources": [{
                        url: "https://s3-ap-northeast-1.amazonaws.com/myskill-image/throwtrash/ja-JP/burn.png",
                        size: "small",
                        widthPixels: 0,
                        heightPixels: 0
                    }]
                },
                "token": "burn"
            }
        ]
        const expectDirective = {
            type: "Alexa.Presentation.APL.RenderDocument",
            document: expectDocument.document,
            datasources: expectDataSources.dataSources
        }
        expect(JSON.stringify(resultDirective)).toBe(JSON.stringify(expectDirective))
    })
})
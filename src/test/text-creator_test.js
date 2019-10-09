const assert = require('assert');
const text_creatore = require('../common/text-creator.js');

describe('getDayFromTrashType', ()=>{
    const textCreator = new text_creatore('ja-JP');
    it('preset trash', ()=>{
        const dt = new Date('2019/08/09');
        const data = {
            burn:
            {
                schedules:
                    [{ type: 'weekday', value: '0' },
                    { type: 'weekday', value: '6' }],
                list: [dt, dt],
                recent: dt
            }
        };

        const response = textCreator.getDayFromTrashTypeMessage({ id: 'burn', name: 'もえるごみ' }, data);
        assert.equal(response, '次にもえるごみを出せるのは8月9日 金曜日です。')
    });
    it('other', ()=>{
        const dt1 = new Date('2019/08/09');
        const dt2 = new Date('2019/08/12');
        const data = {
            金属:
            {
                schedules:
                    [{ type: 'weekday', value: '0' },
                    { type: 'weekday', value: '6' }],
                list: [dt1, dt1],
                recent: dt1
            },
            洋服:
            {
                schedules:
                    [{ type: 'weekday', value: '0' },
                    { type: 'weekday', value: '6' }],
                list: [dt2, dt2],
                recent: dt2
            }
        };
        const response = textCreator.getDayFromTrashTypeMessage({id: 'other', name: 'その他'}, data);
        assert.equal(response, '次に金属を出せるのは8月9日 金曜日、洋服を出せるのは8月12日 月曜日です。')
    })
})

describe('getAllSchedule', () => {
    it('en-US', () => {
        const testdata =
            [
                {
                    // 曜日が一致し該当週のため対象
                    type: 'burn',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-09-09'
                            }
                        },
                        {
                            type: 'month',
                            value: '10'
                        }
                    ]
                },
                {
                    type: 'other',
                    trash_val: 'pokemon',
                    schedules: [
                        {
                            type: 'weekday',
                            value: '0'
                        },
                        {
                            type: 'biweek',
                            value: '5-2'
                        }
                    ]
                },
                {
                    type: 'plastic',
                    schedules: [
                        {
                            type: 'weekday',
                            value: '0'
                        }
                    ]
                },
                {
                    type: 'can',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-09-30'
                            }
                        }
                    ]
                },
                {
                    type: 'paper',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-09-16'
                            }
                        }
                    ]
                },
                {
                    type: 'bin',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-08-26'
                            }
                        }
                    ]
                },
                {
                    type: 'petbottle',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-08-26'
                            }
                        }
                    ]
                },
                {
                    type: 'coarse',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-08-26'
                            }
                        }
                    ]
                },
                {
                    type: 'unburn',
                    schedules: [
                        {
                            type: 'biweek',
                            value: '3-1'
                        },
                        {
                            type: 'biweek',
                            value: '3-3'
                        }
                    ]
                },
                {
                    type: 'resource',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-08-26'
                            }
                        }
                    ]
                }
            ];
        const textCreator = new text_creatore('en-US');
        const result = textCreator.getAllSchedule(testdata);
        assert.equal(result[0].typeText, 'burnable trash');
        assert.equal(result[0].schedules[0], 'every other Wednseday');
        assert.equal(result[0].schedules[1], '10th of every month');
        assert.equal(result[1].typeText, 'pokemon');
        assert.equal(result[1].schedules[0], 'every Sunday');
        assert.equal(result[1].schedules[1], '2nd Friday');
        assert.equal(result[2].typeText, 'plastic');
        assert.equal(result[3].typeText, 'can');
        assert.equal(result[4].typeText, 'paper');
        assert.equal(result[5].typeText, 'bottle');
        assert.equal(result[6].typeText, 'plastic bottle');
        assert.equal(result[7].typeText, 'oversized trash');
        assert.equal(result[8].typeText, 'unburnable trash');
        assert.equal(result[8].schedules[0], '1st Wednseday');
        assert.equal(result[8].schedules[1], '3rd Wednseday');
        assert.equal(result[9].typeText, 'recyclble trash');
    });


    it('js-JP', () => {
        const testdata =
            [
                {
                    // 曜日が一致し該当週のため対象
                    type: 'burn',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-09-09'
                            }
                        },
                        {
                            type: 'month',
                            value: '10'
                        }
                    ]
                },
                {
                    type: 'other',
                    trash_val: '新運',
                    schedules: [
                        {
                            type: 'weekday',
                            value: '0'
                        },
                        {
                            type: 'biweek',
                            value: '5-2'
                        }
                    ]
                },
                {
                    type: 'plastic',
                    schedules: [
                        {
                            type: 'weekday',
                            value: '0'
                        }
                    ]
                },
                {
                    type: 'can',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-09-30'
                            }
                        }
                    ]
                },
                {
                    type: 'paper',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-09-16'
                            }
                        }
                    ]
                },
                {
                    type: 'bin',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-08-26'
                            }
                        }
                    ]
                },
                {
                    type: 'petbottle',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-08-26'
                            }
                        }
                    ]
                },
                {
                    type: 'coarse',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-08-26'
                            }
                        }
                    ]
                },
                {
                    type: 'unburn',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-08-26'
                            }
                        }
                    ]
                },
                {
                    type: 'resource',
                    schedules: [
                        {
                            type: 'evweek',
                            value: {
                                weekday: '3',
                                start: '2018-08-26'
                            }
                        }
                    ]
                }
            ];
        const textCreator = new text_creatore('ja-JP');
        const result = textCreator.getAllSchedule(testdata);
        assert.equal(result[0].typeText, 'もえるゴミ');
        assert.equal(result[0].schedules[0], '隔週水曜日');
        assert.equal(result[0].schedules[1], '毎月10日');
        assert.equal(result[1].typeText, '新運');
        assert.equal(result[1].schedules[0], '毎週日曜日');
        assert.equal(result[1].schedules[1], '第2金曜日');
        assert.equal(result[2].typeText, 'プラスチック');
        assert.equal(result[3].typeText, 'カン');
        assert.equal(result[4].typeText, '古紙');
        assert.equal(result[5].typeText, 'ビン');
        assert.equal(result[6].typeText, 'ペットボトル');
        assert.equal(result[7].typeText, '粗大ゴミ');
        assert.equal(result[8].typeText, 'もえないゴミ');
        assert.equal(result[9].typeText, '資源ゴミ');
    });
});

describe('getRegisterdContentForCard', ()=>{
    it('multiple line', ()=>{
        const test_data = [
            {typeText: 'もえるごみ', schedules: ['毎週水曜日', '第3土曜日']},
            {typeText: 'カン', schedules: ['毎月4日']}
        ];

        const textCreator = new text_creatore('ja-JP');
        const message = textCreator.getRegisterdContentForCard(test_data);
        assert.equal(message, 'もえるごみ: 毎週水曜日、第3土曜日\nカン: 毎月4日\n');
    })
})
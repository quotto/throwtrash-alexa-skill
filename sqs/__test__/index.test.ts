import {handler} from '../index';
import AWS from 'aws-sdk';
AWS.config.credentials = new AWS.SharedIniFileCredentials({profile: 'local_tester'});
process.env.DB_REGION='ap-northeast-1';
describe('SQSトリガーによるLambda',()=>{
    it('正常データの受信',async()=>{
        await handler({Records:[{
            messageId: 'id001',
            receiptHandle: '',
            attributes: {
                ApproximateFirstReceiveTimestamp: '99999999',
                SenderId: '001',
                SentTimestamp: '99999999999',
                ApproximateReceiveCount: '1',
            },
            messageAttributes: {
                
            },
            md5OfBody: '11111',
            eventSource: '',
            awsRegion: 'ap-northeast-1',
            eventSourceARN: '',
            body: JSON.stringify({
                user_id: 'id001',
                zipcode: '9818003',
                address: '宮城県仙台市泉区南光台',
                trash_data: [
                    {
                        type: 'burn',
                        trash_val: '',
                        schedules: [{
                            type: 'weekday',
                            value: '0'
                        }],
                    }
                ]
            })
        }]
        },{
            awsRequestId: '',
            callbackWaitsForEmptyEventLoop: false,
            functionName: '',
            functionVersion: '',
            invokedFunctionArn: '',
            logGroupName: '',
            logStreamName: '',
            memoryLimitInMB: '12',
            getRemainingTimeInMillis: ()=>1000 ,
            done: ()=>{},
            fail: ()=>{},
            succeed: ()=>{}
        },()=>{});
    })
})
import { AWSOptions } from 'request';
import {client, TrashData, TrashSchedule} from 'trash-common'
import {DynamoDB} from 'aws-sdk'
const dynamoClient: DynamoDB.DocumentClient  = new DynamoDB.DocumentClient({region: process.env.APP_REGION});
import crypto = require("crypto")

export class DynamoDBAdapter implements client.DBAdapter{
    getUserIDByAccessToken(access_token: string): Promise<string> {
            const hashkey = crypto.createHash("sha512").update(access_token).digest("hex")
            return dynamoClient.get({
                TableName: "throwtrash-backend-accesstoken",
                Key: {
                    access_token: hashkey
                }
            }).promise().then((data: DynamoDB.DocumentClient.GetItemOutput)=>{
                if(data.Item) {
                    const currentTime = Math.ceil(Date.now() / 1000);
                    if(data.Item.expires_in > currentTime) {
                        return data.Item.user_id
                    } else {
                        console.error(`AccessToken is expired -> accesstoken=${access_token},expire=${data.Item.expires_in}`);
                    }
                }
                console.error(`AccessToken is not found -> accesstoken=${access_token}`)
                // IDが見つからない場合はブランクを返す
                return "";
            }).catch((err:Error)=>{
                console.error(err);
                throw new Error("Failed getUserIDByAccessToken");
            })
    }
    getTrashSchedule(user_id: string): Promise<TrashSchedule> {
        const params = {
            TableName: 'TrashSchedule',
            Key: {
                id: user_id
            }
        };
        return dynamoClient.get(params).promise().then((data: DynamoDB.DocumentClient.GetItemOutput) => {
            if (data.Item) {
                const checkedNextday = typeof(data.Item.nextdayflag) != "undefined" ? data.Item.nextdayflag : true;
                return {
                    trashData: JSON.parse(data.Item.description),
                    checkedNextday: checkedNextday
                }
            }
            console.error(`User Not Found(AccessToken: ${user_id})`);
            return {
                trashData: [],
                checkedNextday: false
            }
        }).catch((err: Error) => {
            console.error(err)
            throw new Error("Failed GetTrashSchedule")
        })
    }

}
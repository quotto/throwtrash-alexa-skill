"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoDBAdapter = void 0;
const aws_sdk_1 = require("aws-sdk");
const dynamoClient = new aws_sdk_1.DynamoDB.DocumentClient({ region: process.env.APP_REGION });
const crypto = require("crypto");
class DynamoDBAdapter {
    getUserIDByAccessToken(access_token) {
        const hashkey = crypto.createHash("sha512").update(access_token).digest("hex");
        return dynamoClient.get({
            TableName: "throwtrash-backend-accesstoken",
            Key: {
                accesstoken: access_token
            }
        }).promise().then((data) => {
            if (data.Item) {
                const currentTime = Math.ceil(Date.now() / 1000);
                if (data.Item.expires_in > currentTime) {
                    return data.Item.user_id;
                }
                else {
                    console.error(`AccessToken is expired -> accesstoken=${access_token},expire=${data.Item.expires_in}`);
                }
            }
            console.error(`AccessToken is not found -> accesstoken=${access_token}`);
            // IDが見つからない場合はブランクを返す
            return "";
        }).catch((err) => {
            console.error(err);
            throw new Error("Failed getUserIDByAccessToken");
        });
    }
    getTrashSchedule(user_id) {
        const params = {
            TableName: 'TrashSchedule',
            Key: {
                id: user_id
            }
        };
        return dynamoClient.get(params).promise().then((data) => {
            if (data.Item) {
                return JSON.parse(data.Item.description);
            }
            console.error(`User Not Found(AccessToken: ${user_id})`);
            return [];
        }).catch((err) => {
            console.error(err);
            throw new Error("Failed GetTrashSchedule");
        });
    }
}
exports.DynamoDBAdapter = DynamoDBAdapter;

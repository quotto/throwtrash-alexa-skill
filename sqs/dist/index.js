"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_sdk_1 = require("aws-sdk");
const documentClient = new aws_sdk_1.DynamoDB.DocumentClient();
const table_suffix = process.env.STAGE ? process.env.STAGE : '';
const handler = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const table_name = 'throwtrash-address-collection' + table_suffix ? `-${table_suffix}` : '';
    const record_params = [];
    event.Records.forEach(record => {
        const data = JSON.parse(record.body);
        record_params.push({
            PutRequest: {
                Item: {
                    user_id: {
                        S: data.user_id,
                    },
                    zipcode: {
                        S: data.zipcode,
                    },
                    address: {
                        S: data.address,
                    },
                    trashdata: {
                        S: JSON.stringify(data.trash_data)
                    },
                    updated_at: {
                        N: Date.now().toString()
                    }
                }
            }
        });
    });
    const request_items = {
        [table_name]: record_params
    };
    yield documentClient.batchWrite({
        RequestItems: request_items
    }).promise().then(result => {
        console.log(result);
    }).catch(error => {
        console.error(error);
    });
});
exports.handler = handler;

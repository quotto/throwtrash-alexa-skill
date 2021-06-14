import { TrashData } from 'trash-common';
import { AWSError, DynamoDB } from 'aws-sdk';
import { SQSEvent, SQSHandler} from 'aws-lambda';
import { UpdateItemOutput, WriteRequest } from 'aws-sdk/clients/dynamodb';
import { PromiseResult } from 'aws-sdk/lib/request';
const dynamoDB = new DynamoDB({
    region: process.env.DB_REGION
});
const documentClient = new DynamoDB.DocumentClient({
    region: process.env.DB_REGION
});
const table_suffix = process.env.STAGE? process.env.STAGE : '';

interface AddressData  {
    user_id: string,
    zipcode: string,
    address: string,
    trash_data: TrashData[]
}

export const handler:SQSHandler = async (event: SQSEvent)=> {
    const trash_schedule_table: string ='TrashSchedule'+ (table_suffix.length>0? `-${table_suffix}` : '');
    const address_collection_table: string = 'throwtrash-address-collection' + (table_suffix.length>0? `-${table_suffix}` : '');


    const address_record_params: WriteRequest[] = [];
    const update_list: Array<Promise<PromiseResult<UpdateItemOutput,AWSError>>> = [];
    event.Records.forEach(record=>{
        const data: AddressData = JSON.parse(record.body);
        console.log(data);
        update_list.push(documentClient.update({
            TableName: trash_schedule_table,
            Key: {
                'user_id': data.user_id,
            },
            UpdateExpression:'set zipcode=:zipcode,address=:address,updated_at=:updated_at',
            ExpressionAttributeValues: {
                ':zipcode': data.zipcode,
                ':address': data.address,
                ':updated_at': Date.now().toString()
            }
        }).promise()),
        address_record_params.push(
            {
                PutRequest: {
                    Item: {
                        zipcode: {
                            S: data.zipcode,
                        },
                        address: {
                            S: data.address.toString(),
                        },
                        updated_at: {
                            N: Date.now().toString()
                        }
                    }
                }
            }
        );
    })

    const request_items ={
        [address_collection_table]: address_record_params
    };
    console.log(JSON.stringify(request_items));
    await Promise.all(update_list).catch(error=>{
        console.error(error);
    })
    await dynamoDB.batchWriteItem({
        RequestItems: request_items
    }).promise().then(result=>{
        console.log(result);
    }).catch(error=>{
        console.error(error);
    });
}

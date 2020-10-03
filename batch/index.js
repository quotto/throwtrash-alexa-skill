const aws = require('aws-sdk');
const fs = require('fs');
const crypto = require("crypto");

aws.config.update({
    region: process.env.AWS_DEFAULT_REGION
});
const documentClient = new aws.DynamoDB.DocumentClient();

exports.convert_infinity_token=async() => {
    await documentClient.scan({
        TableName: "TrashSchedule"
    }).promise().then(data=>{
        const total = data.Items.length;
        console.log(`total: ${total}`);
        let count = 1;
        data.Items.forEach(async(item)=>{
            if(count % 100 === 0) {
                console.log(`now: ${count}`);
            }
            const hash = crypto.createHash("sha512").update(item.id).digest("hex");
            await documentClient.put({
                TableName: "throwtrash-backend-accesstoken",
                Item: {
                    access_token: hash,
                    user_id: item.id
                }
            }).promise().then((_)=>{
            }).catch(err=>{
                console.log(err);
            });

        })
    }).catch(err=>{
        console.log(err);
    })
}

exports.scan_data_contains_other=async()=> {
    const params = {
        TableName: 'TrashSchedule',
        ProjectionExpression: '#description',
        FilterExpression: 'contains (#description,:other)',
        ExpressionAttributeNames: {
            '#description': 'description'
        },
        ExpressionAttributeValues: {
            ':other': 'other'
        }
    };

    const writer = fs.createWriteStream('wordlist.csv', 'utf-8');
    return documentClient.scan(params).promise().then(data => {
        const scanlist = [];
        const total = data.Items.length;
        console.log("total:"+total)
        let count = 1;
        data.Items.forEach(item=>{
            if(count % 10 === 0) {
                console.log("now:"+count);
            }
            const target = JSON.parse(item.description);
            target.forEach(trash=>{
                if(trash.type === 'other') {
                    writer.write(`${trash.trash_val},,,10,名詞,固有名詞,一般,*,*,*,,,`+'\n');
                    scanlist.push(trash.trash_val);
                }
            });
                count++;
        });
        return scanlist;
    }).catch(err=>{
        console.log(err);
        return err;
    });
}

exports.set_evweek_interval=async()=>{
    const params = {
        TableName: 'TrashSchedule',
        ProjectionExpression: 'id,#description',
        FilterExpression: 'contains (#description,:evweek)',
        ExpressionAttributeNames: {
            '#description': 'description'
        },
        ExpressionAttributeValues: {
            ':evweek': 'evweek'
        }
    };
    return documentClient.scan(params).promise().then(data => {
        const scanlist = [];
        const total = data.Items.length;
        console.log("total:"+total)
        let count = 0;
        data.Items.forEach(async(item)=>{
            const target = JSON.parse(item.description);
            target.forEach(trash=>{
                trash.schedules.forEach(schedule=>{
                    if(schedule.type==="evweek" && !schedule.value.interval) {
                        schedule.value.interval=2;
                    }
                });
            });
            await documentClient.update({
                TableName: "TrashSchedule",
                Key: {
                    id:item.id
                },
                UpdateExpression: "set #description = :description",
                ExpressionAttributeNames: {"#description": "description"},
                ExpressionAttributeValues: {
                    ":description": JSON.stringify(target)
                }
            }).promise().catch(err=>{
                console.log(err)
            })
            count++;
            if(count % 100 === 0) {
                console.log(`now: ${count}`);
            }
        });
        return scanlist;
    }).catch(err=>{
        console.log(err);
        return err;
    });
}

const main = async()=> {
    const action = process.argv[2];
    if(action === "wordlist") {
        console.log("wordlist start");
        await this.scan_data_contains_other();
        console.log("finish");
    } else if(action === "convert_token") {
        console.log("convert_token start");
        await this.convert_infinity_token();
        console.log("finish");
    } else if(action === "set-evweek-interval") {
        console.log("set evweek interval start");
        await this.set_evweek_interval();
        console.log("finish");
    }
}

main();
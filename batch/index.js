const aws = require('aws-sdk');
const fs = require('fs');

aws.config.update({
    region: process.env.AWS_DEFAULT_REGION
});
const dynamoCLient = new aws.DynamoDB.DocumentClient();

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

exports.scan_data_contains_other=async()=> {
    const writer = fs.createWriteStream('wordlist.csv', 'utf-8');
    return dynamoCLient.scan(params).promise().then(data => {
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

exports.scan_data_contains_other().then(data=>{
    console.log('registered data:')
    console.log(data);
    console.log('finished.')
}).catch(err=>{
    console.log(err);
});
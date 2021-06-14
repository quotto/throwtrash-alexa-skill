
import rp from 'request-promise';
import { getLogger } from 'trash-common';
const logger = getLogger();
import {AddressProcessor,AddressInfo} from './address-processor';
import {TrashData} from 'trash-common';
import {SQS} from 'aws-sdk';
class AddressProcessorImpl implements AddressProcessor {
    
    async sendZipCodeAndAddress(user_id: string, zipcode: string, address: string): Promise<void> {
        const results = await this.getAdressByZipCode(zipcode);
        let saved_address = '';
        const is_match = results.some(result=>{
            const joined_address = result.address1+result.address2+result.address3;
            if(address.indexOf(joined_address)>=0) {
                saved_address = joined_address;
                return true;
            }
            return false;
        })

        if(is_match) {
            // SQSにメッセージ送信
            const sqs = new SQS({region: 'ap-northeast-1'});
            const params: SQS.SendMessageRequest = {
                MessageBody: JSON.stringify({
                    user_id: user_id,
                    zipcode: zipcode,
                    address: saved_address,
                }),
                QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/188970983837/throwtrash-saving-address-and-data'
            }
            await sqs.sendMessage(params).promise().then(result=>{
                console.log(result);
            }).catch(error=>console.error(error));
        }
    }

    async getAdressByZipCode(zipCode: string): Promise<AddressInfo[]> {
        const API_URL='https://zipcloud.ibsnet.co.jp/api/search';
        const option = {
            uri: API_URL,
            qs: {
                zipcode: zipCode
            },
            json: true
        };
        return rp(option).then((response: any) => {
            // 住所検索APIでは郵便番号に該当する住所がない場合にはresultsがnullになる
            if(response.status === 200 && response.results != null) {
                return response.results;
            }
            return [];
        }).catch(error => {
            logger.error(error);
            return [];
        });
    }
}

export default AddressProcessorImpl;
import AWS from 'aws-sdk';
AWS.config.credentials = new AWS.SharedIniFileCredentials({profile: 'local_tester'});
import AddressProcessorImpl from '../address-processor-impl';
import {AddressProcessor} from '../address-processor';
const address_processor_impl: AddressProcessor = new AddressProcessorImpl();

describe('SQSのテスト',()=>{
    it('正常な送信',async ()=>{
        await address_processor_impl.sendZipCodeAndAddress('test-access-token','9818003','宮城県仙台市泉区南光台7丁目16-18')
        expect(true);
    });
});
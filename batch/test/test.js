const index = require('../index');
const assert = require('assert');

describe('scan_all_data',()=>{
    it('scan_all_data',async()=>{
        try {
            const scan_list = await index.scan_data_contains_other();
            assert(scan_list.length > 0);
        } catch(err) {
           assert(false,'reject invoke') ;
        }
    })
})
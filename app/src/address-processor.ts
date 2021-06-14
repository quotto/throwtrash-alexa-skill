import {TrashData} from 'trash-common';

export interface AddressProcessor {
    sendZipCodeAndAddress(user_id: string, zipcode: string, address: string ): Promise<void>;
}

export interface AddressInfo {
    zipcode: string,
    prefcode: number,
    address1: string,
    address2: string,
    address3: string,
    kana1: string,
    kana2: string,
    kana3: string
}

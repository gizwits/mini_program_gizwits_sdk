"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const md5 = require("./md5");
const AES = require("./aes");
const getRandomCodes = ({ SSID, password, pks }) => {
    const randomCodes = [];
    pks.map(item => {
        const code = getRandomCode({
            SSID,
            password,
            pk: item
        });
        randomCodes.push(code);
    });
    return randomCodes;
};
const pcks7padding = (key) => {
    return key;
};
const getRandomCode = ({ SSID, password, pk }) => {
    const md5str = md5.hex(SSID + password);
    let key = [];
    for (let i = 0; i < md5str.length; i = i + 2) {
        key.push(parseInt(md5str[i] + md5str[i + 1], 16));
    }
    key = pcks7padding(key);
    const text = pk;
    const textBytes = AES.utils.utf8.toBytes(text);
    const aesEcb = new AES.ModeOfOperation.ecb(key);
    const encryptedBytes = aesEcb.encrypt(textBytes);
    const md5Str = md5.hex(encryptedBytes);
    return md5Str;
};
exports.default = getRandomCodes;

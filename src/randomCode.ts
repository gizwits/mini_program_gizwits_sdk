import * as md5 from 'js-md5';
import * as AES from 'aes-js';


interface IGetRandomCodes {
  SSID: string;
  password: string;
  pks: string[];
}

interface IGetRandomCode {
  SSID: string;
  password: string;
  pk: string;
}

const getRandomCodes = ({ SSID, password, pks }: IGetRandomCodes): string[] => {
  const randomCodes: string[] = [];
  pks.map(item => {
    const code = getRandomCode({
      SSID,
      password,
      pk: item
    });
    randomCodes.push(code);
  })
  return randomCodes;
}

const pcks7padding = (key: number[]) => {
  return key;
}

const getRandomCode = ({ SSID, password, pk }: IGetRandomCode): string => {
  const md5str = md5.hex(SSID + password);
  let key: number[] = [];
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
}

// console.log(getRandomCodes({ SSID: '渣渣', password: '12345678', pks: ['af9c220080a04c568086407448ea36a1'] }));

export default getRandomCodes;
import sleep from "./sleep";

interface IBluetoothAdapterStateResult {
  discovering: boolean;
  available: boolean;
}

interface IWechatResult {
  errMsg: string;
  errCode: number;
}

export function openBluetoothAdapter() {
  return new Promise<IWechatResult>((res, rej) => {
    wx.openBluetoothAdapter({
      success: res,
      fail: rej,
    })
  })
}

export function getBluetoothAdapterState() {
  return new Promise<IBluetoothAdapterStateResult>((res, rej) => {
    wx.getBluetoothAdapterState({
      success: res,
      fail: rej,
    })
  })
}

export function startBluetoothDevicesDiscovery() {
  return new Promise<IWechatResult>((res, rej) => {
    wx.startBluetoothDevicesDiscovery({
      success: res,
      fail: rej,
      interval: 100
    })
  })
}

export function getBluetoothDevices() {
  return new Promise<WechatMiniprogram.BlueToothDevice[]>((res, rej) => {
    wx.getBluetoothDevices({
      success: (({ devices }) => res(devices)),
      fail: rej,
    })
  })
}

export function createBLEConnection(deviceId: string, timeout: number) {
  return new Promise<IWechatResult>((res, rej) => {
    wx.createBLEConnection({
      deviceId,
      timeout,
      success: (r => res(r as IWechatResult)),
      fail: ((err) => {
        if (err.errCode === -1) {
          res(err);
        } else {
          rej(err);
        }
      }),
    })
  })
}

interface IBLEService {
  uuid: string;
  isPrimary: boolean;
}

export function getBLEDeviceServices(deviceId: string) {
  return new Promise<IBLEService[]>((res, rej) => {
    wx.getBLEDeviceServices({
      deviceId,
      success: (({ services }) => res(services)),
      fail: rej,
    })
  })
}

interface IBLECharacteristic {
  uuid: string;
  properties: {
    read: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
  }
}

export function getBLEDeviceCharacteristics(deviceId: string, serviceId: string) {
  return new Promise<IBLECharacteristic[]>((res, rej) => {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (({ characteristics }) => res(characteristics)),
      fail: rej,
    })
  })
}

export function notifyBLECharacteristicValueChange(
  deviceId: string,
  serviceId: string,
  characteristicId: string,
  state: boolean = true
) {
  return new Promise<IWechatResult>((res, rej) => {
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId,
      characteristicId,
      state,
      success: res,
      fail: rej,
    })
  })
}

export function writeBLECharacteristicValue(
  deviceId: string,
  serviceId: string,
  characteristicId: string,
  value: ArrayBuffer,
) {
  return new Promise<IWechatResult>((res) => {
    console.log('writeBLECharacteristicValue')
    wx.writeBLECharacteristicValue({
      deviceId,
      serviceId,
      characteristicId,
      value,
      complete: res,
    })
  })
}

export function unpackWriteBLECharacteristicValue(
  deviceId: string,
  serviceId: string,
  characteristicId: string,
  value: ArrayBuffer,
) {
  if (value.byteLength === 0) {
    throw new Error('value is not empty');
  }
  return new Promise<IWechatResult>(async (res, rej) => {
    let pos = 0;
    let bytes = value.byteLength;
    let writeRes;
    while (bytes > 0) {
      await sleep(30);
      const tmpBuffer = value.slice(pos, pos + 20);
      pos += 20;
      bytes -= 20;
      writeRes = await writeBLECharacteristicValue(
        deviceId,
        serviceId,
        characteristicId,
        tmpBuffer,
      );
      console.log('unpackWriteBLECharacteristicValue', pos / 20, writeRes);
      if (writeRes.errCode !== 0) {
        break;
      }
    }
    writeRes.errCode !== 0 ? rej(writeRes) : res(writeRes);
  })
}

import { expect } from 'chai';
import 'miniprogram-api-typings';

import 'mocha';

import * as wechatApi from '../src/wechatApi';

declare namespace global {
  const wx: any;
}

describe('wechatApi', function () {

  it('getBluetoothAdapterState', () => {
    const p = wechatApi.getBluetoothAdapterState();
    expect(p instanceof Promise).to.be.true;
  })

  it('getBluetoothDevices', (done) => {
    global.wx.getBluetoothDevices.success = { devices: [] };
    wechatApi.getBluetoothDevices().then((devices) => {
      expect(devices.length).to.be.equal(0);
      done();
    });
  })

  it('getBLEDeviceServices', (done) => {
    global.wx.getBLEDeviceServices.success = { services: [] };
    wechatApi.getBLEDeviceServices('123').then((services) => {
      expect(services.length).to.be.equal(0);
      done();
    });
  })

  it('getBLEDeviceCharacteristics', (done) => {
    global.wx.getBLEDeviceCharacteristics.success = { characteristics: [] };
    wechatApi.getBLEDeviceCharacteristics('123', '123').then((characteristics) => {
      expect(characteristics.length).to.be.equal(0);
      done();
    });
  })



  it('createBLEConnection', () => {
    const p = wechatApi.createBLEConnection('123', 2000);
    expect(p instanceof Promise).to.be.true;
  })

  it('createBLEConnection success', (done) => {
    global.wx.createBLEConnection.success = { errCode: 0 };
    wechatApi.createBLEConnection('123', 200).then((err) => {
      expect(err.errCode).to.be.equal(0);
      done();
    });
  })
  it('createBLEConnection connected', (done) => {
    global.wx.createBLEConnection.success = null
    global.wx.createBLEConnection.fail = { errCode: -1 };
    wechatApi.createBLEConnection('123', 200).then((err) => {
      expect(err.errCode).to.be.equal(-1);
      done();
    });
  })
  it('createBLEConnection fail', (done) => {
    global.wx.createBLEConnection.success = null
    global.wx.createBLEConnection.fail = { errCode: 1000 };
    wechatApi.createBLEConnection('123', 200).catch((err) => {
      expect(err.errCode).to.be.equal(1000);
      done();
    });
  })

  it('notifyBLECharacteristicValueChange', () => {
    const p = wechatApi.notifyBLECharacteristicValueChange('123', '123', '123');
    expect(p instanceof Promise).to.be.true;
  })

  it('writeBLECharacteristicValue', () => {
    const p = wechatApi.writeBLECharacteristicValue('123', '2000', '123', new Uint8Array(16));
    expect(p instanceof Promise).to.be.true;
  })

  it('unpackWriteBLECharacteristicValue', (done) => {
    global.wx.writeBLECharacteristicValue.callCount = 0;
    global.wx.writeBLECharacteristicValue.complete = { errCode: 0 };
    const buffer = new Uint8Array(81);
    wechatApi.unpackWriteBLECharacteristicValue('123', '123', '123', buffer).then(() => {
      expect(global.wx.writeBLECharacteristicValue.callCount).to.be.equal(5);
      done();
    });
  })

  it('unpackWriteBLECharacteristicValue buffer byteLength equal 0', () => {
    const buffer = new Uint8Array(0);
    expect(() => wechatApi.unpackWriteBLECharacteristicValue('123', '123', '123', buffer)).to.throw();
  })
});
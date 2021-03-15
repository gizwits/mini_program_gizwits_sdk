import { assert } from 'chai';
import GizwitsSdk, { errorCode } from '../index';

import 'mocha';

const sinon = require('sinon');

import * as wechatApi from '../src/wechatApi';
import { sendBLEConfigCmd } from '../src/ble';

declare namespace global {
  const wx: any;
}


describe('SDK ble', function () {
  describe('SDK ble init', function () {
    let sdk = new GizwitsSdk({
      appID: '8f187b1deb9e44b6aa1374b8f13bccb1',
      appSecret: 'd73fa6d6d7c04d37b6b2cc13a18a9f37',
      specialProductKeys: ['00e7e327afa74a3d8ff1cc190bad78c0'],
      specialProductKeySecrets: ['aa3d301fa291466fbed20e4204609abc'],
      token: 'token',
      uid: 'uid',
      cloudServiceInfo: null,
    });

    sdk = new GizwitsSdk({
      appID: '8f187b1deb9e44b6aa1374b8f13bccb1',
      appSecret: 'd73fa6d6d7c04d37b6b2cc13a18a9f37',
      specialProductKeys: ['00e7e327afa74a3d8ff1cc190bad78c0'],
      specialProductKeySecrets: ['aa3d301fa291466fbed20e4204609abc'],
      token: 'token',
      uid: 'uid',
      cloudServiceInfo: {
        openAPIInfo: 'api.gizwits.com',
      },
    });

    let stub;
    let wxCloseBLEConnectionStub;

    beforeEach(() => {
      stub = sinon.stub(wechatApi);
      wxCloseBLEConnectionStub = sinon.stub(wx, 'closeBLEConnection').returns(Promise.resolve({ errCode: 0 }));
    });

    afterEach(() => {
      if (stub) {
        Object.keys(stub).forEach((key) => {
          stub[key].restore && stub[key].restore();
        });
      }
      wxCloseBLEConnectionStub && wxCloseBLEConnectionStub.restore();
    });

    // 超时测试
    it('should config timeout', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([]));
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 1,
        });
      } catch (error) {
        const isOk = (error as any).err.errorCode === errorCode.TIME_OUT;
        assert.ok(isOk);
      }
    });

    it('ble state error', async function () {
      stub.getBluetoothAdapterState.returns(Promise.reject({
        errCode: 10000,
        errMsg: 'not init',
      }));
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.WECHAT_ERROR);
      }
    });

    it('ble state not available', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: false,
      }));
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });

    it('get ble devices error', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.reject({
        errCode: 10000,
        errMsg: 'not init',
      }))
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.WECHAT_ERROR);
      }
    });

    it('connect ble device fail', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 10000,
        errMsg: 'not init',
      }))
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });

    it('get ble services fail', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.reject({
        errCode: 10000,
        errMsg: 'not init'
      }))
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });

    it('get ble services uuid error', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'abf0d',
      }]))
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });
    it('get ble characteristic fail', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.reject({
        errCode: 10000,
        errMsg: 'not init'
      }))
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });
    it('get ble characteristic uuid error', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.resolve([{
        uuid: 'abf7ddd',
      }]));
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });
    it('get ble characteristic not suport notify', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.resolve([{
        uuid: 'abf7',
        properties: { notify: false, indicate: false }
      }]));
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        console.log(error)
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });

    it('startup ble haracteristic value change notify fail', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.resolve([{
        uuid: 'abf7',
        properties: { notify: true, indicate: true }
      }]));
      stub.notifyBLECharacteristicValueChange.returns(Promise.reject({
        errCode: 1000
      }));
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });
    it('write ble haracteristic value fail', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.resolve([{
        uuid: 'abf7',
        properties: { notify: true, indicate: true }
      }]));
      stub.notifyBLECharacteristicValueChange.returns(Promise.resolve({
        errCode: 0
      }));
      stub.unpackWriteBLECharacteristicValue.returns(Promise.reject({
        errCode: 1000
      }));
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });
    it('write ble haracteristic value fail', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.resolve([{
        uuid: 'abf7',
        properties: { notify: true, indicate: true }
      }]));
      stub.notifyBLECharacteristicValueChange.returns(Promise.resolve({
        errCode: 0
      }));
      stub.unpackWriteBLECharacteristicValue.restore();
      global.wx.writeBLECharacteristicValue.complete = { errCode: 1000 };
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });
    it('config ble device success', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.resolve([{
        uuid: 'abf7',
        properties: { notify: true, indicate: true }
      }]));
      stub.notifyBLECharacteristicValueChange.returns(Promise.resolve({
        errCode: 0
      }));
      stub.unpackWriteBLECharacteristicValue.returns(Promise.resolve({
        errCode: 0
      }));
      setTimeout(() => {
        if (global.wx.onBLECharacteristicValueChange.callback) {
          global.wx.onBLECharacteristicValueChange.callback({
            value: new Uint8Array([0, 171, 247])
          })
        }
      }, 1000)
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.BLE_ERROR);
      }
    });
    it('config ble device success but not bind', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.resolve([{
        uuid: 'abf7',
        properties: { notify: true, indicate: true }
      }]));
      stub.notifyBLECharacteristicValueChange.returns(Promise.resolve({
        errCode: 0
      }));
      stub.unpackWriteBLECharacteristicValue.returns(Promise.resolve({
        errCode: 0
      }));
      setTimeout(() => {
        if (global.wx.onBLECharacteristicValueChange.callback) {
          global.wx.onBLECharacteristicValueChange.callback({
            value: new Uint8Array([0, 171, 247])
          })
        }
      }, 1000)
      const res = await sdk.setBLEDeviceOnboardingDeploy({
        ssid: 'SSID',
        password: 'password',
        timeout: 5,
        isBind: false,
      });
    });

    it('should randomCode token error', async function () {
      global.wx.requestErr = null;
      global.wx.randomCodeResult = {
        data: {
          error_code: '9004',
        }
      };

      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.resolve([{
        uuid: 'abf7',
        properties: { notify: true, indicate: true }
      }]));
      stub.notifyBLECharacteristicValueChange.returns(Promise.resolve({
        errCode: 0
      }));
      stub.unpackWriteBLECharacteristicValue.returns(Promise.resolve({
        errCode: 0
      }));
      setTimeout(() => {
        if (global.wx.onBLECharacteristicValueChange.callback) {
          global.wx.onBLECharacteristicValueChange.callback({
            value: new Uint8Array([0, 171, 247])
          })
        }
      }, 1000)
      try {
        await sdk.setBLEDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
          isBind: false,
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.API_ERROR);
      }
    });
    it('sendBLEConfigCmd timeout', async function () {
      stub.getBluetoothAdapterState.returns(Promise.resolve({
        available: true,
      }));
      stub.getBluetoothDevices.returns(Promise.resolve([
        { deviceId: '123' }
      ]))
      stub.createBLEConnection.returns(Promise.resolve({
        errCode: 0,
      }))
      stub.getBLEDeviceServices.returns(Promise.resolve([{
        uuid: 'ddabf0',
      }]))
      stub.getBLEDeviceCharacteristics.returns(Promise.resolve([{
        uuid: 'abf7',
        properties: { notify: true, indicate: true }
      }]));
      stub.notifyBLECharacteristicValueChange.returns(Promise.resolve({
        errCode: 0
      }));
      stub.unpackWriteBLECharacteristicValue.returns(Promise.resolve({
        errCode: 0
      }));
      setTimeout(() => {
        if (global.wx.onBLECharacteristicValueChange.callback) {
          global.wx.onBLECharacteristicValueChange.callback({
            value: new Uint8Array([0, 171, 247])
          })
        }
      }, 1500)
      const success = await sendBLEConfigCmd({
        bleDeviceId: '123',
        timeout: 1000,
        serviceUUIDSuffix: '',
        characteristicUUIDSuffix: '',
        arryBuffer: new Uint8Array(),
      });
      assert.ok(!success)
    });


  });
});
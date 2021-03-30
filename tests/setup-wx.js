const defaultBindingsResult = {
  data: {
    devices: [
      { mac: '123', did: '123', host: 'm2m.gizwits.com', wss_port: 2000 },
      { mac: '1231', did: '1231', host: 'm2m.gizwits.com', wss_port: 2000 },
      { mac: '1234', did: '1234', host: 'stage.gizwits.com', wss_port: 2000 }
    ]
  },
  code: 200
};

global.wx = {
  baseMDNS: {
    serviceType: '_local._udp',
    serviceName: '_local._udp',
    ip: '127.0.0.1',
    port: '4000',
  },
  localServiceFoundHandle: null,
  onLocalServiceFound: (func) => {
    global.wx.localServiceFoundHandle = func;
  },
  stopLocalServiceDiscovery: (data) => {
    if (data && data.complete) {
      data.complete();
    }
  },
  startLocalServiceDiscoverySuccessHandle: null,
  startLocalServiceDiscoveryFailHandle: null,
  startLocalServiceDiscovery: ({serviceType, success, fail}) => {
    global.wx.startLocalServiceDiscoverySuccessHandle = success;
    global.wx.startLocalServiceDiscoveryFailHandle = fail;
  },
  createUDPSocketHandlerOnMessageHandle: null,
  createUDPSocketHandlerOnErrorHandle: null,

  createUDPSocket: () => {
    return {
      send: () => {},
      bind: () => {},
      offError: () => {},
      offMessage: () => {},
      onError: (func) => {
        if (func) {
          global.wx.createUDPSocketHandlerOnErrorHandle = func;
        }
      },
      close: () => {},
      onMessage: (func) => {
        if (func) {
          global.wx.createUDPSocketHandlerOnMessageHandle = func;
        }
      },
    }
  },
  getConnectedWifi: ({success}) => {
    success && success({
      wifi: {
        SSID: 'gizwits',
      }
    });
  },
  randomCodeResult: {
    data: [{mac: '123', did: '123', product_key: '00e7e327afa74a3d8ff1cc190bad78c0'}, {mac: '123', did: '123', product_key: '00e7e227afa74a3d8ff1cc190bad78c0'}],
    code: 200
  },
  bindResult: {
    data: {},
    code: 200
  },
  bindingsResult: defaultBindingsResult,
  requestErr: null,
  request: ({url, header, fail, success}) => {
    if (url.indexOf('device_register?random_code') !== -1) {
      setTimeout(() => {
        if (global.wx.requestErr) {
          fail && fail(global.wx.requestErr);
        } else {
          success && success(global.wx.randomCodeResult);
        }

      }, 100);
    }
    if (url.indexOf('app/bind_ma') !== -1) {
      setTimeout(() => {
        if (this.requestErr) {
          fail && fail(this.requestErr);
        } else {
          success && success(global.wx.bindResult);
        }
      }, 100);
    }
    if (url.indexOf('app/bindings') !== -1) {
      setTimeout(() => {
        if (global.wx.requestErr) {
          fail && fail(global.wx.requestErr);
        } else {
          success && success(global.wx.bindingsResult);
          global.wx.bindingsResult = defaultBindingsResult;
        }
      }, 100);
    }
  },
  networkStatusChangeHandle: null,
  onNetworkStatusChange: (func) => {
    global.wx.networkStatusChangeHandle = func;
  },
  connectSocket: () => new MockSocket(),

  getSystemInfoSync: () => ({
    SDKVersion: '1.6.9'
  })
};

[
  'getBluetoothAdapterState',
  'closeBLEConnection',
  'getBluetoothDevices',
  'getBLEDeviceServices',
  'getBLEDeviceCharacteristics',
  'notifyBLECharacteristicValueChange',
  'writeBLECharacteristicValue',
  'createBLEConnection',
  'offBLECharacteristicValueChange',
  'stopBluetoothDevicesDiscovery',
  'closeBluetoothAdapter',
  'offBluetoothDeviceFound',
  'startBluetoothDevicesDiscovery',
  'openBluetoothAdapter',
].forEach((key) => {
  global.wx[key] = () => { };
  global.wx[key].callCount = 0;
  const handler = {
    apply: function (target, obj, arguments) {
      global.wx[key].callCount += 1;
      const wxOption = arguments[0];
      if (!wxOption) {
        return target(...arguments);
      }
      if (target.success) {
        if (wxOption.success) {
          setTimeout(() => {
            wxOption.success(target.success);
          }, 50);
        }
      } else if (target.fail) {
        if (wxOption.fail) {
          setTimeout(() => {
            wxOption.fail(target.fail);
          }, 50);
        }
      } else if (target.complete) {
        if (wxOption.complete) {
          setTimeout(() => {
            wxOption.complete(target.complete);
          }, 50);
        }
      } else {
        return target(...arguments);
      }
      return;
    }
  };
  global.wx[key] = new Proxy(global.wx[key], handler)
});

['onBLECharacteristicValueChange', 'onBluetoothDeviceFound'].forEach((key) => {
  global.wx[key] = () => { };
  const handler = {
    apply: function (target, obj, arguments) {
      const cb = arguments[0];
      if (cb) {
        target.callback = cb;
      }
      return;
    }
  };
  global.wx[key] = new Proxy(global.wx[key], handler)
});

class MockSocket {
  open = false;
  receiveCmds = [];
  onOpen = (cb) => {
    this._handleOpen = cb;
  }
  onClose = (cb) => {
    this._handleClose = cb;
  }
  onMessage = (cb) => {
    this._handleMessage = cb && (data => cb({ data: JSON.stringify(data) }));
  }
  onError = (cb) => {
    this._handleError = cb;
  }
  close = () => {
    this.open = false;
    setTimeout(() => {
      this._handleClose && this._handleClose();
    }, 0);
  }
  send = ({ data, complete }) => {
    const obj = JSON.parse(data);
    this.receiveCmds.push(obj.cmd);
    complete && complete();
  }
}

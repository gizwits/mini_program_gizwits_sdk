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
  },
  networkStatusChangeHandle: null,
  onNetworkStatusChange: (func) => {
    global.wx.networkStatusChangeHandle = func;
  }
};
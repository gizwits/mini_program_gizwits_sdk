

import { expect } from 'chai';
import 'mocha';

import GizwitsWS, { Connection } from '../src/socket';
import { setGlobalData } from '../src/globalData';

declare namespace global {
  const wx: any;
}

describe('socket', function () {

  describe('Connection', function () {

    let conn;

    beforeEach(() => {
      conn = new Connection({
        appID: '123',
        token: '123',
        uid: '123',
        wsInfo: 'balabala'
      });
      conn._connectWS();
    })

    afterEach(() => {
      conn && conn.close();
    })

    it('login after socket open', (done) => {
      setTimeout(() => {
        conn._websocket._handleOpen();
        expect(conn._websocket.receiveCmds.includes('login_req')).to.be.true;
        done();
      }, 100);
    });

    it('ping and subscribe device after socket open', (done) => {
      conn._heartbeatInterval = 0.1;
      conn._websocket._handleOpen();
      conn._websocket._handleMessage({ 'cmd': 'login_res', data: { success: true } });

      expect(conn._websocket.receiveCmds.includes('subscribe_req')).to.be.true;

      setTimeout(() => {
        expect(conn._websocket.receiveCmds.includes('ping')).to.be.true;
        done();
      }, 150);
    });

    it('stop ping after socket close', (done) => {
      conn._heartbeatInterval = 0.1;
      conn._websocket._handleOpen();
      conn._websocket._handleMessage({ 'cmd': 'login_res', data: { success: true } });

      expect(conn._websocket.receiveCmds.includes('subscribe_req')).to.be.true;

      setTimeout(() => {
        expect(conn._websocket.receiveCmds.includes('ping')).to.be.true;
        conn._websocket._handleClose();
      }, 150);

      setTimeout(() => {
        expect(conn._websocket).to.be.null;
        done();
      }, 300);
    })

    it('try login three times if login fail', (done) => {
      conn._loginIntveral = 100;
      conn._websocket._handleOpen();
      conn._websocket._handleMessage({ 'cmd': 'login_res', data: { success: false } });

      setTimeout(() => {
        expect(conn._websocket.receiveCmds.filter((cmd) => cmd === 'login_req').length).to.equal(2);
        conn._websocket._handleMessage({ 'cmd': 'login_res', data: { success: false } });
      }, 120);
      setTimeout(() => {
        expect(conn._websocket.receiveCmds.filter((cmd) => cmd === 'login_req').length).to.equal(3);
        conn._websocket._handleMessage({ 'cmd': 'login_res', data: { success: false } });
      }, 350);
      setTimeout(() => {
        expect(conn._websocket.receiveCmds.filter((cmd) => cmd === 'login_req').length).to.equal(4);
        conn._websocket._handleMessage({ 'cmd': 'login_res', data: { success: false } });
        done();
      }, 700);
    });

    it('subscribe did', () => {
      conn._addSubDid('123');
      expect(conn._subDids.size).to.equal(1);
      conn._addSubDid('123');
      expect(conn._subDids.size).to.equal(1);
    })

    it('online changed', (done) => {
      conn._onDeviceStatusChanged = ({ did, attrs }) => {
        expect(did).to.equal('123');
        expect(attrs && attrs.online).to.true;
        done()
      }
      conn._websocket._handleMessage({ 'cmd': 's2c_online_status', data: { did: '123', online: true } });
    })

    it('raw changed', (done) => {
      const ab = [...new Uint8Array(16)];
      conn._onDeviceStatusChanged = ({ did, raw }) => {
        expect(did).to.equal('123');
        expect(raw.every(item => item === 0)).to.true;
        done()
      }
      conn._websocket._handleMessage({ 'cmd': 's2c_raw', data: { did: '123', raw: ab } });
    })

    it('status changed', (done) => {
      conn._onDeviceStatusChanged = ({ did, attrs }) => {
        expect(did).to.equal('123');
        expect(attrs && attrs.onoff).to.false;
        done()
      }
      conn._websocket._handleMessage({ 'cmd': 's2c_noti', data: { did: '123', attrs: { onoff: false } } });
    })

    it('smoke testing', () => {
      conn._websocket._handleMessage({ 'cmd': 'pong', data: {} });
      conn._websocket._handleMessage({ 'cmd': 'subscribe_res', data: { success: [{ did: '123' }], fail: [] } });
      conn._websocket._handleMessage({ 'cmd': 's2c_invalid_msg', data: { msg: 'error', error_code: '1000' } });
      conn._websocket._handleError();
    });

    it('invalid msg 1003', (done) => {
      setTimeout(() => {
        conn._websocket._handleMessage({ 'cmd': 's2c_invalid_msg', data: { error_code: 1003 } });
        expect(conn._websocket.receiveCmds.includes('login_req')).to.be.true;
        done();
      }, 100);
    });
  });

  describe('GizwitsWS', function () {

    setGlobalData('cloudServiceInfo', { openAPIInfo: 'api.gizwits.com' })

    let ws;

    beforeEach(function () {
      ws = new GizwitsWS({
        appID: '123',
        token: '123',
        uid: '123',
      })
    })

    afterEach(function () {
      ws.close();
    })

    it('init success', (done) => {
      global.wx.requestErr = null;
      ws.init().then((res) => {
        expect(res).to.null;
        done();
      })
    })

    it('init failed', (done) => {
      global.wx.requestErr = {
        err: '',
        code: 500,
      };
      ws.init().then((res) => {
        expect(res).to.not.null;
        done();
      })
    })

    it('get device', (done) => {
      global.wx.requestErr = null;
      ws.init().then(() => {
        expect(ws._getDevice('123').did).to.equal('123')
        done();
      })
    })
    it('get device fail', (done) => {
      global.wx.requestErr = null;
      expect(ws._getDevice('123').errorCode).to.not.null
      ws.init().then(() => {
        expect(ws._getDevice('1233').errorCode).to.not.null
        done();
      })
    })

    it('_getWebsocketConnInfo', (done) => {
      ws.init().then(() => {
        const device = ws._getDevice('123');
        expect(ws._getWebsocketConnInfo(device)).to.equal('wss://wxm2m.gizwits.com');
        done();
      })

    })

    it('get device and connect but device error', () => {
      global.wx.requestErr = null;
      expect(ws._getDeviceAndConnect('123').errorCode).to.not.null
    })

    it('get device and connect but not connect', (done) => {
      global.wx.requestErr = null;
      ws.init().then(() => {
        expect(ws._getDeviceAndConnect('123').errorCode).to.not.null
        done();
      })
    })

    it('connect', (done) => {
      ws.init().then(() => {
        const did = '123';
        ws.connect(did);
        const device = ws._getDevice(did);
        const wsInfo = ws._getWebsocketConnInfo(device);
        expect(ws._connections[wsInfo]).to.not.null;
        done();
      })
    })

    it('connect but get device error', (done) => {
      ws.init().then(() => {
        const did = '1232';
        expect(ws.connect(did).errorCode).to.not.null;
        done();
      })
    })

    it('limit connect error', (done) => {
      ws.init().then(() => {
        const did = '123';
        const did2 = '1234';
        ws.connect(did);
        expect(ws.connect(did2).errorCode).to.not.null;
        done();
      })
    })

    it('same connect', (done) => {
      ws.init().then(() => {
        const did = '123';
        const did2 = '1231';
        ws.connect(did);
        const device = ws._getDevice(did);
        const wsInfo = ws._getWebsocketConnInfo(device);
        const conn = ws._connections[wsInfo];
        conn._websocket._handleOpen();
        conn._websocket._handleMessage({ 'cmd': 'login_res', data: { success: true } });
        expect(ws.connect(did2)).to.null;
        done();
      })
    })

    it('smoke testing', (done) => {
      const did = '123';
      expect(ws.send(did, new Uint8Array(16)).errorCode).to.not.null;
      expect(ws.write(did, { on: true }).errorCode).to.not.null;
      expect(ws.read(did, ['on']).errorCode).to.not.null;
      ws.init().then(() => {
        ws.connect(did);
        expect((ws.send(did, new Uint8Array(16))) instanceof Promise).to.true;
        expect((ws.write(did, { on: true })) instanceof Promise).to.true;
        expect((ws.read(did, ['on'])) instanceof Promise).to.true;
        ws.close();
        done();
      })
    })

    it('subscribeDeviceStatus', (done) => {
      const handleSubscribe = ({ did, attrs }) => {
        expect(did).to.equal('123');
        expect(attrs && attrs.onoff).to.false;
        done();
      }
      const did = '123';
      ws.init().then(() => {
        ws.connect(did);
        ws.subscribeDeviceStatus(handleSubscribe);
        const device = ws._getDevice(did);
        const wsInfo = ws._getWebsocketConnInfo(device);
        const conn = ws._connections[wsInfo];
        conn._websocket._handleMessage({ 'cmd': 's2c_noti', data: { did: '123', attrs: { onoff: false } } });
      })
    })

    it('bindingsResult pagination', (done) => {
      global.wx.requestErr = null;
      global.wx.bindingsResult = {
        data: {
          devices: Array.from({ length: 20 }, (_, i) => ({
            mac: `i`, did: '123', host: 'm2m.gizwits.com', wss_port: 2000,
          }))
        },
        code: 200
      };
      ws.init().then((res) => {
        expect(res).to.be.null;
        done();
      })
    })

    it('bindingsResult has error_code', (done) => {
      global.wx.requestErr = null;
      global.wx.bindingsResult = {
        data: {
          error_code: 4000
        },
        code: 200
      };
      ws.init().then((res) => {
        expect(res).to.not.null;
        done();
      })
    })
  })
});
import { getGlobalData } from "./globalData";
import request from "./openApiRequest";
import { compareWXSDKVersion, isError } from './utils';

// commType = 'custom' | 'attrs_v4'
// socketType = 'socket' | 'ssl_socket'

const errorCode = {
  API_ERROR: Symbol('API_ERROR'),
  NOT_INIT: Symbol('NOT_INIT'),
  NOT_BOUND: Symbol('NOT_BOUND'),
  MAX_CONNECT: Symbol('MAX_CONNECT'),
  NOT_CONNECT: Symbol('NOT_CONNECT')
}

interface IDevice {
  did: string;
  host: string;
  wss_port: number;
}

interface IRespError {
  error_code?: string;
}

interface ICommonProps {
  appID: string;
  token: string;
  uid: string;
}

interface IGWSProps extends ICommonProps {
  limitSocketNum?: boolean;
}

export default class GizwitsWS {

  appID: string;
  token: string;
  uid: string;
  _maxSocketNum: number;
  _bindingDevices: { [did: string]: IDevice } | null = null;
  _connections: { [wsInfo: string]: Connection } = {};
  _onDeviceStatusChanged?: IOnDeviceStatusChanged;

  /**
   * @param limitSocketNum 是否限制 socket 连接数，如果限制则按照小程序sdk限制最大连接数，否则如果超过小程序限制连接数，微信可能会关闭之前的连接，也可以会有异常。
   */
  constructor({
    appID,
    token,
    uid,
    limitSocketNum = true,
  }: IGWSProps) {
    this.appID = appID;
    this.token = token;
    this.uid = uid;
    const wxSDKVersion = wx.getSystemInfoSync().SDKVersion
    this._maxSocketNum = limitSocketNum
      ? compareWXSDKVersion(wxSDKVersion, '1.7.0') === -1 ? 1 : 5
      : 0;
  }

  async init() {
    try {
      const result = await this._getBindingList();
      if ((result as IRespError).error_code) {
        return { errorCode: errorCode.API_ERROR, errorMessage: 'getting binding list failed' };
      } else {
        this._bindingDevices = (result as IDevice[]).reduce((map, device) => ({ ...map, [device.did]: device }), {});
        return null;
      }
    } catch (error) {
      return { errorCode: errorCode.API_ERROR, errorMessage: 'getting binding list failed' }
    }
  }

  _getDevice = (did: string): IDevice | IError => {
    if (this._bindingDevices === null) {
      return { errorCode: errorCode.NOT_INIT }
    }

    const device = this._bindingDevices[did];
    if (device == null) {
      return { errorCode: errorCode.NOT_BOUND };
    }
    return device;
  }

  _getDeviceAndConnect = (did: string): [IDevice, Connection] | IError => {
    const device = this._getDevice(did)
    if (isError(device)) {
      return device;
    }
    const wsInfo = this._getWebsocketConnInfo(device);
    const conn = this._connections[wsInfo];
    if (conn == null) {
      return { errorCode: errorCode.NOT_CONNECT };
    }
    return [device, conn]
  }

  connect = (did: string) => {
    const device = this._getDevice(did)
    if (isError(device)) {
      return device;
    }
    const wsInfo = this._getWebsocketConnInfo(device);
    let conn = this._connections[wsInfo];
    if (conn == null) {
      const connNum = Object.keys(this._connections).length;
      if (this._maxSocketNum !== 0 && connNum >= this._maxSocketNum) {
        return { errorCode: errorCode.MAX_CONNECT };
      }
      conn = new Connection({
        appID: this.appID,
        token: this.token,
        uid: this.uid,
        wsInfo,
        _onDeviceStatusChanged: this._handleDeviceStatusChanged
      });
      this._connections[wsInfo] = conn;
    }
    conn._addSubDid(did);
    if (conn._websocket == null) {
      conn._connectWS();
    } else if (conn.ready) {
      conn._subDevices([did]);
    }
    return null;
  }

  send = (did: string, raw: Uint8Array[]) => {
    const res = this._getDeviceAndConnect(did);
    if (isError(res)) {
      return res;
    }
    const [_, conn] = res;
    return conn._send({
      cmd: "c2s_raw",
      data: {
        did: did,
        raw
      }
    });
  }

  write = (did: string, attrs: ICommonObj) => {
    const res = this._getDeviceAndConnect(did);
    if (isError(res)) {
      return res;
    }
    const [_, conn] = res;
    return conn._send({
      cmd: "c2s_write",
      data: {
        did: did,
        attrs: attrs
      }
    });
  }

  read = (did: string, names?: string[]) => {
    const res = this._getDeviceAndConnect(did);
    if (isError(res)) {
      return res;
    }
    const [_, conn] = res;

    return conn._send({
      cmd: "c2s_read",
      data: {
        did: did,
        names: names
      }
    });
  }

  close = () => {
    Object.values(this._connections).forEach(conn => conn.close());
  }

  subscribeDeviceStatus = (cb: IOnDeviceStatusChanged) => {
    this._onDeviceStatusChanged = cb;
  }

  _handleDeviceStatusChanged: IOnDeviceStatusChanged = (data) => {
    const device = this._getDevice(data.did);
    if (!isError(device)) {
      this._onDeviceStatusChanged && this._onDeviceStatusChanged(data);
    }
  }

  _getBindingList = async (limit: number = 20, skip: number = 0, cacheList: IDevice[] = []): Promise<IDevice[] | IRespError> => {
    const url = `/app/bindings?show_disabled=0&limit=${limit}&skip=${skip}`;
    const { error_code, devices: data } = await request<{ devices: IDevice[] }>(`${url}`, { method: 'GET' });
    if (error_code) {
      return { error_code };
    }
    const devices = [...cacheList, ...data]
    if (data.length === limit) {
      return await this._getBindingList(limit, limit + skip, devices);
    }
    return devices;
  }

  _getWebsocketConnInfo = (device) => {
    return `wss://${device.host}:${device.wss_port}`
  }


}

interface IConnectProps extends ICommonProps {
  wsInfo: string;
  _onDeviceStatusChanged?: IOnDeviceStatusChanged;
}

export class Connection {
  ready: boolean = false;
  appID: string;
  token: string;
  uid: string;
  commType: string = 'attrs_v4';
  _heartbeatInterval = 60;
  _keepaliveTime = 180;
  _loginIntveral = 5000;
  autoSubscribe = false;
  _wsUrl: string;
  _websocket: WechatMiniprogram.SocketTask | null = null;
  _heartbeatTimerId?: any;
  _loginFailedTimes: number = 0;
  _subDids: Set<string> = new Set();
  _socketRespHandleMap: { [cmd: string]: (resp?: any) => void } = {};
  _onDeviceStatusChanged?: IOnDeviceStatusChanged;

  constructor({
    appID,
    token,
    uid,
    wsInfo,
    _onDeviceStatusChanged,
  }: IConnectProps) {
    this.appID = appID;
    this.token = token;
    this.uid = uid;
    this._wsUrl = `${wsInfo}/ws/app/v1`;
    this._heartbeatTimerId = undefined;
    this._loginFailedTimes = 0;
    this._onDeviceStatusChanged = _onDeviceStatusChanged;
    this._socketRespHandleMap = {
      pong: this.pongResp,
      login_res: this._loginResp,
      subscribe_res: this._subscribeResp,
      s2c_online_status: this._onlineResp,
      s2c_raw: this._rawChangedResp,
      s2c_noti: this._statusChangedResp,
      s2c_invalid_msg: this._invalidMsgResp,
    }
  }

  _addSubDid = (did) => {
    this._subDids.add(did);
  }

  _connectWS = () => {
    this._websocket = wx.connectSocket({ url: this._wsUrl });
    this._websocket.onClose(this.handleClose);
    this._websocket.onOpen(this.handleOpen);
    this._websocket.onError(this.handleError);
    this._websocket.onMessage(this.handleMessage);
  }

  _subDevices = (dids: string[]) => {
    const json = {
      cmd: "subscribe_req",
      data: dids.map(did => ({ did }))
    };
    this._send(json);
  }

  _send = (data: object, forced: boolean = false) => {
    return new Promise<WechatMiniprogram.GeneralCallbackResult>((resolve) => {
      if (this._websocket && (forced || this.ready)) {
        this._websocket.send({
          data: JSON.stringify(data),
          complete: (res) => {
            console.debug('GIZ_SDK: socket send res', res);
            resolve(res);
          }
        })
      }
    })
  }

  close = () => {
    this.ready = false;
    if (this._heartbeatTimerId) {
      clearInterval(this._heartbeatTimerId);
    }
    if (this._websocket) {
      this._websocket.close({});
      this._websocket = null;
    }
  }

  handleClose = (res: { code: number, reason: string }) => {
    console.log('socket close', res);
    this._stopPing();
  }

  handleOpen = () => {
    // socket 打开后执行登录
    this._login();
  }

  handleMessage = ({ data }: { data: string | ArrayBuffer }) => {
    const res = JSON.parse(data as string);
    const handle = this._socketRespHandleMap[res.cmd];
    handle && handle(res.data);
  }

  handleError = (err: { errMsg: string }) => {
    console.debug('GIZ_SDK: socket error', err);
  }

  _login = () => {
    const data = {
      cmd: 'login_req',
      data: {
        appid: this.appID,
        uid: this.uid,
        token: this.token,
        p0_type: this.commType,
        heartbeat_interval: this._keepaliveTime,
        auto_subscribe: this.autoSubscribe
      }
    }
    this._send(data, true);
  }

  _tryLoginAgain = () => {
    this._loginFailedTimes += 1;
    setTimeout(() => {
      this._login();
    }, this._loginFailedTimes * this._loginIntveral);
  }

  _startPing = () => {
    this._heartbeatTimerId = setInterval(() => {
      this._send({ cmd: 'ping' });
    }, this._heartbeatInterval * 1000);
  }

  _stopPing = () => {
    this._heartbeatTimerId && clearInterval(this._heartbeatTimerId);
  }

  pongResp = () => {
    // 不处理
  }

  _loginResp = (data) => {
    if (data.success == true) {
      this._loginFailedTimes = 0;
      this.ready = true;
      this._startPing();
      this._subDevices([...this._subDids]);
    } else if (this._loginFailedTimes < 3) {
      console.debug('GIZ_SDK: Login failed, will try again, please wait...');
      this._tryLoginAgain();
    } else {
      console.debug('GIZ_SDK: Login failed');
      this.close();
    }
  }

  _subscribeResp = (data) => {
    console.debug('GIZ_SDK: subscribe_res', data);
  }

  _onlineResp = (data: { did: string, online: boolean }) => {
    this._onDeviceStatusChanged && this._onDeviceStatusChanged({
      did: data.did, attrs: { is_online: data.online, ...data }
    });
  }

  _rawChangedResp = (data: IDeviceRawStatusChangedProps) => {
    this._onDeviceStatusChanged && this._onDeviceStatusChanged(data);
  }

  _statusChangedResp = (data: IDeviceStatusChangedProps) => {
    this._onDeviceStatusChanged && this._onDeviceStatusChanged(data);
  }

  _invalidMsgResp = (data) => {
    console.debug('GIZ_SDK: s2c_invalid_msg', data);
  }
}

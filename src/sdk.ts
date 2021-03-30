import errorCode from "./errorCode";
import * as MD5 from 'js-md5';
import getRandomCodes from "./randomCode";
import { setGlobalData } from "./globalData";
import request from "./openApiRequest";

import sleep from './sleep';
import { getBluetoothAdapterState, openBluetoothAdapter, startBluetoothDevicesDiscovery, getBluetoothDevices } from "./wechatApi";
import { sendBLEConfigCmd } from "./ble";

import GizwitsWS from "./socket";
import { isError, ab2hex } from "./utils";

interface ISetCommonDeviceOnboardingDeployProps {
  ssid: string;
  password: string;
  timeout: number;
  isBind?: boolean;
  softAPSSIDPrefix?: string;
}

interface ISetDeviceOnboardingDeployProps extends ISetCommonDeviceOnboardingDeployProps {
  softAPSSIDPrefix: string;
}

interface IDevice {
  random_code: string;
  product_key: string;
  mac: string;
  did: string;
  user_id: string;
  timestamp: number;
  type: string;
  wifi_soft_ver: string;
  lan_proto_ver: string;
}

interface IResult<T> {
  success: boolean;
  data?: T;
  err?: IError;
}

interface ITarget {
  serviceType: string;
  serviceName: string;
  ip: string;
  port: number;
}

interface configDeviceParams {
  ssid: string; password: string; softAPSSIDPrefix: string;
}

interface configBLEDeviceParams {
  ssid: string;
  password: string
  softAPSSIDPrefix?: string;
  timeout: number;
}

interface ISDK {
  appID: string;
  appSecret: string;
  timeoutHandler: any;
  disableSendUDP: any;
  configDevice({ ssid, password, softAPSSIDPrefix }: configDeviceParams, target: ITarget): any;
  setDeviceOnboardingDeploy({
    ssid, password, timeout, isBind }: ISetDeviceOnboardingDeployProps): any;
  stopDeviceOnboardingDeploy(): void;
}

interface ICloudServiceInfo {
  openAPIInfo: string;
}

interface IProps {
  appID: string;
  appSecret: string;
  specialProductKeys: string[];
  specialProductKeySecrets: string[];
  cloudServiceInfo: ICloudServiceInfo | null;
  token: string;
  uid: string;
  onDeviceStatusChanged?: IOnDeviceStatusChanged
}

interface IRejectCallback {
  (result: IResult<unknown>): void
}

interface IWXDevicesResult {
  success: true;
  bleDevices: WechatMiniprogram.BlueToothDevice[];
}

function isWXDevicesResult(res: unknown): res is IWXDevicesResult {
  return (res as IWXDevicesResult).success
    && Object.prototype.toString.call((res as IWXDevicesResult).bleDevices) === '[object Array]';
}

class SDK implements ISDK {
  constructor({ appID, appSecret, specialProductKeys, specialProductKeySecrets, cloudServiceInfo, token, uid, onDeviceStatusChanged }: IProps) {

    this.appID = appID;
    this.appSecret = appSecret;
    this.specialProductKeys = specialProductKeys;
    this.specialProductKeySecrets = specialProductKeySecrets;
    this.token = token;
    this.uid = uid;
    this.onDeviceStatusChanged = onDeviceStatusChanged;

    // 保存相关信息
    setGlobalData('appID', appID);
    setGlobalData('appSecret', appSecret);
    setGlobalData('specialProductKeys', specialProductKeys);
    setGlobalData('specialProductKeySecrets', specialProductKeySecrets);
    setGlobalData('token', token);
    setGlobalData('uid', uid);


    /**
     * 同时也设置域名信息
     */
    const openAPIInfo = cloudServiceInfo && cloudServiceInfo.openAPIInfo || 'api.gizwits.com';
    this.setDomain({ ...(cloudServiceInfo || {}), openAPIInfo });

    // 监听服务发现
    // wx.onLocalServiceFound((data: any) => {
    //   this.onFoundService && this.onFoundService(data);
    // });
    this.socket = new GizwitsWS({
      appID: this.appID, token: this.token, uid: this.uid,
    })
  }

  socket: GizwitsWS;
  hasInitSocket: boolean = false;
  onDeviceStatusChanged?: IOnDeviceStatusChanged

  appID: string = '';
  appSecret: string = '';
  token: string = '';
  uid: string = '';

  UDPSocketHandler: any = null;
  disableSendUDP: boolean = false;
  // onLocalServiceFound 的callback
  // onFoundService: any;

  // 配网超时
  timeoutHandler: any = null;
  sendMessageInterval: any = null;
  specialProductKeys: string[] = [];
  specialProductKeySecrets: string[] = [];

  // 成功配网设备
  successDevices: IDevice[] = [];

  disableSearchDevice: boolean = false;
  setDeviceOnboardingDeployRej: any; // 保存promise的rej，用于临时中断
  setDeviceOnboardingDeployRes: any; // 保存promise的res，用于临时中断

  /**
   * 设置域名
   */
  setDomain = (cloudServiceInfo: ICloudServiceInfo) => {
    setGlobalData('cloudServiceInfo', cloudServiceInfo);
  }

  formatCode = (str) => {
    const code = encodeURI(str);
    if (code.indexOf('%') !== -1 && str !== '%') {
      // utf8
      return code.split('%').filter((item) => item !== '').map((item) => parseInt(item, 16));
    }
    return [code.charCodeAt(0)];
  }

  formatCodesFromStr = (str: string) => {
    const len = [0, 0];
    let codes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      const code = this.formatCode(str[i])
      len[1] += code.length;
      codes = codes.concat(code);
    }
    return [codes, len];
  }

  formatPackages = (ssid: string, password: string) => {
    const header = [0, 0, 0, 3];
    const length: number[] = [];
    const flag = [0];
    const cmd = [0, 1];

    const [ASSID, ssidLength] = this.formatCodesFromStr(ssid);
    const [APassword, passwordLength] = this.formatCodesFromStr(password);

    const content = flag.concat(cmd, ssidLength, ASSID, passwordLength, APassword);

    let contentLength = content.length;
    while (contentLength > 0) {
      length.push(contentLength);
      contentLength -= 255;
    }

    const config = header.concat(length).concat(content);
    const buffer = new ArrayBuffer(config.length);
    const uint8Array = new Uint8Array(buffer)
    for (let i = 0; i < buffer.byteLength; i++) {
      uint8Array[i] = config[i];
    }
    return uint8Array;
  }

  /**
   * 负责发指令
   */
  configDevice = (
    { ssid, password, softAPSSIDPrefix }: configDeviceParams,
  ) => {
    return new Promise<IResult<IDevice[]>>((res, rej) => {
      console.debug('GIZ_SDK: start config device');
      let searchingDevice = false;
      const uint8Array = this.formatPackages(ssid, password);
      /**
       * 连接socket 发送
       */
      this.UDPSocketHandler = wx.createUDPSocket();
      this.UDPSocketHandler.bind();

      this.disableSendUDP = false;

      /**
       * TODO
       * 收到设备回的包后终止
       * 或者超时
       * 或者成功
       */
      const sendMessage = () => {
        try {
          !this.disableSendUDP && this.UDPSocketHandler.send({
            address: '10.10.100.254',
            port: 12414,
            message: uint8Array,
            offset: 0,
            length: uint8Array.byteLength,
          });
        } catch (error) {
          // console.log('sendMessage', error);
        }
        // setTimeout(() => {
        //   sendMessage();
        // }, 2000)
      }

      // 执行
      this.sendMessageInterval = setInterval(() => {
        sendMessage();
      }, 2000);

      this.UDPSocketHandler.onError((data: any) => {
        // console.log('on udp Error', data);
        // UDPSocketHandler.close();
        this.clean();
        rej({
          success: false,
          err: {
            errorCode: errorCode.WECHAT_ERROR,
            errorMessage: data.errMsg
          }
        });
      });

      // 清理一些监听，调用搜索设备
      const searchDeviceHandle = async () => {
        if (searchingDevice) return;
        // console.log('searchDeviceHandle');
        this.UDPSocketHandler.offMessage();
        this.UDPSocketHandler.offError();
        this.sendMessageInterval && clearInterval(this.sendMessageInterval);
        this.disableSendUDP = true;
        // 标记可以停止监听
        searchingDevice = true;
        // 关闭socket
        try {
          const devicesReturn = await this.searchDevice({ ssid, password });
          res(devicesReturn);
        } catch (error) {
          rej(error)
        }
      }

      this.UDPSocketHandler.onMessage(() => {
        // console.log('on udp Message', data);
        // 收到回调 可以停止发包
        searchDeviceHandle();
      });

      // 没有收到udp回复的时候不进入配网
      wx.onNetworkStatusChange(async () => {
        // 发生网络切换的时候也停止发包，进入大循环配网
        // 搜索中的时候不要重复搜索
        !searchingDevice && wx.getConnectedWifi({
          success: async (data) => {
            /**
             * 检查当前网络还是不是热点网络
             */
            data.wifi.SSID.indexOf(softAPSSIDPrefix) === -1 && searchDeviceHandle();
          }
        });
      });
    });
  }

  /**
   * 大循环确认
   */
  searchDevice = ({ ssid, password }: { ssid: string, password: string }) => {
    return new Promise<IResult<IDevice[]>>((res, rej) => {
      // 连续发起请求 确认大循环
      const codes = getRandomCodes({ SSID: ssid, password, pks: this.specialProductKeys });
      console.debug('params', ssid, password, this.specialProductKeys)
      console.debug('codes', codes)
      let codeStr = '';
      codes.map(item => {
        codeStr += `${item},`
      })
      codeStr = codeStr.substring(0, codeStr.length - 1);
      console.debug('codeStr', codeStr)
      const query = async () => {
        try {
          const data = await request<IDevice[]>(`/app/device_register?random_codes=${codeStr}`, { method: 'get' });

          console.log('GIZ_SDK: try get device random codes', data);
          if (data.error_code === '9004') {
            // token 失效
            rej({
              success: false,
              err: {
                errorCode: errorCode.API_ERROR,
                errorMessage: JSON.stringify(data),
              }
            });
            return;
          }

          if (data.error_code || (data as IDevice[]).length === 0) {
            // 重新请求
            await sleep(3000);
            !this.disableSearchDevice && query();
          } else {
            // 搜索到设备
            console.log('GIZ_SDK: config device success', data)
            res({
              success: true,
              data
            });
          }
        } catch (error) {
          // 重新请求
          await sleep(3000);
          !this.disableSearchDevice && query();
          console.debug('GIZ_SDK: random codes error', error);
        }
      }
      query();
    });
  }

  hasTimeoutHandler = (cb?: IRejectCallback) => {
    if (this.timeoutHandler) {
      // 方法还在执行中
      cb && cb({
        success: false,
        err: {
          errorCode: errorCode.EXECUTING,
          errorMessage: 'executing',
        }
      })
      return true;
    }
    return false;
  }

  handleTimeout = () => {
    // if (this.successDevices.length > 0 && this.setDeviceOnboardingDeployRes) {
    //   this.setDeviceOnboardingDeployRes({
    //     success: true,
    //     data: this.successDevices,
    //   });
    // } else 
    if (this.setDeviceOnboardingDeployRej) {
      this.setDeviceOnboardingDeployRej({
        success: false,
        err: {
          errorCode: errorCode.TIME_OUT,
          errorMessage: 'time out',
        }
      });
    }
    this.clean();
  }

  startTimeoutTimer = (timeout: number) => {
    /**
     * 设置超时时间
     */
    this.timeoutHandler = setTimeout(this.handleTimeout, timeout * 1000);
  }

  /**
   * 配网接口
   * setDeviceOnboardingDeploy方法不可重复调用
   */
  setDeviceOnboardingDeploy = ({
    ssid, password, timeout, isBind = true, softAPSSIDPrefix }: ISetDeviceOnboardingDeployProps) => {
    return new Promise<IResult<IDevice[]>>(async (res, rej) => {
      if (!this.hasTimeoutHandler(rej)) {
        this.clean();
        this.initDeviceOnboardingDeploy(res, rej);
        this.startTimeoutTimer(timeout)

        try {
          const result = await this.configDevice({ ssid, password, softAPSSIDPrefix });
          if (isBind) {
            try {
              res(await this.bindDevices(result.data as unknown as IDevice[]));
            } catch (error) {
              rej(error);
            }
          } else {
            // 不需要绑定 直接返回成功
            res({
              success: true,
              data: result.data,
            });
          }
        } catch (error) {
          rej(error);
        } finally {
          this.clean();
        }
      }
    });
  }

  /**
   * 绑定多个设备
   */
  bindDevices = (devices: IDevice[]) => {
    console.log('GIZ_SDK: start bind device')
    return new Promise<IResult<IDevice[]>>(async (res, rej) => {

      let timestamp = Date.parse(`${new Date()}`);
      timestamp = timestamp / 1000;

      const promises = devices.map(item => {
        const index = this.specialProductKeys.findIndex(pk => item.product_key === pk);
        if (index === -1) return;
        const ps = this.specialProductKeySecrets[index];
        return request<IDevice>(
          '/app/bind_mac',
          {
            method: 'POST',
            headers: {
              'X-Gizwits-Timestamp': timestamp,
              'X-Gizwits-Signature': MD5(`${ps}${timestamp}`).toLowerCase(),
            },
            data: {
              "product_key": item.product_key,
              "mac": item.mac,
              "remark": "",
              "dev_alias": ""
            }
          },
        );
      });

      try {
        const data = await Promise.all(promises);
        const successDevices = devices.filter((_, index) => {
          const item = data[index];
          return item && !item.error_code;
        });
        if (successDevices.length > 0) {
          console.log('GIZ_SDK: bind device success', successDevices);
          // 绑定成功，重新初始化socket
          this.initSocket();
          res({
            success: true,
            data: successDevices,
          })
        } else {
          console.log('GIZ_SDK: bind device error', data)
          rej({
            success: false,
            err: {
              errorCode: errorCode.BIND_FAIL,
              errorMessage: JSON.stringify(data),
              devices // 返回绑定失败的设备
            }
          });
        }
      } catch (error) {
        rej(error);
      }
    });
  }

  /**
   * 清除一些timeout等
   */
  clean = (): void => {
    this.timeoutHandler && clearTimeout(this.timeoutHandler);
    this.sendMessageInterval && clearInterval(this.sendMessageInterval);
    this.timeoutHandler = null;
    this.sendMessageInterval = null;
    this.setDeviceOnboardingDeployRej = null;
    this.setDeviceOnboardingDeployRes = null;
    // this.onFoundService = null;

    // try {
    //   wx.stopLocalServiceDiscovery({});
    // } catch (error) {

    // }

    this.disableSearchDevice = true;
    if (this.UDPSocketHandler) {
      this.UDPSocketHandler.offError();
      this.UDPSocketHandler.offMessage();
      this.UDPSocketHandler.close();
    }
  }

  cleanBle = () => {
    wx.stopBluetoothDevicesDiscovery();
    wx.closeBluetoothAdapter();
  }

  /**
   * 停止配网
   */
  stopDeviceOnboardingDeploy = (): void => {
    if (this.setDeviceOnboardingDeployRej) {
      this.setDeviceOnboardingDeployRej({
        success: false,
        err: {
          errorCode: errorCode.STOP,
          errorMessage: '手动停止'
        }
      });
    }
    this.clean();
  }

  initDeviceOnboardingDeploy = (res, rej) => {
    this.setDeviceOnboardingDeployRes = res;
    this.setDeviceOnboardingDeployRej = rej;
    this.disableSearchDevice = false;
    this.successDevices = [];
  }

  /**
   * 蓝牙配网
   */
  setBLEDeviceOnboardingDeploy = ({
    ssid,
    password,
    timeout,
    isBind = true,
    softAPSSIDPrefix,
  }: ISetCommonDeviceOnboardingDeployProps) => {
    return new Promise<IResult<IDevice[]>>(async (res, rej) => {
      if (!this.hasTimeoutHandler(rej)) {
        this.clean();
        this.initDeviceOnboardingDeploy(res, rej);

        this.startTimeoutTimer(timeout);
        try {
          const result = await this.configBLEDevice({ ssid, password, timeout: timeout * 1000, softAPSSIDPrefix });
          if (!this.hasTimeoutHandler()) {
            // 如果已超时，结束执行接下来的流程
            return;
          }

          if (isBind) {
            res(await this.bindDevices(result.data as unknown as IDevice[]));
          } else {
            // 不需要绑定 直接返回成功
            res({
              success: true,
              data: result.data,
            });
          }
        } catch (error) {
          rej(error);
        } finally {
          this.clean();
          this.cleanBle();
        }
      }
    })
  }

  stopBLEDeviceOnboardingDeploy = () => {
    this.stopDeviceOnboardingDeploy();
    this.cleanBle();
  }

  enableBluetoothDevicesDescovery = async (): Promise<{ success: false, err: IError } | { success: true }> => {
    await openBluetoothAdapter()
    const stateRes = await getBluetoothAdapterState();
    if (!stateRes.available) {
      return {
        success: false,
        err: {
          errorCode: errorCode.BLE_ERROR,
          errorMessage: '蓝牙状态不可用'
        }
      };
    }

    await startBluetoothDevicesDiscovery();
    return { success: true }
  }

  isValidBleDevice = (bleDevice: WechatMiniprogram.BlueToothDevice, softAPSSIDPrefix?: string) => {
    if (!bleDevice || !bleDevice.advertisData) {
      // 无效蓝牙设备或者蓝牙设备广播数据为空，返回失败
      return false;
    }

    const pkUintArray = bleDevice.advertisData.slice(bleDevice.advertisData.byteLength - 16);
    const pk = ab2hex(pkUintArray);

    if (!this.specialProductKeys.includes(pk)) {
      // 不在PK列表
      return false;
    }
    return !softAPSSIDPrefix || bleDevice.name && bleDevice.name.startsWith(softAPSSIDPrefix);
  }

  enableAndGetBluetoothDevices = async (softAPSSIDPrefix?: string): Promise<{ success: false, err: IError } | { success: true, bleDevices: WechatMiniprogram.BlueToothDevice[] }> => {
    const discoveryRes = await this.enableBluetoothDevicesDescovery();
    if (!discoveryRes.success) {
      return discoveryRes;
    }

    const bleDevices: WechatMiniprogram.BlueToothDevice[] = (await getBluetoothDevices())
      .filter((d) => this.isValidBleDevice(d, softAPSSIDPrefix));
    return {
      success: true,
      bleDevices,
    }
  }

  /**
   * 负责发蓝牙设备指令
   */
  configBLEDevice = (
    { ssid, password, softAPSSIDPrefix }: configBLEDeviceParams,
  ) => {
    return new Promise<IResult<IDevice[]>>(async (res, rej) => {
      console.debug('GIZ_SDK: start config ble device');
      const enableAndGetRes = await this.enableAndGetBluetoothDevices(softAPSSIDPrefix).catch((error) => {
        return {
          success: false,
          err: {
            errorCode: errorCode.WECHAT_ERROR,
            errorMessage: JSON.stringify(error),
          }
        }
      });

      if (!isWXDevicesResult(enableAndGetRes)) {
        // 开启获取蓝牙失败
        return rej(enableAndGetRes);
      }

      const { bleDevices } = enableAndGetRes;

      const handleFoundDevices = async ({ devices }: { devices: WechatMiniprogram.BlueToothDevice[] }) => {
        this.hasTimeoutHandler()
          ? Array.prototype.push.apply(bleDevices, devices.filter((d) => this.isValidBleDevice(d, softAPSSIDPrefix)))
          : wx.offBluetoothDeviceFound(handleFoundDevices);
      }

      wx.onBluetoothDeviceFound(handleFoundDevices);

      const uint8Array = this.formatPackages(ssid, password);
      const startConfigDevice = async () => {
        if (!this.hasTimeoutHandler()) {
          return;
        }
        const bleDevice = bleDevices.shift();
        const success = bleDevice && await sendBLEConfigCmd({
          bleDeviceId: bleDevice.deviceId,
          arrayBuffer: uint8Array.buffer,
        });

        if (!success) {
          // 如果校验设备或者发送不成功，重试下一个设备
          await sleep(100);
          await startConfigDevice();
          return;
        }

        // 如果有一个设备发送成功，则不再发现新设备
        wx.offBluetoothDeviceFound(handleFoundDevices);

        // 进入大循环
        try {
          const devicesReturn = await this.searchDevice({ ssid, password });
          res(devicesReturn);
        } catch (error) {
          rej(error)
        }
      }

      await startConfigDevice();
    })
  }

  /**
   * 初始化socket
   * @returns 
   */
  initSocket = async (onDeviceStatusChanged?: IOnDeviceStatusChanged) => {
    this.hasInitSocket = false;
    const initErr = await this.socket.init();
    if (initErr) {
      return initErr;
    }
    this.hasInitSocket = true;
    if (onDeviceStatusChanged) {
      this.socket.subscribeDeviceStatus(onDeviceStatusChanged)
    }
    return null;
  }

  // 订阅设备
  setSubscribes = async (dids: string[]) => {
    if (!this.hasInitSocket) {
      const initErr = await this.initSocket(this.onDeviceStatusChanged);
      if (initErr) {
        return initErr;
      }
    }
    const result = await dids.map(did => this.socket.connect(did));
    const error = result.find(e => isError(e))
    return error;
  }

  // 控制设备
  write = (did: string, attrs: ICommonObj) => {
    return this.socket.write(did, attrs);
  }

  // 请求上报数据
  read = (did: string, names?: string[]) => {
    return this.socket.read(did, names);
  }
}

// const sdk = new SDK({appID: '', appSecret: ''});
// sdk.sendConfig({ssid: 'gizwits', password: 'giz$2025'}, {} as any);
export default SDK;

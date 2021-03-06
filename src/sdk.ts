import errorCode from "./errorCode";
import * as MD5 from 'js-md5';
import getRandomCodes from "./randomCode";
import { setGlobalData } from "./global";
import request from "./openApiRequest";

import sleep from './sleep';


interface ISetDeviceOnboardingDeployProps {
  ssid: string;
  password: string;
  timeout: number;
  isBind?: boolean;
  softAPSSIDPrefix: string;
}

interface IDevice {
  mac: string;
  product_key: string;
  did: string;
  name: string;
  sno?: string;
  manufacturer?: any;
  alias?: string;
  onlineStatus: boolean;
  netStatus: number;
  isSubscribed?: boolean;
  meshID?: string;
  isBind?: boolean;
  isOnline?: boolean;
  remark?: string;
  siteGid: string;
  id?: string;
}

interface IErr {
  errorCode: Symbol;
  errorMessage: string;
}

interface IResult<T> {
  success: boolean;
  data?: T;
  err?: IErr;
}

interface ITarget {
  serviceType: string;
  serviceName: string;
  ip: string;
  port: number;
}

interface configDeviceParamse {
  ssid: string; password: string; softAPSSIDPrefix: string;
}

interface ISDK {
  appID: string;
  appSecret: string;
  timeoutHandler: any;
  disableSendUDP: any;
  configDevice({ ssid, password, softAPSSIDPrefix }: configDeviceParamse, target: ITarget): any;
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
}

interface IRejectCallback {
  (result: IResult<unknown>): void
}

class SDK implements ISDK {
  constructor({ appID, appSecret, specialProductKeys, specialProductKeySecrets, cloudServiceInfo, token, uid }: IProps) {

    this.appID = appID;
    this.appSecret = appSecret;
    this.specialProductKeys = specialProductKeys;
    this.specialProductKeySecrets = specialProductKeySecrets;
    this.token = token;
    this.uid = uid;

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
    this.setDomain(cloudServiceInfo);

    // 监听服务发现
    // wx.onLocalServiceFound((data: any) => {
    //   this.onFoundService && this.onFoundService(data);
    // });
  }

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


  disableSearchDevice: boolean = false;
  setDeviceOnboardingDeployRej: any; // 保存promise的res，用于临时中断

  /**
   * 设置域名
   */
  setDomain = (cloudServiceInfo: ICloudServiceInfo | null) => {
    if (cloudServiceInfo && cloudServiceInfo.openAPIInfo) {

    } else {
      cloudServiceInfo = {
        openAPIInfo: 'api.gizwits.com',
      };
    }
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
    { ssid, password, softAPSSIDPrefix }: configDeviceParamse,
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
      const codes = getRandomCodes({ SSID: ssid, password: password, pks: this.specialProductKeys });
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

  startTimeoutTimer = (timeout: number, cb?: IRejectCallback) => {
    /**
     * 设置超时时间
     */
    this.timeoutHandler = setTimeout(() => {
      cb && cb({
        success: false,
        err: {
          errorCode: errorCode.TIME_OUT,
          errorMessage: 'time out',
        } as IErr
      });
      this.clean();
    }, timeout * 1000);
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
        this.setDeviceOnboardingDeployRej = rej;
        this.disableSearchDevice = false;

        this.startTimeoutTimer(timeout, rej)

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
          console.log('GIZ_SDK: bind device success', successDevices)
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
}

// const sdk = new SDK({appID: '', appSecret: ''});
// sdk.sendConfig({ssid: 'gizwits', password: 'giz$2025'}, {} as any);
export default SDK;

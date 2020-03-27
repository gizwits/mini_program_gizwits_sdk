import errorCode from "./errorCode";
import getRandomCodes from "./randomCode";
import { setGlobalData } from "./global";
import request from "./openApiRequest";

import sleep from './sleep';

import MD5 = require('./md5');

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

interface IResult {
  success: boolean;
  data?: IDevice | null;
  err?: IErr;
}

interface ITarget {
  serviceType: string;
  serviceName: string;
  ip: string;
  port: number;
}

interface configDeviceParamse{
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
    wx.onLocalServiceFound((data: any) => {
      this.onFoundService && this.onFoundService(data);
    });
  }

  appID: string = '';
  appSecret: string = '';
  token: string = '';
  uid: string = '';

  UDPSocketHandler: any = null;
  disableSendUDP: boolean = false;
  // onLocalServiceFound 的callback
  onFoundService: any;

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

  /**
   * 负责发指令
   */
  configDevice = (
    { ssid, password, softAPSSIDPrefix }: configDeviceParamse,
    target: ITarget
  ): Promise<IResult> => {
    return new Promise((res) => {
      console.log('start config device');
      let searchingDevice = true;

      const header = [0, 0, 0, 3];
      let length: number[] = [];
      const flag = [0];
      const cmd = [0, 1];
      const ssidLength = [0, ssid.length];
      const passwordLength = [0, password.length];

      let ASSID: number[] = [];
      for (let i = 0; i < ssid.length; i++) {
        ASSID.push(ssid[i].charCodeAt(0));
      }

      let APassword: number[] = [];
      for (let i = 0; i < password.length; i++) {
        APassword.push(password[i].charCodeAt(0));
      }

      const content = flag.concat(cmd, ssidLength, ASSID, passwordLength, APassword);
      // length = content.length.toString(16);

      let contentLength = content.length;
      while (contentLength > 0) {
        length.push(contentLength);
        contentLength -= 255;
      }

      const config = header.concat(length).concat(content);
      console.log('发送指令给设备', config);
      const buffer = new ArrayBuffer(config.length);
      const uint8Array = new Uint8Array(buffer)
      for (let i = 0; i < buffer.byteLength; i++) {
        uint8Array[i] = config[i];
      }
      /**
       * 连接socket 发送
       */
      this.UDPSocketHandler = wx.createUDPSocketHandler();
      this.UDPSocketHandler.bind();

      this.disableSendUDP = false;

      /**
       * TODO
       * 收到设备回的包后终止
       * 或者超时
       * 或者成功
       */
      const sendMessage = () => {
        if (this.disableSendUDP) return;
        console.log('send udp');
        try {
          this.UDPSocketHandler.send({
            address: target.ip,
            port: target.port,
            message: uint8Array,
            offset: 0,
            length: uint8Array.byteLength,
          });
        } catch (error) {
          console.log('sendMessage', error);
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
        console.log('on udp Error', data);
        // UDPSocketHandler.close();
        this.clean();
        res({
          success: false,
          err: {
            errorCode: errorCode.WECHAT_ERROR,
            errorMessage: data.errMsg
          }
        } as IResult);
      });

      // 清理一些监听，调用搜索设备
      const searchDeviceHandle = async () => {
        console.log('searchDeviceHandle');
        this.UDPSocketHandler.offMessage();
        this.UDPSocketHandler.offError();
        this.sendMessageInterval && clearInterval(this.sendMessageInterval);
        this.disableSendUDP = true;
        // 标记可以停止监听
        searchingDevice = true;
        // 关闭socket
        const devicesReturn = await this.searchDevice({ ssid, password });
        console.log('searchDeviceHandle', devicesReturn);
        res(devicesReturn);
      }

      this.UDPSocketHandler.onMessage((data: any) => {
        console.log('on udp Message', data);
        // 收到回调 可以停止发包
        searchDeviceHandle();
      });

      wx.onNetworkStatusChange(async () => {
        // 发生网络切换的时候也停止发包，进入大循环配网
        // 搜索中的时候不要重复搜索
        !searchingDevice && wx.getConnectedWifi({
          success: async (data) => {
            /**
             * 检查当前网络还是不是热点网络
             */
            if (data.wifi.SSID.indexOf(softAPSSIDPrefix) === -1) {
              searchDeviceHandle();
            }
          }
        });
      });
    });
  }

  /**
   * 大循环确认
   */
  searchDevice = async ({ ssid, password }: { ssid: string, password: string }): Promise<IResult> => {
    console.log('searchDevice');
    return new Promise((res, rej) => {
      // 连续发起请求 确认大循环
      const codes = getRandomCodes({ SSID: ssid, password: password, pks: this.specialProductKeys });
      let codeStr = '';
      codes.map(item => {
        codeStr += `${item},`
      })
      codeStr = codeStr.substring(0, codeStr.length - 1);
      console.log('searchDevice', codeStr);
      const query = async () => {
        if (this.disableSearchDevice) {
          return;
        }
        const data: any = await request(`/app/device_register?random_codes=${codeStr}`, { method: 'get' });
        console.log('query randomcode', data);
        if (data.success) {
          if (data.data.length === 0) {
            // 重新请求
            await sleep(3000);
            query();
          } else {
            // 搜索到设备
            res({
              success: true,
              data: data.data
            } as IResult);
          }
        } else {
          rej({
            success: false,
            err: {
              errorCode: errorCode.API_ERROR,
              errorMessage: 'api error',
            },
          } as IResult);
        }
      }
      query();
    });
  }

  /**
   * 配网接口
   * setDeviceOnboardingDeploy方法不可重复调用
   */
  setDeviceOnboardingDeploy = ({
    ssid, password, timeout, isBind = true, softAPSSIDPrefix }: ISetDeviceOnboardingDeployProps): Promise<IResult> => {
    this.clean();
    return new Promise((res, rej) => {
      if (this.timeoutHandler) {
        // 方法还在执行中
        rej({
          success: false,
          err: {
            errorCode: errorCode.EXECUTING,
            errorMessage: 'executing',
          }
        } as IResult);
        return;
      }
      this.setDeviceOnboardingDeployRej = rej;
      this.disableSearchDevice = false;
      /**
       * 设置超时时间
       */
      this.timeoutHandler = setTimeout(() => {
        rej({
          success: false,
          err: {
            errorCode: errorCode.TIME_OUT,
            errorMessage: 'time out',
          } as IErr
        } as IResult);
        this.clean();
      }, timeout * 1000);

      /**
       * 发现设备
       * 注册onFoundService 监听发现回掉
       */
      this.onFoundService = async (data: any) => {
        // 找到服务 发送指令 
        console.log('onLocalServiceFound', data);
        // 停止发现
        this.onFoundService = null;
        const result = await this.configDevice({ ssid, password, softAPSSIDPrefix }, data);
        if (result.success) {
          // 发起绑定
          if (isBind) {
            const bindData = await this.bindDevices(result.data as unknown as IDevice[]);
            if (bindData.success) {
              res({
                success: true,
                data: result.data,
              } as IResult);
            } else {
              rej({
                success: false,
                err: {
                  errorCode: errorCode.BIND_FAIL,
                  errorMessage: '绑定失败'
                }
              } as IResult);
            }
          } else {
            rej({
              success: true,
              data: result.data,
            } as IResult);
          }

        } else {
          // 解析错误码
          rej(result);
        }
      }

      wx.stopLocalServiceDiscovery({
        complete: () => {
          wx.startLocalServiceDiscovery({
            serviceType: '_local._udp',
            success: (data) => {
              // 调用发现成功
              console.log('找到MDNS服务', data);
            },
            fail: (err) => {
              // 调用发现失败
              console.log(err);
              res({
                success: false,
                err: {
                  errorCode: errorCode.WECHAT_ERROR,
                  errorMessage: err.errMsg
                }
              } as IResult);
            },
          });
        }
      });
    });
  }

  /**
   * 绑定多个设备
   */
  bindDevices = (devices: IDevice[]): Promise<IResult> => {
    return new Promise(async (res) => {
      const promises: Promise<IResult>[] = [];

      let timestamp = Date.parse(`${new Date()}`);
      timestamp = timestamp / 1000;

      devices.map(item => {

        const index = this.specialProductKeys.findIndex(pk => item.product_key === pk);
        if (index === -1) return;
        const ps = this.specialProductKeySecrets[index];
        const promise = request(
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
        promises.push(promise);
      });

      const data = await Promise.all(promises);
      console.log('Promise.all', data);
      const returnData: any = [];
      data.map((item: any) => {
        if (item.success) {
          returnData.push(item.data);
        }
      })
      res({
        success: true,
        data: returnData,
      });
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
    this.onFoundService = null;
    wx.stopLocalServiceDiscovery();
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
      this.clean();
    }
  }
}

// const sdk = new SDK({appID: '', appSecret: ''});
// sdk.sendConfig({ssid: 'gizwits', password: 'giz$2025'}, {} as any);
export default SDK;

export { IResult };
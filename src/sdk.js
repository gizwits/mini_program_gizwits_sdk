"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errorCode_1 = require("./errorCode");
const randomCode_1 = require("./randomCode");
const global_1 = require("./global");
const openApiRequest_1 = require("./openApiRequest");
const sleep_1 = require("./sleep");
const MD5 = require("./md5");
class SDK {
    constructor({ appID, appSecret, specialProductKeys, specialProductKeySecrets, cloudServiceInfo, token, uid }) {
        this.appID = '';
        this.appSecret = '';
        this.token = '';
        this.uid = '';
        this.UDPSocket = null;
        this.disableSendUDP = false;
        this.timeout = null;
        this.specialProductKeys = [];
        this.specialProductKeySecrets = [];
        this.disableSearchDevice = false;
        this.setDomain = (cloudServiceInfo) => {
            if (cloudServiceInfo && cloudServiceInfo.openAPIInfo) {
            }
            else {
                cloudServiceInfo = {
                    openAPIInfo: 'api.gizwits.com',
                };
            }
            global_1.setGlobalData('cloudServiceInfo', cloudServiceInfo);
        };
        this.configDevice = ({ ssid, password, softAPSSIDPrefix }, target) => {
            return new Promise((res) => {
                console.log('start config device');
                let onNetworkFlag = true;
                const header = [0, 0, 0, 3];
                let length = [];
                const flag = [0];
                const cmd = [0, 1];
                const ssidLength = [0, ssid.length];
                const passwordLength = [0, password.length];
                let ASSID = [];
                for (let i = 0; i < ssid.length; i++) {
                    ASSID.push(ssid[i].charCodeAt(0));
                }
                let APassword = [];
                for (let i = 0; i < password.length; i++) {
                    APassword.push(password[i].charCodeAt(0));
                }
                const content = flag.concat(cmd, ssidLength, ASSID, passwordLength, APassword);
                let contentLength = content.length;
                while (contentLength > 0) {
                    length.push(contentLength);
                    contentLength -= 255;
                }
                const config = header.concat(length).concat(content);
                console.log('发送指令给设备', config);
                const buffer = new ArrayBuffer(config.length);
                const uint8Array = new Uint8Array(buffer);
                for (let i = 0; i < buffer.byteLength; i++) {
                    uint8Array[i] = config[i];
                }
                this.UDPSocket = wx.createUDPSocket();
                this.UDPSocket.bind();
                this.disableSendUDP = false;
                const query = () => {
                    if (this.disableSendUDP)
                        return;
                    console.log('send udp');
                    this.UDPSocket.send({
                        address: target.ip,
                        port: target.port,
                        message: uint8Array,
                        offset: 0,
                        length: uint8Array.byteLength,
                    });
                    setTimeout(() => {
                        query();
                    }, 2000);
                };
                query();
                this.UDPSocket.onError((data) => {
                    console.log('on udp Error', data);
                    this.clean();
                    res({
                        success: false,
                        err: {
                            errorCode: errorCode_1.default.WECHAT_ERROR,
                            errorMessage: data.errMsg
                        }
                    });
                });
                const searchDeviceHandle = async () => {
                    console.log('searchDeviceHandle');
                    this.UDPSocket.offMessage();
                    this.UDPSocket.offError();
                    this.disableSendUDP = true;
                    onNetworkFlag = false;
                    const devicesReturn = await this.searchDevice({ ssid, password });
                    console.log('searchDeviceHandle', devicesReturn);
                    res(devicesReturn);
                };
                this.UDPSocket.onMessage((data) => {
                    console.log('on udp Message', data);
                    searchDeviceHandle();
                });
                wx.onNetworkStatusChange(async () => {
                    onNetworkFlag && wx.getConnectedWifi({
                        success: async (data) => {
                            if (data.wifi.SSID.indexOf(softAPSSIDPrefix) === -1) {
                                searchDeviceHandle();
                            }
                        }
                    });
                });
            });
        };
        this.searchDevice = async ({ ssid, password }) => {
            console.log('searchDevice');
            return new Promise((res) => {
                const codes = randomCode_1.default({ SSID: ssid, password: password, pks: this.specialProductKeys });
                let codeStr = '';
                codes.map(item => {
                    codeStr += `${item},`;
                });
                codeStr = codeStr.substring(0, codeStr.length - 1);
                console.log('searchDevice', codeStr);
                const query = async () => {
                    if (this.disableSearchDevice) {
                        return;
                    }
                    const data = await openApiRequest_1.default(`/app/device_register?random_codes=${codeStr}`, { method: 'get' });
                    console.log('query randomcode', data);
                    if (data.success) {
                        if (data.data.length === 0) {
                            await sleep_1.default(3000);
                            query();
                        }
                        else {
                            res({
                                success: true,
                                data: data.data
                            });
                        }
                    }
                    else {
                        res({
                            success: false,
                            err: {
                                errorCode: errorCode_1.default.API_ERROR,
                                errorMessage: 'api error',
                            },
                        });
                    }
                };
                query();
            });
        };
        this.setDeviceOnboardingDeploy = ({ ssid, password, timeout, isBind = true, softAPSSIDPrefix }) => {
            this.clean();
            return new Promise((res) => {
                if (this.timeout) {
                    res({
                        success: false,
                        err: {
                            errorCode: errorCode_1.default.EXECUTING,
                            errorMessage: 'executing',
                        }
                    });
                    return;
                }
                this.mainRes = res;
                this.disableSearchDevice = false;
                this.timeout = setTimeout(() => {
                    res({
                        success: false,
                        err: {
                            errorCode: errorCode_1.default.TIME_OUT,
                            errorMessage: 'time out',
                        }
                    });
                    this.clean();
                }, timeout * 1000);
                this.callBack = async (data) => {
                    console.log('onLocalServiceFound', data);
                    this.callBack = null;
                    const result = await this.configDevice({ ssid, password, softAPSSIDPrefix }, data);
                    if (result.success) {
                        if (isBind) {
                            const bindData = await this.bindDevices(result.data);
                            if (bindData.success) {
                                res({
                                    success: true,
                                    data: result.data,
                                });
                            }
                            else {
                                res({
                                    success: false,
                                    err: {
                                        errorCode: errorCode_1.default.BIND_FAIL,
                                        errorMessage: '绑定失败'
                                    }
                                });
                            }
                        }
                        else {
                            res({
                                success: true,
                                data: result.data,
                            });
                        }
                    }
                    else {
                    }
                };
                wx.stopLocalServiceDiscovery({
                    complete: () => {
                        wx.startLocalServiceDiscovery({
                            serviceType: '_local._udp',
                            success: (data) => {
                                console.log('找到MDNS服务', data);
                            },
                            fail: (err) => {
                                console.log(err);
                                res({
                                    success: false,
                                    err: {
                                        errorCode: errorCode_1.default.WECHAT_ERROR,
                                        errorMessage: err.errMsg
                                    }
                                });
                            },
                        });
                    }
                });
            });
        };
        this.bindDevices = (devices) => {
            return new Promise(async (res) => {
                const promises = [];
                let timestamp = Date.parse(`${new Date()}`);
                timestamp = timestamp / 1000;
                devices.map(item => {
                    const index = this.specialProductKeys.findIndex(pk => item.product_key === pk);
                    if (index === -1)
                        return;
                    const ps = this.specialProductKeySecrets[index];
                    const promise = openApiRequest_1.default('/app/bind_mac', {
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
                    });
                    promises.push(promise);
                });
                const data = await Promise.all(promises);
                console.log('Promise.all', data);
                const returnData = [];
                data.map((item) => {
                    if (item.success) {
                        returnData.push(item.data);
                    }
                });
                res({
                    success: true,
                    data: returnData,
                });
            });
        };
        this.clean = () => {
            clearTimeout(this.timeout);
            this.timeout = null;
            this.mainRes = null;
            this.callBack = null;
            wx.stopLocalServiceDiscovery();
            this.disableSearchDevice = true;
            if (this.UDPSocket) {
                this.UDPSocket.offError();
                this.UDPSocket.offMessage();
                this.UDPSocket.close();
            }
        };
        this.stopDeviceOnboardingDeploy = () => {
            if (this.mainRes) {
                this.mainRes({
                    success: false,
                    err: {
                        errorCode: errorCode_1.default.STOP,
                        errorMessage: '手动停止'
                    }
                });
                this.clean();
            }
        };
        this.appID = appID;
        this.appSecret = appSecret;
        this.specialProductKeys = specialProductKeys;
        this.specialProductKeySecrets = specialProductKeySecrets;
        this.token = token;
        this.uid = uid;
        global_1.setGlobalData('appID', appID);
        global_1.setGlobalData('appSecret', appSecret);
        global_1.setGlobalData('specialProductKeys', specialProductKeys);
        global_1.setGlobalData('specialProductKeySecrets', specialProductKeySecrets);
        global_1.setGlobalData('token', token);
        global_1.setGlobalData('uid', uid);
        this.setDomain(cloudServiceInfo);
        wx.onLocalServiceFound((data) => {
            this.callBack && this.callBack(data);
        });
    }
}
exports.default = SDK;

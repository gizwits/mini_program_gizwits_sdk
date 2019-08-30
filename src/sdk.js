"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const errorCode_1 = require("./errorCode");
const randomCode_1 = require("./randomCode");
const global_1 = require("./global");
const openApiRequest_1 = require("./openApiRequest");
const MD5 = require("./md5");
const sleep_1 = require("./sleep");
class SDK {
    constructor({ appID, appSecret, specialProductKeys, specialProductKeySecrets, cloudServiceInfo, token, uid }) {
        this.appID = '';
        this.appSecret = '';
        this.token = '';
        this.uid = '';
        this.UDPSocket = null;
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
                const buffer = new ArrayBuffer(config.length);
                const uint8Array = new Uint8Array(buffer);
                for (let i = 0; i < buffer.byteLength; i++) {
                    uint8Array[i] = config[i];
                }
                this.UDPSocket = wx.createUDPSocket();
                this.UDPSocket.bind();
                this.UDPInterval = setInterval(() => {
                    console.log('send udp');
                    this.UDPSocket.send({
                        address: target.ip,
                        port: target.port,
                        message: uint8Array,
                        offset: 0,
                        length: uint8Array.byteLength,
                    });
                }, 1000);
                this.UDPSocket.onError((data) => {
                    console.log('on udp Error', data);
                    clearInterval(this.UDPInterval);
                    this.clean();
                    res({
                        success: false,
                        err: {
                            errorCode: errorCode_1.default.WECHAT_ERROR,
                            errorMessage: data.errMsg
                        }
                    });
                });
                const searchDeviceHandle = () => __awaiter(this, void 0, void 0, function* () {
                    console.log('searchDeviceHandle');
                    this.UDPSocket.offMessage();
                    this.UDPSocket.offError();
                    clearInterval(this.UDPInterval);
                    onNetworkFlag = false;
                    const devicesReturn = yield this.searchDevice({ ssid, password });
                    console.log('searchDeviceHandle', devicesReturn);
                    res(devicesReturn);
                });
                this.UDPSocket.onMessage((data) => __awaiter(this, void 0, void 0, function* () {
                    console.log('on udp Message', data);
                    searchDeviceHandle();
                }));
                wx.onNetworkStatusChange(() => __awaiter(this, void 0, void 0, function* () {
                    onNetworkFlag && wx.getConnectedWifi({
                        success: (data) => __awaiter(this, void 0, void 0, function* () {
                            if (data.wifi.SSID.indexOf(softAPSSIDPrefix) === -1) {
                                searchDeviceHandle();
                            }
                        })
                    });
                }));
            });
        };
        this.searchDevice = ({ ssid, password }) => __awaiter(this, void 0, void 0, function* () {
            return new Promise((res) => {
                const codes = randomCode_1.default({ SSID: ssid, password: password, pks: this.specialProductKeys });
                console.log('getRandomCodes', codes);
                let codeStr = '';
                codes.map(item => {
                    codeStr += `${item},`;
                });
                codeStr = codeStr.substring(0, codeStr.length - 1);
                const query = () => __awaiter(this, void 0, void 0, function* () {
                    if (this.disableSearchDevice) {
                        return;
                    }
                    const data = yield openApiRequest_1.default(`/app/device_register?random_codes=${codeStr}`, { method: 'get' });
                    if (data.success) {
                        if (data.data.length === 0) {
                            yield sleep_1.default(3000);
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
                });
                query();
            });
        });
        this.setDeviceOnboardingDeploy = ({ ssid, password, timeout, isBind = true, softAPSSIDPrefix }) => {
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
                wx.onLocalServiceFound((data) => __awaiter(this, void 0, void 0, function* () {
                    console.log('onLocalServiceFound', data);
                    wx.offLocalServiceFound(() => { });
                    const result = yield this.configDevice({ ssid, password, softAPSSIDPrefix }, data);
                    if (result.success) {
                        if (isBind) {
                            const bindData = yield this.bindDevices(result.data);
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
                    this.clean();
                }));
                wx.stopLocalServiceDiscovery({
                    complete: () => {
                        wx.startLocalServiceDiscovery({
                            serviceType: '_example._udp',
                            success: (data) => {
                                console.log(data);
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
            return new Promise((res) => __awaiter(this, void 0, void 0, function* () {
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
                const data = yield Promise.all(promises);
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
            }));
        };
        this.clean = () => {
            clearTimeout(this.timeout);
            this.timeout = null;
            clearInterval(this.UDPInterval);
            this.UDPInterval = null;
            this.mainRes = null;
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
    }
}
exports.default = SDK;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2RrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyQ0FBb0M7QUFDcEMsNkNBQTBDO0FBQzFDLHFDQUF5QztBQUN6QyxxREFBdUM7QUFDdkMsNkJBQThCO0FBQzlCLG1DQUE0QjtBQXdFNUIsTUFBTSxHQUFHO0lBQ1AsWUFBWSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsa0JBQWtCLEVBQUUsd0JBQXdCLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBVTtRQXNCcEgsVUFBSyxHQUFXLEVBQUUsQ0FBQztRQUNuQixjQUFTLEdBQVcsRUFBRSxDQUFDO1FBQ3ZCLFVBQUssR0FBVyxFQUFFLENBQUM7UUFDbkIsUUFBRyxHQUFXLEVBQUUsQ0FBQztRQUNqQixjQUFTLEdBQVEsSUFBSSxDQUFDO1FBRXRCLFlBQU8sR0FBUSxJQUFJLENBQUM7UUFDcEIsdUJBQWtCLEdBQWEsRUFBRSxDQUFDO1FBQ2xDLDZCQUF3QixHQUFhLEVBQUUsQ0FBQztRQUl4Qyx3QkFBbUIsR0FBWSxLQUFLLENBQUM7UUFNckMsY0FBUyxHQUFHLENBQUMsZ0JBQTBDLEVBQUUsRUFBRTtZQUN6RCxJQUFJLGdCQUFnQixJQUFJLGdCQUFnQixDQUFDLFdBQVcsRUFBRTthQUVyRDtpQkFBTTtnQkFDTCxnQkFBZ0IsR0FBRztvQkFDakIsV0FBVyxFQUFFLGlCQUFpQjtpQkFDL0IsQ0FBQzthQUNIO1lBQ0Qsc0JBQWEsQ0FBQyxrQkFBa0IsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3RELENBQUMsQ0FBQTtRQUtELGlCQUFZLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLEVBQWlFLEVBQUUsTUFBZSxFQUFPLEVBQUU7WUFDM0ksT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO2dCQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7Z0JBQ25DLElBQUksYUFBYSxHQUFHLElBQUksQ0FBQztnQkFFekIsTUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDNUIsSUFBSSxNQUFNLEdBQWEsRUFBRSxDQUFDO2dCQUMxQixNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNqQixNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbkIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNwQyxNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBRTVDLElBQUksS0FBSyxHQUFhLEVBQUUsQ0FBQztnQkFDekIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7b0JBQ3BDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUNuQztnQkFFRCxJQUFJLFNBQVMsR0FBYSxFQUFFLENBQUM7Z0JBQzdCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUN4QyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDM0M7Z0JBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBRy9FLElBQUksYUFBYSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7Z0JBQ25DLE9BQU8sYUFBYSxHQUFHLENBQUMsRUFBRTtvQkFDeEIsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztvQkFDM0IsYUFBYSxJQUFJLEdBQUcsQ0FBQztpQkFDdEI7Z0JBRUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3JELE1BQU0sTUFBTSxHQUFHLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDOUMsTUFBTSxVQUFVLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUE7Z0JBQ3pDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUMxQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUMzQjtnQkFJRCxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFFdEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFO29CQUNsQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUN4QixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQzt3QkFDbEIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxFQUFFO3dCQUNsQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7d0JBQ2pCLE9BQU8sRUFBRSxVQUFVO3dCQUNuQixNQUFNLEVBQUUsQ0FBQzt3QkFDVCxNQUFNLEVBQUUsVUFBVSxDQUFDLFVBQVU7cUJBQzlCLENBQUMsQ0FBQztnQkFDTCxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBRVQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRTtvQkFDbkMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBRWxDLGFBQWEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQ2hDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDYixHQUFHLENBQUM7d0JBQ0YsT0FBTyxFQUFFLEtBQUs7d0JBQ2QsR0FBRyxFQUFFOzRCQUNILFNBQVMsRUFBRSxtQkFBUyxDQUFDLFlBQVk7NEJBQ2pDLFlBQVksRUFBRSxJQUFJLENBQUMsTUFBTTt5QkFDMUI7cUJBQ1MsQ0FBQyxDQUFDO2dCQUNoQixDQUFDLENBQUMsQ0FBQztnQkFHSCxNQUFNLGtCQUFrQixHQUFHLEdBQVMsRUFBRTtvQkFDcEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO29CQUNsQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDO29CQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUMxQixhQUFhLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO29CQUVoQyxhQUFhLEdBQUcsS0FBSyxDQUFDO29CQUV0QixNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztvQkFDbEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxhQUFhLENBQUMsQ0FBQztvQkFDakQsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNyQixDQUFDLENBQUEsQ0FBQTtnQkFFRCxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFPLElBQVMsRUFBRSxFQUFFO29CQUMzQyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxDQUFDO29CQUVwQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUN2QixDQUFDLENBQUEsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxHQUFTLEVBQUU7b0JBRWxDLGFBQWEsSUFBSSxFQUFFLENBQUMsZ0JBQWdCLENBQUM7d0JBQ25DLE9BQU8sRUFBRSxDQUFPLElBQUksRUFBRSxFQUFFOzRCQUl0QixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO2dDQUNuRCxrQkFBa0IsRUFBRSxDQUFDOzZCQUN0Qjt3QkFDSCxDQUFDLENBQUE7cUJBQ0YsQ0FBQyxDQUFDO2dCQUVMLENBQUMsQ0FBQSxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQTtRQUtELGlCQUFZLEdBQUcsQ0FBTyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO1lBQzFDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFFekIsTUFBTSxLQUFLLEdBQUcsb0JBQWMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztnQkFDL0YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDckMsSUFBSSxPQUFPLEdBQUcsRUFBRSxDQUFDO2dCQUNqQixLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNmLE9BQU8sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFBO2dCQUN2QixDQUFDLENBQUMsQ0FBQTtnQkFDRixPQUFPLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDbkQsTUFBTSxLQUFLLEdBQUcsR0FBUyxFQUFFO29CQUN2QixJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFBRTt3QkFDNUIsT0FBTztxQkFDUjtvQkFDRCxNQUFNLElBQUksR0FBRyxNQUFNLHdCQUFPLENBQUMscUNBQXFDLE9BQU8sRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7b0JBQzlGLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTt3QkFDaEIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7NEJBRXhCLE1BQU0sZUFBSyxDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUNsQixLQUFLLEVBQUUsQ0FBQzt5QkFDWDs2QkFBTTs0QkFFTCxHQUFHLENBQUM7Z0NBQ0YsT0FBTyxFQUFFLElBQUk7Z0NBQ2IsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJOzZCQUNMLENBQUMsQ0FBQzt5QkFDZjtxQkFDRjt5QkFBTTt3QkFDTCxHQUFHLENBQUM7NEJBQ0YsT0FBTyxFQUFFLEtBQUs7NEJBQ2QsR0FBRyxFQUFFO2dDQUNILFNBQVMsRUFBRSxtQkFBUyxDQUFDLFNBQVM7Z0NBQzlCLFlBQVksRUFBRSxXQUFXOzZCQUMxQjt5QkFDUyxDQUFDLENBQUM7cUJBQ2Y7Z0JBQ0gsQ0FBQyxDQUFBLENBQUE7Z0JBQ0QsS0FBSyxFQUFFLENBQUM7WUFDVixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQSxDQUFBO1FBTUQsOEJBQXlCLEdBQUcsQ0FBQyxFQUMzQixJQUFJLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxNQUFNLEdBQUcsSUFBSSxFQUFFLGdCQUFnQixFQUFtQyxFQUFPLEVBQUU7WUFDcEcsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO2dCQUN6QixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7b0JBRWhCLEdBQUcsQ0FBQzt3QkFDRixPQUFPLEVBQUUsS0FBSzt3QkFDZCxHQUFHLEVBQUU7NEJBQ0gsU0FBUyxFQUFFLG1CQUFTLENBQUMsU0FBUzs0QkFDOUIsWUFBWSxFQUFFLFdBQVc7eUJBQzFCO3FCQUNTLENBQUMsQ0FBQztvQkFDZCxPQUFPO2lCQUNSO2dCQUNELElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDO2dCQUNuQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsS0FBSyxDQUFDO2dCQUlqQyxJQUFJLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUU7b0JBRTdCLEdBQUcsQ0FBQzt3QkFDRixPQUFPLEVBQUUsS0FBSzt3QkFDZCxHQUFHLEVBQUU7NEJBQ0gsU0FBUyxFQUFFLG1CQUFTLENBQUMsUUFBUTs0QkFDN0IsWUFBWSxFQUFFLFVBQVU7eUJBQ2pCO3FCQUNDLENBQUMsQ0FBQztvQkFDZCxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2YsQ0FBQyxFQUFFLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQztnQkFLbkIsRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQU8sSUFBUyxFQUFFLEVBQUU7b0JBRXpDLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBRXpDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLEVBQUUsR0FBRSxDQUFDLENBQUMsQ0FBQztvQkFDbEMsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUNuRixJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUU7d0JBRWxCLElBQUksTUFBTSxFQUFFOzRCQUNWLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7NEJBQ3JELElBQUksUUFBUSxDQUFDLE9BQU8sRUFBRTtnQ0FDcEIsR0FBRyxDQUFDO29DQUNGLE9BQU8sRUFBRSxJQUFJO29DQUNiLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtpQ0FDUCxDQUFDLENBQUM7NkJBQ2Y7aUNBQU07Z0NBQ0wsR0FBRyxDQUFDO29DQUNGLE9BQU8sRUFBRSxLQUFLO29DQUNkLEdBQUcsRUFBRTt3Q0FDSCxTQUFTLEVBQUUsbUJBQVMsQ0FBQyxTQUFTO3dDQUM5QixZQUFZLEVBQUUsTUFBTTtxQ0FDckI7aUNBQ1MsQ0FBQyxDQUFDOzZCQUNmO3lCQUNGOzZCQUFNOzRCQUNMLEdBQUcsQ0FBQztnQ0FDRixPQUFPLEVBQUUsSUFBSTtnQ0FDYixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7NkJBQ1AsQ0FBQyxDQUFDO3lCQUNmO3FCQUVGO3lCQUFNO3FCQUVOO29CQUNELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDZixDQUFDLENBQUEsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQztvQkFDM0IsUUFBUSxFQUFFLEdBQUcsRUFBRTt3QkFDYixFQUFFLENBQUMsMEJBQTBCLENBQUM7NEJBQzVCLFdBQVcsRUFBRSxlQUFlOzRCQUM1QixPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQ0FFaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQzs0QkFDcEIsQ0FBQzs0QkFDRCxJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQ0FFWixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dDQUNqQixHQUFHLENBQUM7b0NBQ0YsT0FBTyxFQUFFLEtBQUs7b0NBQ2QsR0FBRyxFQUFFO3dDQUNILFNBQVMsRUFBRSxtQkFBUyxDQUFDLFlBQVk7d0NBQ2pDLFlBQVksRUFBRSxHQUFHLENBQUMsTUFBTTtxQ0FDekI7aUNBQ1MsQ0FBQyxDQUFDOzRCQUNoQixDQUFDO3lCQUNGLENBQUMsQ0FBQztvQkFDTCxDQUFDO2lCQUNGLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFBO1FBS0QsZ0JBQVcsR0FBRyxDQUFDLE9BQWtCLEVBQVEsRUFBRTtZQUN6QyxPQUFPLElBQUksT0FBTyxDQUFDLENBQU8sR0FBRyxFQUFFLEVBQUU7Z0JBQy9CLE1BQU0sUUFBUSxHQUFTLEVBQUUsQ0FBQztnQkFFMUIsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QyxTQUFTLEdBQUcsU0FBUyxHQUFHLElBQUksQ0FBQztnQkFFN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFFakIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEtBQUssRUFBRSxDQUFDLENBQUM7b0JBQy9FLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQzt3QkFBRSxPQUFPO29CQUN6QixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ2hELE1BQU0sT0FBTyxHQUFHLHdCQUFPLENBQ3JCLGVBQWUsRUFDZjt3QkFDRSxNQUFNLEVBQUUsTUFBTTt3QkFDZCxPQUFPLEVBQUU7NEJBQ1AscUJBQXFCLEVBQUUsU0FBUzs0QkFDaEMscUJBQXFCLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFO3lCQUM5RDt3QkFDRCxJQUFJLEVBQUU7NEJBQ0osYUFBYSxFQUFFLElBQUksQ0FBQyxXQUFXOzRCQUMvQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUc7NEJBQ2YsUUFBUSxFQUFFLEVBQUU7NEJBQ1osV0FBVyxFQUFFLEVBQUU7eUJBQ2pCO3FCQUNELENBQ0YsQ0FBQztvQkFDRixRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN6QixDQUFDLENBQUMsQ0FBQztnQkFFSCxNQUFNLElBQUksR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3pDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxNQUFNLFVBQVUsR0FBUSxFQUFFLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRTtvQkFDckIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO3dCQUNoQixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDNUI7Z0JBQ0gsQ0FBQyxDQUFDLENBQUE7Z0JBQ0YsR0FBRyxDQUFDO29CQUNGLE9BQU8sRUFBRSxJQUFJO29CQUNiLElBQUksRUFBRSxVQUFVO2lCQUNqQixDQUFDLENBQUM7WUFDTCxDQUFDLENBQUEsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFBO1FBS0QsVUFBSyxHQUFHLEdBQUcsRUFBRTtZQUNYLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDM0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7WUFDcEIsYUFBYSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNoQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztZQUN4QixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztZQUNwQixFQUFFLENBQUMseUJBQXlCLEVBQUUsQ0FBQztZQUMvQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO1lBQ2hDLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtnQkFDbEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDMUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQzthQUN4QjtRQUNILENBQUMsQ0FBQTtRQUtELCtCQUEwQixHQUFHLEdBQUcsRUFBRTtZQUNoQyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ2hCLElBQUksQ0FBQyxPQUFPLENBQUM7b0JBQ1gsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsR0FBRyxFQUFFO3dCQUNILFNBQVMsRUFBRSxtQkFBUyxDQUFDLElBQUk7d0JBQ3pCLFlBQVksRUFBRSxNQUFNO3FCQUNyQjtpQkFDRixDQUFDLENBQUM7Z0JBQ0gsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2FBQ2Q7UUFDSCxDQUFDLENBQUE7UUEvWEMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDO1FBQzdDLElBQUksQ0FBQyx3QkFBd0IsR0FBRyx3QkFBd0IsQ0FBQztRQUN6RCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUVmLHNCQUFhLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzlCLHNCQUFhLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3RDLHNCQUFhLENBQUMsb0JBQW9CLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUN4RCxzQkFBYSxDQUFDLDBCQUEwQixFQUFFLHdCQUF3QixDQUFDLENBQUM7UUFDcEUsc0JBQWEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUIsc0JBQWEsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFNMUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ25DLENBQUM7Q0E2V0Y7QUFJRCxrQkFBZSxHQUFHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZXJyb3JDb2RlIGZyb20gXCIuL2Vycm9yQ29kZVwiO1xuaW1wb3J0IGdldFJhbmRvbUNvZGVzIGZyb20gXCIuL3JhbmRvbUNvZGVcIjtcbmltcG9ydCB7IHNldEdsb2JhbERhdGEgfSBmcm9tIFwiLi9nbG9iYWxcIjtcbmltcG9ydCByZXF1ZXN0IGZyb20gXCIuL29wZW5BcGlSZXF1ZXN0XCI7XG5pbXBvcnQgTUQ1ID0gcmVxdWlyZSgnLi9tZDUnKTtcbmltcG9ydCBzbGVlcCBmcm9tICcuL3NsZWVwJztcblxuaW50ZXJmYWNlIElTZXREZXZpY2VPbmJvYXJkaW5nRGVwbG95UHJvcHMge1xuICBzc2lkOiBzdHJpbmc7XG4gIHBhc3N3b3JkOiBzdHJpbmc7XG4gIHRpbWVvdXQ6IG51bWJlcjtcbiAgaXNCaW5kPzogYm9vbGVhbjtcbiAgc29mdEFQU1NJRFByZWZpeDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSURldmljZSB7XG4gIG1hYzogc3RyaW5nO1xuICBwcm9kdWN0X2tleTogc3RyaW5nO1xuICBkaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBzbm8/OiBzdHJpbmc7XG4gIG1hbnVmYWN0dXJlcj86IGFueTtcbiAgYWxpYXM/OiBzdHJpbmc7XG4gIG9ubGluZVN0YXR1czogYm9vbGVhbjtcbiAgbmV0U3RhdHVzOiBudW1iZXI7XG4gIGlzU3Vic2NyaWJlZD86IGJvb2xlYW47XG4gIG1lc2hJRD86IHN0cmluZztcbiAgaXNCaW5kPzogYm9vbGVhbjtcbiAgaXNPbmxpbmU/OiBib29sZWFuO1xuICByZW1hcms/OiBzdHJpbmc7XG4gIHNpdGVHaWQ6IHN0cmluZztcbiAgaWQ/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJRXJyIHtcbiAgZXJyb3JDb2RlOiBTeW1ib2w7XG4gIGVycm9yTWVzc2FnZTogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSVJlc3VsdCB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIGRhdGE/OiBJRGV2aWNlIHwgbnVsbDtcbiAgZXJyPzogSUVycjtcbn1cblxuaW50ZXJmYWNlIElUYXJnZXQge1xuICBzZXJ2aWNlVHlwZTogc3RyaW5nO1xuICBzZXJ2aWNlTmFtZTogc3RyaW5nO1xuICBpcDogc3RyaW5nO1xuICBwb3J0OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBJU0RLIHtcbiAgYXBwSUQ6IHN0cmluZztcbiAgYXBwU2VjcmV0OiBzdHJpbmc7XG4gIHRpbWVvdXQ6IGFueTtcbiAgVURQSW50ZXJ2YWw6IGFueTtcbiAgY29uZmlnRGV2aWNlKHsgc3NpZCwgcGFzc3dvcmQgfTogeyBzc2lkOiBzdHJpbmc7IHBhc3N3b3JkOiBzdHJpbmcgfSwgdGFyZ2V0OiBJVGFyZ2V0KTogYW55O1xuICBzZXREZXZpY2VPbmJvYXJkaW5nRGVwbG95KHtcbiAgICBzc2lkLCBwYXNzd29yZCwgdGltZW91dCwgaXNCaW5kIH06IElTZXREZXZpY2VPbmJvYXJkaW5nRGVwbG95UHJvcHMpOiBhbnk7XG4gIHN0b3BEZXZpY2VPbmJvYXJkaW5nRGVwbG95KCk6IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJQ2xvdWRTZXJ2aWNlSW5mbyB7XG4gIG9wZW5BUElJbmZvOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJUHJvcHMge1xuICBhcHBJRDogc3RyaW5nO1xuICBhcHBTZWNyZXQ6IHN0cmluZztcbiAgc3BlY2lhbFByb2R1Y3RLZXlzOiBzdHJpbmdbXTtcbiAgc3BlY2lhbFByb2R1Y3RLZXlTZWNyZXRzOiBzdHJpbmdbXTtcbiAgY2xvdWRTZXJ2aWNlSW5mbzogSUNsb3VkU2VydmljZUluZm98IG51bGw7XG4gIHRva2VuOiBzdHJpbmc7XG4gIHVpZDogc3RyaW5nO1xufVxuXG5jbGFzcyBTREsgaW1wbGVtZW50cyBJU0RLIHtcbiAgY29uc3RydWN0b3IoeyBhcHBJRCwgYXBwU2VjcmV0LCBzcGVjaWFsUHJvZHVjdEtleXMsIHNwZWNpYWxQcm9kdWN0S2V5U2VjcmV0cywgY2xvdWRTZXJ2aWNlSW5mbywgdG9rZW4sIHVpZCB9OiBJUHJvcHMpIHtcbiAgICB0aGlzLmFwcElEID0gYXBwSUQ7XG4gICAgdGhpcy5hcHBTZWNyZXQgPSBhcHBTZWNyZXQ7XG4gICAgdGhpcy5zcGVjaWFsUHJvZHVjdEtleXMgPSBzcGVjaWFsUHJvZHVjdEtleXM7XG4gICAgdGhpcy5zcGVjaWFsUHJvZHVjdEtleVNlY3JldHMgPSBzcGVjaWFsUHJvZHVjdEtleVNlY3JldHM7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMudWlkID0gdWlkO1xuXG4gICAgc2V0R2xvYmFsRGF0YSgnYXBwSUQnLCBhcHBJRCk7XG4gICAgc2V0R2xvYmFsRGF0YSgnYXBwU2VjcmV0JywgYXBwU2VjcmV0KTtcbiAgICBzZXRHbG9iYWxEYXRhKCdzcGVjaWFsUHJvZHVjdEtleXMnLCBzcGVjaWFsUHJvZHVjdEtleXMpO1xuICAgIHNldEdsb2JhbERhdGEoJ3NwZWNpYWxQcm9kdWN0S2V5U2VjcmV0cycsIHNwZWNpYWxQcm9kdWN0S2V5U2VjcmV0cyk7XG4gICAgc2V0R2xvYmFsRGF0YSgndG9rZW4nLCB0b2tlbik7XG4gICAgc2V0R2xvYmFsRGF0YSgndWlkJywgdWlkKTtcblxuXG4gICAgLyoqXG4gICAgICog5ZCM5pe25Lmf6K6+572u5Z+f5ZCN5L+h5oGvXG4gICAgICovXG4gICAgdGhpcy5zZXREb21haW4oY2xvdWRTZXJ2aWNlSW5mbyk7XG4gIH1cblxuICBhcHBJRDogc3RyaW5nID0gJyc7XG4gIGFwcFNlY3JldDogc3RyaW5nID0gJyc7XG4gIHRva2VuOiBzdHJpbmcgPSAnJztcbiAgdWlkOiBzdHJpbmcgPSAnJztcbiAgVURQU29ja2V0OiBhbnkgPSBudWxsO1xuICBcbiAgdGltZW91dDogYW55ID0gbnVsbDtcbiAgc3BlY2lhbFByb2R1Y3RLZXlzOiBzdHJpbmdbXSA9IFtdO1xuICBzcGVjaWFsUHJvZHVjdEtleVNlY3JldHM6IHN0cmluZ1tdID0gW107XG5cblxuICBVRFBJbnRlcnZhbDogYW55O1xuICBkaXNhYmxlU2VhcmNoRGV2aWNlOiBib29sZWFuID0gZmFsc2U7XG4gIG1haW5SZXM6IGFueTsgLy8g5L+d5a2YcHJvbWlzZeeahHJlc++8jOeUqOS6juS4tOaXtuS4reaWrVxuXG4gIC8qKlxuICAgKiDorr7nva7ln5/lkI1cbiAgICovXG4gIHNldERvbWFpbiA9IChjbG91ZFNlcnZpY2VJbmZvOiBJQ2xvdWRTZXJ2aWNlSW5mbyB8IG51bGwpID0+IHtcbiAgICBpZiAoY2xvdWRTZXJ2aWNlSW5mbyAmJiBjbG91ZFNlcnZpY2VJbmZvLm9wZW5BUElJbmZvKSB7XG4gICAgICBcbiAgICB9IGVsc2Uge1xuICAgICAgY2xvdWRTZXJ2aWNlSW5mbyA9IHtcbiAgICAgICAgb3BlbkFQSUluZm86ICdhcGkuZ2l6d2l0cy5jb20nLFxuICAgICAgfTtcbiAgICB9XG4gICAgc2V0R2xvYmFsRGF0YSgnY2xvdWRTZXJ2aWNlSW5mbycsIGNsb3VkU2VydmljZUluZm8pO1xuICB9XG5cbiAgLyoqXG4gICAqIOi0n+i0o+WPkeaMh+S7pFxuICAgKi9cbiAgY29uZmlnRGV2aWNlID0gKHsgc3NpZCwgcGFzc3dvcmQsIHNvZnRBUFNTSURQcmVmaXggfTogeyBzc2lkOiBzdHJpbmc7IHBhc3N3b3JkOiBzdHJpbmc7IHNvZnRBUFNTSURQcmVmaXg6IHN0cmluZzsgfSwgdGFyZ2V0OiBJVGFyZ2V0KTogYW55ID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlcykgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ3N0YXJ0IGNvbmZpZyBkZXZpY2UnKTtcbiAgICAgIGxldCBvbk5ldHdvcmtGbGFnID0gdHJ1ZTtcblxuICAgICAgY29uc3QgaGVhZGVyID0gWzAsIDAsIDAsIDNdO1xuICAgICAgbGV0IGxlbmd0aDogbnVtYmVyW10gPSBbXTtcbiAgICAgIGNvbnN0IGZsYWcgPSBbMF07XG4gICAgICBjb25zdCBjbWQgPSBbMCwgMV07XG4gICAgICBjb25zdCBzc2lkTGVuZ3RoID0gWzAsIHNzaWQubGVuZ3RoXTtcbiAgICAgIGNvbnN0IHBhc3N3b3JkTGVuZ3RoID0gWzAsIHBhc3N3b3JkLmxlbmd0aF07XG5cbiAgICAgIGxldCBBU1NJRDogbnVtYmVyW10gPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3NpZC5sZW5ndGg7IGkrKykge1xuICAgICAgICBBU1NJRC5wdXNoKHNzaWRbaV0uY2hhckNvZGVBdCgwKSk7XG4gICAgICB9XG5cbiAgICAgIGxldCBBUGFzc3dvcmQ6IG51bWJlcltdID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhc3N3b3JkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIEFQYXNzd29yZC5wdXNoKHBhc3N3b3JkW2ldLmNoYXJDb2RlQXQoMCkpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb250ZW50ID0gZmxhZy5jb25jYXQoY21kLCBzc2lkTGVuZ3RoLCBBU1NJRCwgcGFzc3dvcmRMZW5ndGgsIEFQYXNzd29yZCk7XG4gICAgICAvLyBsZW5ndGggPSBjb250ZW50Lmxlbmd0aC50b1N0cmluZygxNik7XG5cbiAgICAgIGxldCBjb250ZW50TGVuZ3RoID0gY29udGVudC5sZW5ndGg7XG4gICAgICB3aGlsZSAoY29udGVudExlbmd0aCA+IDApIHtcbiAgICAgICAgbGVuZ3RoLnB1c2goY29udGVudExlbmd0aCk7XG4gICAgICAgIGNvbnRlbnRMZW5ndGggLT0gMjU1O1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWcgPSBoZWFkZXIuY29uY2F0KGxlbmd0aCkuY29uY2F0KGNvbnRlbnQpO1xuICAgICAgY29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGNvbmZpZy5sZW5ndGgpO1xuICAgICAgY29uc3QgdWludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlcilcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYnVmZmVyLmJ5dGVMZW5ndGg7IGkrKykge1xuICAgICAgICB1aW50OEFycmF5W2ldID0gY29uZmlnW2ldO1xuICAgICAgfVxuICAgICAgLyoqXG4gICAgICAgKiDov57mjqVzb2NrZXQg5Y+R6YCBXG4gICAgICAgKi9cbiAgICAgIHRoaXMuVURQU29ja2V0ID0gd3guY3JlYXRlVURQU29ja2V0KCk7XG4gICAgICB0aGlzLlVEUFNvY2tldC5iaW5kKCk7XG5cbiAgICAgIHRoaXMuVURQSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdzZW5kIHVkcCcpO1xuICAgICAgICB0aGlzLlVEUFNvY2tldC5zZW5kKHtcbiAgICAgICAgICBhZGRyZXNzOiB0YXJnZXQuaXAsXG4gICAgICAgICAgcG9ydDogdGFyZ2V0LnBvcnQsXG4gICAgICAgICAgbWVzc2FnZTogdWludDhBcnJheSxcbiAgICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgICAgbGVuZ3RoOiB1aW50OEFycmF5LmJ5dGVMZW5ndGgsXG4gICAgICAgIH0pO1xuICAgICAgfSwgMTAwMCk7XG5cbiAgICAgIHRoaXMuVURQU29ja2V0Lm9uRXJyb3IoKGRhdGE6IGFueSkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnb24gdWRwIEVycm9yJywgZGF0YSk7XG4gICAgICAgIC8vIFVEUFNvY2tldC5jbG9zZSgpO1xuICAgICAgICBjbGVhckludGVydmFsKHRoaXMuVURQSW50ZXJ2YWwpO1xuICAgICAgICB0aGlzLmNsZWFuKCk7XG4gICAgICAgIHJlcyh7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXJyOiB7XG4gICAgICAgICAgICBlcnJvckNvZGU6IGVycm9yQ29kZS5XRUNIQVRfRVJST1IsXG4gICAgICAgICAgICBlcnJvck1lc3NhZ2U6IGRhdGEuZXJyTXNnXG4gICAgICAgICAgfVxuICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIOa4heeQhuS4gOS6m+ebkeWQrO+8jOiwg+eUqOaQnOe0ouiuvuWkh1xuICAgICAgY29uc3Qgc2VhcmNoRGV2aWNlSGFuZGxlID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnc2VhcmNoRGV2aWNlSGFuZGxlJyk7XG4gICAgICAgIHRoaXMuVURQU29ja2V0Lm9mZk1lc3NhZ2UoKTtcbiAgICAgICAgdGhpcy5VRFBTb2NrZXQub2ZmRXJyb3IoKTtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLlVEUEludGVydmFsKTtcbiAgICAgICAgLy8g5qCH6K6w5Y+v5Lul5YGc5q2i55uR5ZCsXG4gICAgICAgIG9uTmV0d29ya0ZsYWcgPSBmYWxzZTtcbiAgICAgICAgLy8g5YWz6Zetc29ja2V0XG4gICAgICAgIGNvbnN0IGRldmljZXNSZXR1cm4gPSBhd2FpdCB0aGlzLnNlYXJjaERldmljZSh7IHNzaWQsIHBhc3N3b3JkIH0pO1xuICAgICAgICBjb25zb2xlLmxvZygnc2VhcmNoRGV2aWNlSGFuZGxlJywgZGV2aWNlc1JldHVybik7XG4gICAgICAgIHJlcyhkZXZpY2VzUmV0dXJuKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5VRFBTb2NrZXQub25NZXNzYWdlKGFzeW5jIChkYXRhOiBhbnkpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ29uIHVkcCBNZXNzYWdlJywgZGF0YSk7XG4gICAgICAgIC8vIOaUtuWIsOWbnuiwgyDlj6/ku6XlgZzmraLlj5HljIVcbiAgICAgICAgc2VhcmNoRGV2aWNlSGFuZGxlKCk7XG4gICAgICB9KTtcblxuICAgICAgd3gub25OZXR3b3JrU3RhdHVzQ2hhbmdlKGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8g5Y+R55Sf572R57uc5YiH5o2i55qE5pe25YCZ5Lmf5YGc5q2i5Y+R5YyF77yM6L+b5YWl5aSn5b6q546v6YWN572RXG4gICAgICAgIG9uTmV0d29ya0ZsYWcgJiYgd3guZ2V0Q29ubmVjdGVkV2lmaSh7XG4gICAgICAgICAgc3VjY2VzczogYXN5bmMgKGRhdGEpID0+IHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICog5qOA5p+l5b2T5YmN572R57uc6L+Y5piv5LiN5piv54Ot54K5572R57ucXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmIChkYXRhLndpZmkuU1NJRC5pbmRleE9mKHNvZnRBUFNTSURQcmVmaXgpID09PSAtMSkge1xuICAgICAgICAgICAgICBzZWFyY2hEZXZpY2VIYW5kbGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlpKflvqrnjq/noa7orqRcbiAgICovXG4gIHNlYXJjaERldmljZSA9IGFzeW5jICh7IHNzaWQsIHBhc3N3b3JkIH0pID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlcykgPT4ge1xuICAgICAgLy8g6L+e57ut5Y+R6LW36K+35rGCIOehruiupOWkp+W+queOr1xuICAgICAgY29uc3QgY29kZXMgPSBnZXRSYW5kb21Db2Rlcyh7IFNTSUQ6IHNzaWQsIHBhc3N3b3JkOiBwYXNzd29yZCwgcGtzOiB0aGlzLnNwZWNpYWxQcm9kdWN0S2V5cyB9KTtcbiAgICAgIGNvbnNvbGUubG9nKCdnZXRSYW5kb21Db2RlcycsIGNvZGVzKTtcbiAgICAgIGxldCBjb2RlU3RyID0gJyc7XG4gICAgICBjb2Rlcy5tYXAoaXRlbSA9PiB7XG4gICAgICAgIGNvZGVTdHIgKz0gYCR7aXRlbX0sYFxuICAgICAgfSlcbiAgICAgIGNvZGVTdHIgPSBjb2RlU3RyLnN1YnN0cmluZygwLCBjb2RlU3RyLmxlbmd0aCAtIDEpO1xuICAgICAgY29uc3QgcXVlcnkgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLmRpc2FibGVTZWFyY2hEZXZpY2UpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcXVlc3QoYC9hcHAvZGV2aWNlX3JlZ2lzdGVyP3JhbmRvbV9jb2Rlcz0ke2NvZGVTdHJ9YCwgeyBtZXRob2Q6ICdnZXQnIH0pO1xuICAgICAgICBpZiAoZGF0YS5zdWNjZXNzKSB7XG4gICAgICAgICAgaWYgKGRhdGEuZGF0YS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8vIOmHjeaWsOivt+axglxuICAgICAgICAgICAgICBhd2FpdCBzbGVlcCgzMDAwKTtcbiAgICAgICAgICAgICAgcXVlcnkoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8g5pCc57Si5Yiw6K6+5aSHXG4gICAgICAgICAgICByZXMoe1xuICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICBkYXRhOiBkYXRhLmRhdGFcbiAgICAgICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcyh7XG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIGVycjoge1xuICAgICAgICAgICAgICBlcnJvckNvZGU6IGVycm9yQ29kZS5BUElfRVJST1IsXG4gICAgICAgICAgICAgIGVycm9yTWVzc2FnZTogJ2FwaSBlcnJvcicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHF1ZXJ5KCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog6YWN572R5o6l5Y+jXG4gICAqIHNldERldmljZU9uYm9hcmRpbmdEZXBsb3nmlrnms5XkuI3lj6/ph43lpI3osIPnlKhcbiAgICovXG4gIHNldERldmljZU9uYm9hcmRpbmdEZXBsb3kgPSAoe1xuICAgIHNzaWQsIHBhc3N3b3JkLCB0aW1lb3V0LCBpc0JpbmQgPSB0cnVlLCBzb2Z0QVBTU0lEUHJlZml4IH06IElTZXREZXZpY2VPbmJvYXJkaW5nRGVwbG95UHJvcHMpOiBhbnkgPT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzKSA9PiB7XG4gICAgICBpZiAodGhpcy50aW1lb3V0KSB7XG4gICAgICAgIC8vIOaWueazlei/mOWcqOaJp+ihjOS4rVxuICAgICAgICByZXMoe1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGVycjoge1xuICAgICAgICAgICAgZXJyb3JDb2RlOiBlcnJvckNvZGUuRVhFQ1VUSU5HLFxuICAgICAgICAgICAgZXJyb3JNZXNzYWdlOiAnZXhlY3V0aW5nJyxcbiAgICAgICAgICB9XG4gICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMubWFpblJlcyA9IHJlcztcbiAgICAgIHRoaXMuZGlzYWJsZVNlYXJjaERldmljZSA9IGZhbHNlO1xuICAgICAgLyoqXG4gICAgICAgKiDorr7nva7otoXml7bml7bpl7RcbiAgICAgICAqL1xuICAgICAgdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIC8vIOi2heaXtlxuICAgICAgICByZXMoe1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGVycjoge1xuICAgICAgICAgICAgZXJyb3JDb2RlOiBlcnJvckNvZGUuVElNRV9PVVQsXG4gICAgICAgICAgICBlcnJvck1lc3NhZ2U6ICd0aW1lIG91dCcsXG4gICAgICAgICAgfSBhcyBJRXJyXG4gICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICAgIHRoaXMuY2xlYW4oKTtcbiAgICAgIH0sIHRpbWVvdXQgKiAxMDAwKTtcblxuICAgICAgLyoqXG4gICAgICAgKiDlj5HnjrDorr7lpIdcbiAgICAgICAqL1xuICAgICAgd3gub25Mb2NhbFNlcnZpY2VGb3VuZChhc3luYyAoZGF0YTogYW55KSA9PiB7XG4gICAgICAgIC8vIOaJvuWIsOacjeWKoSDlj5HpgIHmjIfku6QgXG4gICAgICAgIGNvbnNvbGUubG9nKCdvbkxvY2FsU2VydmljZUZvdW5kJywgZGF0YSk7XG4gICAgICAgIC8vIOWBnOatouWPkeeOsFxuICAgICAgICB3eC5vZmZMb2NhbFNlcnZpY2VGb3VuZCgoKSA9PiB7fSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY29uZmlnRGV2aWNlKHsgc3NpZCwgcGFzc3dvcmQsIHNvZnRBUFNTSURQcmVmaXggfSwgZGF0YSk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgIC8vIOWPkei1t+e7keWumlxuICAgICAgICAgIGlmIChpc0JpbmQpIHtcbiAgICAgICAgICAgIGNvbnN0IGJpbmREYXRhID0gYXdhaXQgdGhpcy5iaW5kRGV2aWNlcyhyZXN1bHQuZGF0YSk7XG4gICAgICAgICAgICBpZiAoYmluZERhdGEuc3VjY2Vzcykge1xuICAgICAgICAgICAgICByZXMoe1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICAgICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXMoe1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycjoge1xuICAgICAgICAgICAgICAgICAgZXJyb3JDb2RlOiBlcnJvckNvZGUuQklORF9GQUlMLFxuICAgICAgICAgICAgICAgICAgZXJyb3JNZXNzYWdlOiAn57uR5a6a5aSx6LSlJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBhcyBJUmVzdWx0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzKHtcbiAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyDop6PmnpDplJnor6/noIFcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNsZWFuKCk7XG4gICAgICB9KTtcblxuICAgICAgd3guc3RvcExvY2FsU2VydmljZURpc2NvdmVyeSh7XG4gICAgICAgIGNvbXBsZXRlOiAoKSA9PiB7XG4gICAgICAgICAgd3guc3RhcnRMb2NhbFNlcnZpY2VEaXNjb3Zlcnkoe1xuICAgICAgICAgICAgc2VydmljZVR5cGU6ICdfZXhhbXBsZS5fdWRwJyxcbiAgICAgICAgICAgIHN1Y2Nlc3M6IChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgIC8vIOiwg+eUqOWPkeeOsOaIkOWKn1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmYWlsOiAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgIC8vIOiwg+eUqOWPkeeOsOWksei0pVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgICByZXMoe1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycjoge1xuICAgICAgICAgICAgICAgICAgZXJyb3JDb2RlOiBlcnJvckNvZGUuV0VDSEFUX0VSUk9SLFxuICAgICAgICAgICAgICAgICAgZXJyb3JNZXNzYWdlOiBlcnIuZXJyTXNnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog57uR5a6a5aSa5Liq6K6+5aSHXG4gICAqL1xuICBiaW5kRGV2aWNlcyA9IChkZXZpY2VzOiBJRGV2aWNlW10pIDogYW55ID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlcykgPT4ge1xuICAgICAgY29uc3QgcHJvbWlzZXMgOiBhbnkgPSBbXTtcblxuICAgICAgbGV0IHRpbWVzdGFtcCA9IERhdGUucGFyc2UoYCR7bmV3IERhdGUoKX1gKTsgIFxuICAgICAgdGltZXN0YW1wID0gdGltZXN0YW1wIC8gMTAwMDtcbiAgICAgIFxuICAgICAgZGV2aWNlcy5tYXAoaXRlbSA9PiB7XG5cbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLnNwZWNpYWxQcm9kdWN0S2V5cy5maW5kSW5kZXgocGsgPT4gaXRlbS5wcm9kdWN0X2tleSA9PT0gcGspO1xuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHBzID0gdGhpcy5zcGVjaWFsUHJvZHVjdEtleVNlY3JldHNbaW5kZXhdO1xuICAgICAgICBjb25zdCBwcm9taXNlID0gcmVxdWVzdChcbiAgICAgICAgICAnL2FwcC9iaW5kX21hYycsXG4gICAgICAgICAge1xuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdYLUdpendpdHMtVGltZXN0YW1wJzogdGltZXN0YW1wLFxuICAgICAgICAgICAgICAnWC1HaXp3aXRzLVNpZ25hdHVyZSc6IE1ENShgJHtwc30ke3RpbWVzdGFtcH1gKS50b0xvd2VyQ2FzZSgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgXCJwcm9kdWN0X2tleVwiOiBpdGVtLnByb2R1Y3Rfa2V5LFxuICAgICAgICAgICAgICBcIm1hY1wiOiBpdGVtLm1hYyxcbiAgICAgICAgICAgICAgXCJyZW1hcmtcIjogXCJcIixcbiAgICAgICAgICAgICAgXCJkZXZfYWxpYXNcIjogXCJcIlxuICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICAgICAgcHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuICAgICAgY29uc29sZS5sb2coJ1Byb21pc2UuYWxsJywgZGF0YSk7XG4gICAgICBjb25zdCByZXR1cm5EYXRhOiBhbnkgPSBbXTtcbiAgICAgIGRhdGEubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKGl0ZW0uc3VjY2Vzcykge1xuICAgICAgICAgIHJldHVybkRhdGEucHVzaChpdGVtLmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgcmVzKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogcmV0dXJuRGF0YSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOa4hemZpOS4gOS6m3RpbWVvdXTnrYlcbiAgICovXG4gIGNsZWFuID0gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXQpO1xuICAgIHRoaXMudGltZW91dCA9IG51bGw7XG4gICAgY2xlYXJJbnRlcnZhbCh0aGlzLlVEUEludGVydmFsKTtcbiAgICB0aGlzLlVEUEludGVydmFsID0gbnVsbDtcbiAgICB0aGlzLm1haW5SZXMgPSBudWxsO1xuICAgIHd4LnN0b3BMb2NhbFNlcnZpY2VEaXNjb3ZlcnkoKTtcbiAgICB0aGlzLmRpc2FibGVTZWFyY2hEZXZpY2UgPSB0cnVlO1xuICAgIGlmICh0aGlzLlVEUFNvY2tldCkge1xuICAgICAgdGhpcy5VRFBTb2NrZXQub2ZmRXJyb3IoKTtcbiAgICAgIHRoaXMuVURQU29ja2V0Lm9mZk1lc3NhZ2UoKTtcbiAgICAgIHRoaXMuVURQU29ja2V0LmNsb3NlKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWBnOatoumFjee9kVxuICAgKi9cbiAgc3RvcERldmljZU9uYm9hcmRpbmdEZXBsb3kgPSAoKSA9PiB7XG4gICAgaWYgKHRoaXMubWFpblJlcykge1xuICAgICAgdGhpcy5tYWluUmVzKHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycjoge1xuICAgICAgICAgIGVycm9yQ29kZTogZXJyb3JDb2RlLlNUT1AsXG4gICAgICAgICAgZXJyb3JNZXNzYWdlOiAn5omL5Yqo5YGc5q2iJ1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMuY2xlYW4oKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gY29uc3Qgc2RrID0gbmV3IFNESyh7YXBwSUQ6ICcnLCBhcHBTZWNyZXQ6ICcnfSk7XG4vLyBzZGsuc2VuZENvbmZpZyh7c3NpZDogJ2dpendpdHMnLCBwYXNzd29yZDogJ2dpeiQyMDI1J30sIHt9IGFzIGFueSk7XG5leHBvcnQgZGVmYXVsdCBTREs7Il19
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
        this.timeout = null;
        this.specialProductKeys = [];
        this.specialProductKeySecrets = [];
        this.disableSearchDevice = false;
        this.setDomain = (cloudServiceInfo) => {
            if (cloudServiceInfo === null) {
                cloudServiceInfo = {
                    openAPIInfo: 'api.gizwits.com',
                };
            }
            global_1.setGlobalData('cloudServiceInfo', cloudServiceInfo);
        };
        this.configDevice = ({ ssid, password, softAPSSIDPrefix }, target) => {
            return new Promise((res) => {
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
                const UDPSocket = wx.createUDPSocket();
                UDPSocket.bind();
                this.UDPInterval = setInterval(() => {
                    UDPSocket.send({
                        address: target.ip,
                        port: target.port,
                        message: uint8Array,
                        offset: 0,
                        length: uint8Array.byteLength,
                    });
                }, 1000);
                UDPSocket.onError((data) => {
                    console.log('onError', data);
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
                    UDPSocket.offMessage();
                    clearInterval(this.UDPInterval);
                    onNetworkFlag = false;
                    const devicesReturn = yield this.searchDevice({ ssid, password });
                    console.log('devicesReturn', devicesReturn);
                    res(devicesReturn);
                });
                UDPSocket.onMessage((data) => __awaiter(this, void 0, void 0, function* () {
                    console.log('onMessage', data);
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
                console.log('this.timeout', this.timeout);
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
                wx.startLocalServiceDiscovery({
                    serviceType: '_example._udp',
                    success: (data) => {
                        console.log(data);
                    },
                    fail: (err) => {
                        console.log(err);
                    },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2RrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyQ0FBb0M7QUFDcEMsNkNBQTBDO0FBQzFDLHFDQUF5QztBQUN6QyxxREFBdUM7QUFDdkMsNkJBQThCO0FBQzlCLG1DQUE0QjtBQXdFNUIsTUFBTSxHQUFHO0lBQ1AsWUFBWSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsa0JBQWtCLEVBQUUsd0JBQXdCLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBVTtRQXNCcEgsVUFBSyxHQUFXLEVBQUUsQ0FBQztRQUNuQixjQUFTLEdBQVcsRUFBRSxDQUFDO1FBQ3ZCLFVBQUssR0FBVyxFQUFFLENBQUM7UUFDbkIsUUFBRyxHQUFXLEVBQUUsQ0FBQztRQUVqQixZQUFPLEdBQVEsSUFBSSxDQUFDO1FBQ3BCLHVCQUFrQixHQUFhLEVBQUUsQ0FBQztRQUNsQyw2QkFBd0IsR0FBYSxFQUFFLENBQUM7UUFJeEMsd0JBQW1CLEdBQVksS0FBSyxDQUFDO1FBTXJDLGNBQVMsR0FBRyxDQUFDLGdCQUEwQyxFQUFFLEVBQUU7WUFDekQsSUFBSSxnQkFBZ0IsS0FBSyxJQUFJLEVBQUU7Z0JBQzdCLGdCQUFnQixHQUFHO29CQUNqQixXQUFXLEVBQUUsaUJBQWlCO2lCQUMvQixDQUFDO2FBQ0g7WUFDRCxzQkFBYSxDQUFDLGtCQUFrQixFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFFdEQsQ0FBQyxDQUFBO1FBS0QsaUJBQVksR0FBRyxDQUFDLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsRUFBaUUsRUFBRSxNQUFlLEVBQU8sRUFBRTtZQUMzSSxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBRXpCLElBQUksYUFBYSxHQUFHLElBQUksQ0FBQztnQkFFekIsTUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDNUIsSUFBSSxNQUFNLEdBQWEsRUFBRSxDQUFDO2dCQUMxQixNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNqQixNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbkIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNwQyxNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBRTVDLElBQUksS0FBSyxHQUFhLEVBQUUsQ0FBQztnQkFDekIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7b0JBQ3BDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUNuQztnQkFFRCxJQUFJLFNBQVMsR0FBYSxFQUFFLENBQUM7Z0JBQzdCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUN4QyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDM0M7Z0JBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBRy9FLElBQUksYUFBYSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7Z0JBQ25DLE9BQU8sYUFBYSxHQUFHLENBQUMsRUFBRTtvQkFDeEIsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztvQkFDM0IsYUFBYSxJQUFJLEdBQUcsQ0FBQztpQkFDdEI7Z0JBRUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3JELE1BQU0sTUFBTSxHQUFHLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDOUMsTUFBTSxVQUFVLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUE7Z0JBQ3pDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUMxQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUMzQjtnQkFJRCxNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3ZDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFFakIsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFO29CQUNsQyxTQUFTLENBQUMsSUFBSSxDQUFDO3dCQUNiLE9BQU8sRUFBRSxNQUFNLENBQUMsRUFBRTt3QkFDbEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO3dCQUNqQixPQUFPLEVBQUUsVUFBVTt3QkFDbkIsTUFBTSxFQUFFLENBQUM7d0JBQ1QsTUFBTSxFQUFFLFVBQVUsQ0FBQyxVQUFVO3FCQUM5QixDQUFDLENBQUM7Z0JBQ0wsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUVULFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRTtvQkFDOUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBRTdCLGFBQWEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQ2hDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDYixHQUFHLENBQUM7d0JBQ0YsT0FBTyxFQUFFLEtBQUs7d0JBQ2QsR0FBRyxFQUFFOzRCQUNILFNBQVMsRUFBRSxtQkFBUyxDQUFDLFlBQVk7NEJBQ2pDLFlBQVksRUFBRSxJQUFJLENBQUMsTUFBTTt5QkFDMUI7cUJBQ1MsQ0FBQyxDQUFDO2dCQUNoQixDQUFDLENBQUMsQ0FBQztnQkFHSCxNQUFNLGtCQUFrQixHQUFHLEdBQVMsRUFBRTtvQkFDcEMsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDO29CQUN2QixhQUFhLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO29CQUVoQyxhQUFhLEdBQUcsS0FBSyxDQUFDO29CQUN0QixNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztvQkFDbEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsYUFBYSxDQUFDLENBQUM7b0JBQzVDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDckIsQ0FBQyxDQUFBLENBQUE7Z0JBRUQsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFPLElBQVMsRUFBRSxFQUFFO29CQUN0QyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFFL0Isa0JBQWtCLEVBQUUsQ0FBQztnQkFDdkIsQ0FBQyxDQUFBLENBQUMsQ0FBQztnQkFFSCxFQUFFLENBQUMscUJBQXFCLENBQUMsR0FBUyxFQUFFO29CQUVsQyxhQUFhLElBQUksRUFBRSxDQUFDLGdCQUFnQixDQUFDO3dCQUNuQyxPQUFPLEVBQUUsQ0FBTyxJQUFJLEVBQUUsRUFBRTs0QkFJdEIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtnQ0FDbkQsa0JBQWtCLEVBQUUsQ0FBQzs2QkFDdEI7d0JBQ0gsQ0FBQyxDQUFBO3FCQUNGLENBQUMsQ0FBQztnQkFFTCxDQUFDLENBQUEsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUE7UUFLRCxpQkFBWSxHQUFHLENBQU8sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTtZQUMxQyxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBRXpCLE1BQU0sS0FBSyxHQUFHLG9CQUFjLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7Z0JBQy9GLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztnQkFDakIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDZixPQUFPLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQTtnQkFDdkIsQ0FBQyxDQUFDLENBQUE7Z0JBQ0YsT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ25ELE1BQU0sS0FBSyxHQUFHLEdBQVMsRUFBRTtvQkFDdkIsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7d0JBQzVCLE9BQU87cUJBQ1I7b0JBQ0QsTUFBTSxJQUFJLEdBQUcsTUFBTSx3QkFBTyxDQUFDLHFDQUFxQyxPQUFPLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO29CQUM5RixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7d0JBQ2hCLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFOzRCQUV4QixNQUFNLGVBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQzs0QkFDbEIsS0FBSyxFQUFFLENBQUM7eUJBQ1g7NkJBQU07NEJBRUwsR0FBRyxDQUFDO2dDQUNGLE9BQU8sRUFBRSxJQUFJO2dDQUNiLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTs2QkFDTCxDQUFDLENBQUM7eUJBQ2Y7cUJBQ0Y7eUJBQU07d0JBQ0wsR0FBRyxDQUFDOzRCQUNGLE9BQU8sRUFBRSxLQUFLOzRCQUNkLEdBQUcsRUFBRTtnQ0FDSCxTQUFTLEVBQUUsbUJBQVMsQ0FBQyxTQUFTO2dDQUM5QixZQUFZLEVBQUUsV0FBVzs2QkFDMUI7eUJBQ1MsQ0FBQyxDQUFDO3FCQUNmO2dCQUNILENBQUMsQ0FBQSxDQUFBO2dCQUVELEtBQUssRUFBRSxDQUFDO1lBQ1YsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUEsQ0FBQTtRQU1ELDhCQUF5QixHQUFHLENBQUMsRUFDM0IsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSxHQUFHLElBQUksRUFBRSxnQkFBZ0IsRUFBbUMsRUFBTyxFQUFFO1lBQ3BHLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDekIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7b0JBRWhCLEdBQUcsQ0FBQzt3QkFDRixPQUFPLEVBQUUsS0FBSzt3QkFDZCxHQUFHLEVBQUU7NEJBQ0gsU0FBUyxFQUFFLG1CQUFTLENBQUMsU0FBUzs0QkFDOUIsWUFBWSxFQUFFLFdBQVc7eUJBQzFCO3FCQUNTLENBQUMsQ0FBQztvQkFDZCxPQUFPO2lCQUNSO2dCQUNELElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDO2dCQUNuQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsS0FBSyxDQUFDO2dCQUlqQyxJQUFJLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUU7b0JBRTdCLEdBQUcsQ0FBQzt3QkFDRixPQUFPLEVBQUUsS0FBSzt3QkFDZCxHQUFHLEVBQUU7NEJBQ0gsU0FBUyxFQUFFLG1CQUFTLENBQUMsUUFBUTs0QkFDN0IsWUFBWSxFQUFFLFVBQVU7eUJBQ2pCO3FCQUNDLENBQUMsQ0FBQztvQkFDZCxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2YsQ0FBQyxFQUFFLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQztnQkFLbkIsRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQU8sSUFBUyxFQUFFLEVBQUU7b0JBRXpDLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDbkYsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFO3dCQUVsQixJQUFJLE1BQU0sRUFBRTs0QkFDVixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUNyRCxJQUFJLFFBQVEsQ0FBQyxPQUFPLEVBQUU7Z0NBQ3BCLEdBQUcsQ0FBQztvQ0FDRixPQUFPLEVBQUUsSUFBSTtvQ0FDYixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7aUNBQ1AsQ0FBQyxDQUFDOzZCQUNmO2lDQUFNO2dDQUNMLEdBQUcsQ0FBQztvQ0FDRixPQUFPLEVBQUUsS0FBSztvQ0FDZCxHQUFHLEVBQUU7d0NBQ0gsU0FBUyxFQUFFLG1CQUFTLENBQUMsU0FBUzt3Q0FDOUIsWUFBWSxFQUFFLE1BQU07cUNBQ3JCO2lDQUNTLENBQUMsQ0FBQzs2QkFDZjt5QkFDRjs2QkFBTTs0QkFDTCxHQUFHLENBQUM7Z0NBQ0YsT0FBTyxFQUFFLElBQUk7Z0NBQ2IsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJOzZCQUNQLENBQUMsQ0FBQzt5QkFDZjtxQkFFRjt5QkFBTTtxQkFFTjtvQkFDRCxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2YsQ0FBQyxDQUFBLENBQUMsQ0FBQztnQkFFSCxFQUFFLENBQUMsMEJBQTBCLENBQUM7b0JBQzVCLFdBQVcsRUFBRSxlQUFlO29CQUM1QixPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTt3QkFFaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDcEIsQ0FBQztvQkFDRCxJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTt3QkFFWixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUNuQixDQUFDO2lCQUNGLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFBO1FBS0QsZ0JBQVcsR0FBRyxDQUFDLE9BQWtCLEVBQVEsRUFBRTtZQUN6QyxPQUFPLElBQUksT0FBTyxDQUFDLENBQU8sR0FBRyxFQUFFLEVBQUU7Z0JBQy9CLE1BQU0sUUFBUSxHQUFTLEVBQUUsQ0FBQztnQkFFMUIsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QyxTQUFTLEdBQUcsU0FBUyxHQUFHLElBQUksQ0FBQztnQkFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFFakIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEtBQUssRUFBRSxDQUFDLENBQUM7b0JBQy9FLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQzt3QkFBRSxPQUFPO29CQUN6QixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ2hELE1BQU0sT0FBTyxHQUFHLHdCQUFPLENBQ3JCLGVBQWUsRUFDZjt3QkFDRSxNQUFNLEVBQUUsTUFBTTt3QkFDZCxPQUFPLEVBQUU7NEJBQ1AscUJBQXFCLEVBQUUsU0FBUzs0QkFDaEMscUJBQXFCLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFO3lCQUM5RDt3QkFDRCxJQUFJLEVBQUU7NEJBQ0osYUFBYSxFQUFFLElBQUksQ0FBQyxXQUFXOzRCQUMvQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUc7NEJBQ2YsUUFBUSxFQUFFLEVBQUU7NEJBQ1osV0FBVyxFQUFFLEVBQUU7eUJBQ2pCO3FCQUNELENBQ0YsQ0FBQztvQkFDRixRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN6QixDQUFDLENBQUMsQ0FBQztnQkFFSCxNQUFNLElBQUksR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3pDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxNQUFNLFVBQVUsR0FBUSxFQUFFLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRTtvQkFDckIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO3dCQUNoQixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDNUI7Z0JBQ0gsQ0FBQyxDQUFDLENBQUE7Z0JBQ0YsR0FBRyxDQUFDO29CQUNGLE9BQU8sRUFBRSxJQUFJO29CQUNiLElBQUksRUFBRSxVQUFVO2lCQUNqQixDQUFDLENBQUM7WUFDTCxDQUFDLENBQUEsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFBO1FBS0QsVUFBSyxHQUFHLEdBQUcsRUFBRTtZQUNYLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDM0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7WUFDcEIsYUFBYSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNoQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztZQUN4QixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztZQUNwQixFQUFFLENBQUMseUJBQXlCLEVBQUUsQ0FBQztZQUMvQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO1FBQ2xDLENBQUMsQ0FBQTtRQUtELCtCQUEwQixHQUFHLEdBQUcsRUFBRTtZQUNoQyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ2hCLElBQUksQ0FBQyxPQUFPLENBQUM7b0JBQ1gsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsR0FBRyxFQUFFO3dCQUNILFNBQVMsRUFBRSxtQkFBUyxDQUFDLElBQUk7d0JBQ3pCLFlBQVksRUFBRSxNQUFNO3FCQUNyQjtpQkFDRixDQUFDLENBQUM7Z0JBQ0gsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2FBQ2Q7UUFDSCxDQUFDLENBQUE7UUF0V0MsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDO1FBQzdDLElBQUksQ0FBQyx3QkFBd0IsR0FBRyx3QkFBd0IsQ0FBQztRQUN6RCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUVmLHNCQUFhLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzlCLHNCQUFhLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3RDLHNCQUFhLENBQUMsb0JBQW9CLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUN4RCxzQkFBYSxDQUFDLDBCQUEwQixFQUFFLHdCQUF3QixDQUFDLENBQUM7UUFDcEUsc0JBQWEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUIsc0JBQWEsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFNMUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ25DLENBQUM7Q0FvVkY7QUFJRCxrQkFBZSxHQUFHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZXJyb3JDb2RlIGZyb20gXCIuL2Vycm9yQ29kZVwiO1xuaW1wb3J0IGdldFJhbmRvbUNvZGVzIGZyb20gXCIuL3JhbmRvbUNvZGVcIjtcbmltcG9ydCB7IHNldEdsb2JhbERhdGEgfSBmcm9tIFwiLi9nbG9iYWxcIjtcbmltcG9ydCByZXF1ZXN0IGZyb20gXCIuL29wZW5BcGlSZXF1ZXN0XCI7XG5pbXBvcnQgTUQ1ID0gcmVxdWlyZSgnLi9tZDUnKTtcbmltcG9ydCBzbGVlcCBmcm9tICcuL3NsZWVwJztcblxuaW50ZXJmYWNlIElTZXREZXZpY2VPbmJvYXJkaW5nRGVwbG95UHJvcHMge1xuICBzc2lkOiBzdHJpbmc7XG4gIHBhc3N3b3JkOiBzdHJpbmc7XG4gIHRpbWVvdXQ6IG51bWJlcjtcbiAgaXNCaW5kPzogYm9vbGVhbjtcbiAgc29mdEFQU1NJRFByZWZpeDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSURldmljZSB7XG4gIG1hYzogc3RyaW5nO1xuICBwcm9kdWN0X2tleTogc3RyaW5nO1xuICBkaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBzbm8/OiBzdHJpbmc7XG4gIG1hbnVmYWN0dXJlcj86IGFueTtcbiAgYWxpYXM/OiBzdHJpbmc7XG4gIG9ubGluZVN0YXR1czogYm9vbGVhbjtcbiAgbmV0U3RhdHVzOiBudW1iZXI7XG4gIGlzU3Vic2NyaWJlZD86IGJvb2xlYW47XG4gIG1lc2hJRD86IHN0cmluZztcbiAgaXNCaW5kPzogYm9vbGVhbjtcbiAgaXNPbmxpbmU/OiBib29sZWFuO1xuICByZW1hcms/OiBzdHJpbmc7XG4gIHNpdGVHaWQ6IHN0cmluZztcbiAgaWQ/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJRXJyIHtcbiAgZXJyb3JDb2RlOiBTeW1ib2w7XG4gIGVycm9yTWVzc2FnZTogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSVJlc3VsdCB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIGRhdGE/OiBJRGV2aWNlIHwgbnVsbDtcbiAgZXJyPzogSUVycjtcbn1cblxuaW50ZXJmYWNlIElUYXJnZXQge1xuICBzZXJ2aWNlVHlwZTogc3RyaW5nO1xuICBzZXJ2aWNlTmFtZTogc3RyaW5nO1xuICBpcDogc3RyaW5nO1xuICBwb3J0OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBJU0RLIHtcbiAgYXBwSUQ6IHN0cmluZztcbiAgYXBwU2VjcmV0OiBzdHJpbmc7XG4gIHRpbWVvdXQ6IGFueTtcbiAgVURQSW50ZXJ2YWw6IGFueTtcbiAgY29uZmlnRGV2aWNlKHsgc3NpZCwgcGFzc3dvcmQgfTogeyBzc2lkOiBzdHJpbmc7IHBhc3N3b3JkOiBzdHJpbmcgfSwgdGFyZ2V0OiBJVGFyZ2V0KTogYW55O1xuICBzZXREZXZpY2VPbmJvYXJkaW5nRGVwbG95KHtcbiAgICBzc2lkLCBwYXNzd29yZCwgdGltZW91dCwgaXNCaW5kIH06IElTZXREZXZpY2VPbmJvYXJkaW5nRGVwbG95UHJvcHMpOiBhbnk7XG4gIHN0b3BEZXZpY2VPbmJvYXJkaW5nRGVwbG95KCk6IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJQ2xvdWRTZXJ2aWNlSW5mbyB7XG4gIG9wZW5BUElJbmZvOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJUHJvcHMge1xuICBhcHBJRDogc3RyaW5nO1xuICBhcHBTZWNyZXQ6IHN0cmluZztcbiAgc3BlY2lhbFByb2R1Y3RLZXlzOiBzdHJpbmdbXTtcbiAgc3BlY2lhbFByb2R1Y3RLZXlTZWNyZXRzOiBzdHJpbmdbXTtcbiAgY2xvdWRTZXJ2aWNlSW5mbzogSUNsb3VkU2VydmljZUluZm98IG51bGw7XG4gIHRva2VuOiBzdHJpbmc7XG4gIHVpZDogc3RyaW5nO1xufVxuXG5jbGFzcyBTREsgaW1wbGVtZW50cyBJU0RLIHtcbiAgY29uc3RydWN0b3IoeyBhcHBJRCwgYXBwU2VjcmV0LCBzcGVjaWFsUHJvZHVjdEtleXMsIHNwZWNpYWxQcm9kdWN0S2V5U2VjcmV0cywgY2xvdWRTZXJ2aWNlSW5mbywgdG9rZW4sIHVpZCB9OiBJUHJvcHMpIHtcbiAgICB0aGlzLmFwcElEID0gYXBwSUQ7XG4gICAgdGhpcy5hcHBTZWNyZXQgPSBhcHBTZWNyZXQ7XG4gICAgdGhpcy5zcGVjaWFsUHJvZHVjdEtleXMgPSBzcGVjaWFsUHJvZHVjdEtleXM7XG4gICAgdGhpcy5zcGVjaWFsUHJvZHVjdEtleVNlY3JldHMgPSBzcGVjaWFsUHJvZHVjdEtleVNlY3JldHM7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMudWlkID0gdWlkO1xuXG4gICAgc2V0R2xvYmFsRGF0YSgnYXBwSUQnLCBhcHBJRCk7XG4gICAgc2V0R2xvYmFsRGF0YSgnYXBwU2VjcmV0JywgYXBwU2VjcmV0KTtcbiAgICBzZXRHbG9iYWxEYXRhKCdzcGVjaWFsUHJvZHVjdEtleXMnLCBzcGVjaWFsUHJvZHVjdEtleXMpO1xuICAgIHNldEdsb2JhbERhdGEoJ3NwZWNpYWxQcm9kdWN0S2V5U2VjcmV0cycsIHNwZWNpYWxQcm9kdWN0S2V5U2VjcmV0cyk7XG4gICAgc2V0R2xvYmFsRGF0YSgndG9rZW4nLCB0b2tlbik7XG4gICAgc2V0R2xvYmFsRGF0YSgndWlkJywgdWlkKTtcblxuXG4gICAgLyoqXG4gICAgICog5ZCM5pe25Lmf6K6+572u5Z+f5ZCN5L+h5oGvXG4gICAgICovXG4gICAgdGhpcy5zZXREb21haW4oY2xvdWRTZXJ2aWNlSW5mbyk7XG4gIH1cblxuICBhcHBJRDogc3RyaW5nID0gJyc7XG4gIGFwcFNlY3JldDogc3RyaW5nID0gJyc7XG4gIHRva2VuOiBzdHJpbmcgPSAnJztcbiAgdWlkOiBzdHJpbmcgPSAnJztcbiAgXG4gIHRpbWVvdXQ6IGFueSA9IG51bGw7XG4gIHNwZWNpYWxQcm9kdWN0S2V5czogc3RyaW5nW10gPSBbXTtcbiAgc3BlY2lhbFByb2R1Y3RLZXlTZWNyZXRzOiBzdHJpbmdbXSA9IFtdO1xuXG5cbiAgVURQSW50ZXJ2YWw6IGFueTtcbiAgZGlzYWJsZVNlYXJjaERldmljZTogYm9vbGVhbiA9IGZhbHNlO1xuICBtYWluUmVzOiBhbnk7IC8vIOS/neWtmHByb21pc2XnmoRyZXPvvIznlKjkuo7kuLTml7bkuK3mlq1cblxuICAvKipcbiAgICog6K6+572u5Z+f5ZCNXG4gICAqL1xuICBzZXREb21haW4gPSAoY2xvdWRTZXJ2aWNlSW5mbzogSUNsb3VkU2VydmljZUluZm8gfCBudWxsKSA9PiB7XG4gICAgaWYgKGNsb3VkU2VydmljZUluZm8gPT09IG51bGwpIHtcbiAgICAgIGNsb3VkU2VydmljZUluZm8gPSB7XG4gICAgICAgIG9wZW5BUElJbmZvOiAnYXBpLmdpendpdHMuY29tJyxcbiAgICAgIH07XG4gICAgfVxuICAgIHNldEdsb2JhbERhdGEoJ2Nsb3VkU2VydmljZUluZm8nLCBjbG91ZFNlcnZpY2VJbmZvKTtcblxuICB9XG5cbiAgLyoqXG4gICAqIOi0n+i0o+WPkeaMh+S7pFxuICAgKi9cbiAgY29uZmlnRGV2aWNlID0gKHsgc3NpZCwgcGFzc3dvcmQsIHNvZnRBUFNTSURQcmVmaXggfTogeyBzc2lkOiBzdHJpbmc7IHBhc3N3b3JkOiBzdHJpbmc7IHNvZnRBUFNTSURQcmVmaXg6IHN0cmluZzsgfSwgdGFyZ2V0OiBJVGFyZ2V0KTogYW55ID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlcykgPT4ge1xuXG4gICAgICBsZXQgb25OZXR3b3JrRmxhZyA9IHRydWU7XG5cbiAgICAgIGNvbnN0IGhlYWRlciA9IFswLCAwLCAwLCAzXTtcbiAgICAgIGxldCBsZW5ndGg6IG51bWJlcltdID0gW107XG4gICAgICBjb25zdCBmbGFnID0gWzBdO1xuICAgICAgY29uc3QgY21kID0gWzAsIDFdO1xuICAgICAgY29uc3Qgc3NpZExlbmd0aCA9IFswLCBzc2lkLmxlbmd0aF07XG4gICAgICBjb25zdCBwYXNzd29yZExlbmd0aCA9IFswLCBwYXNzd29yZC5sZW5ndGhdO1xuXG4gICAgICBsZXQgQVNTSUQ6IG51bWJlcltdID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNzaWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgQVNTSUQucHVzaChzc2lkW2ldLmNoYXJDb2RlQXQoMCkpO1xuICAgICAgfVxuXG4gICAgICBsZXQgQVBhc3N3b3JkOiBudW1iZXJbXSA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXNzd29yZC5sZW5ndGg7IGkrKykge1xuICAgICAgICBBUGFzc3dvcmQucHVzaChwYXNzd29yZFtpXS5jaGFyQ29kZUF0KDApKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29udGVudCA9IGZsYWcuY29uY2F0KGNtZCwgc3NpZExlbmd0aCwgQVNTSUQsIHBhc3N3b3JkTGVuZ3RoLCBBUGFzc3dvcmQpO1xuICAgICAgLy8gbGVuZ3RoID0gY29udGVudC5sZW5ndGgudG9TdHJpbmcoMTYpO1xuXG4gICAgICBsZXQgY29udGVudExlbmd0aCA9IGNvbnRlbnQubGVuZ3RoO1xuICAgICAgd2hpbGUgKGNvbnRlbnRMZW5ndGggPiAwKSB7XG4gICAgICAgIGxlbmd0aC5wdXNoKGNvbnRlbnRMZW5ndGgpO1xuICAgICAgICBjb250ZW50TGVuZ3RoIC09IDI1NTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29uZmlnID0gaGVhZGVyLmNvbmNhdChsZW5ndGgpLmNvbmNhdChjb250ZW50KTtcbiAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihjb25maWcubGVuZ3RoKTtcbiAgICAgIGNvbnN0IHVpbnQ4QXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXIpXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlci5ieXRlTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdWludDhBcnJheVtpXSA9IGNvbmZpZ1tpXTtcbiAgICAgIH1cbiAgICAgIC8qKlxuICAgICAgICog6L+e5o6lc29ja2V0IOWPkemAgVxuICAgICAgICovXG4gICAgICBjb25zdCBVRFBTb2NrZXQgPSB3eC5jcmVhdGVVRFBTb2NrZXQoKTtcbiAgICAgIFVEUFNvY2tldC5iaW5kKCk7XG5cbiAgICAgIHRoaXMuVURQSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIFVEUFNvY2tldC5zZW5kKHtcbiAgICAgICAgICBhZGRyZXNzOiB0YXJnZXQuaXAsXG4gICAgICAgICAgcG9ydDogdGFyZ2V0LnBvcnQsXG4gICAgICAgICAgbWVzc2FnZTogdWludDhBcnJheSxcbiAgICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgICAgbGVuZ3RoOiB1aW50OEFycmF5LmJ5dGVMZW5ndGgsXG4gICAgICAgIH0pO1xuICAgICAgfSwgMTAwMCk7XG5cbiAgICAgIFVEUFNvY2tldC5vbkVycm9yKChkYXRhOiBhbnkpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ29uRXJyb3InLCBkYXRhKTtcbiAgICAgICAgLy8gVURQU29ja2V0LmNsb3NlKCk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5VRFBJbnRlcnZhbCk7XG4gICAgICAgIHRoaXMuY2xlYW4oKTtcbiAgICAgICAgcmVzKHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnI6IHtcbiAgICAgICAgICAgIGVycm9yQ29kZTogZXJyb3JDb2RlLldFQ0hBVF9FUlJPUixcbiAgICAgICAgICAgIGVycm9yTWVzc2FnZTogZGF0YS5lcnJNc2dcbiAgICAgICAgICB9XG4gICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICB9KTtcblxuICAgICAgLy8g5riF55CG5LiA5Lqb55uR5ZCs77yM6LCD55So5pCc57Si6K6+5aSHXG4gICAgICBjb25zdCBzZWFyY2hEZXZpY2VIYW5kbGUgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIFVEUFNvY2tldC5vZmZNZXNzYWdlKCk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5VRFBJbnRlcnZhbCk7XG4gICAgICAgIC8vIOagh+iusOWPr+S7peWBnOatouebkeWQrFxuICAgICAgICBvbk5ldHdvcmtGbGFnID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGRldmljZXNSZXR1cm4gPSBhd2FpdCB0aGlzLnNlYXJjaERldmljZSh7IHNzaWQsIHBhc3N3b3JkIH0pO1xuICAgICAgICBjb25zb2xlLmxvZygnZGV2aWNlc1JldHVybicsIGRldmljZXNSZXR1cm4pO1xuICAgICAgICByZXMoZGV2aWNlc1JldHVybik7XG4gICAgICB9XG5cbiAgICAgIFVEUFNvY2tldC5vbk1lc3NhZ2UoYXN5bmMgKGRhdGE6IGFueSkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnb25NZXNzYWdlJywgZGF0YSk7XG4gICAgICAgIC8vIOaUtuWIsOWbnuiwgyDlj6/ku6XlgZzmraLlj5HljIVcbiAgICAgICAgc2VhcmNoRGV2aWNlSGFuZGxlKCk7XG4gICAgICB9KTtcblxuICAgICAgd3gub25OZXR3b3JrU3RhdHVzQ2hhbmdlKGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8g5Y+R55Sf572R57uc5YiH5o2i55qE5pe25YCZ5Lmf5YGc5q2i5Y+R5YyF77yM6L+b5YWl5aSn5b6q546v6YWN572RXG4gICAgICAgIG9uTmV0d29ya0ZsYWcgJiYgd3guZ2V0Q29ubmVjdGVkV2lmaSh7XG4gICAgICAgICAgc3VjY2VzczogYXN5bmMgKGRhdGEpID0+IHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICog5qOA5p+l5b2T5YmN572R57uc6L+Y5piv5LiN5piv54Ot54K5572R57ucXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmIChkYXRhLndpZmkuU1NJRC5pbmRleE9mKHNvZnRBUFNTSURQcmVmaXgpID09PSAtMSkge1xuICAgICAgICAgICAgICBzZWFyY2hEZXZpY2VIYW5kbGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlpKflvqrnjq/noa7orqRcbiAgICovXG4gIHNlYXJjaERldmljZSA9IGFzeW5jICh7IHNzaWQsIHBhc3N3b3JkIH0pID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlcykgPT4ge1xuICAgICAgLy8g6L+e57ut5Y+R6LW36K+35rGCIOehruiupOWkp+W+queOr1xuICAgICAgY29uc3QgY29kZXMgPSBnZXRSYW5kb21Db2Rlcyh7IFNTSUQ6IHNzaWQsIHBhc3N3b3JkOiBwYXNzd29yZCwgcGtzOiB0aGlzLnNwZWNpYWxQcm9kdWN0S2V5cyB9KTtcbiAgICAgIGxldCBjb2RlU3RyID0gJyc7XG4gICAgICBjb2Rlcy5tYXAoaXRlbSA9PiB7XG4gICAgICAgIGNvZGVTdHIgKz0gYCR7aXRlbX0sYFxuICAgICAgfSlcbiAgICAgIGNvZGVTdHIgPSBjb2RlU3RyLnN1YnN0cmluZygwLCBjb2RlU3RyLmxlbmd0aCAtIDEpO1xuICAgICAgY29uc3QgcXVlcnkgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLmRpc2FibGVTZWFyY2hEZXZpY2UpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcXVlc3QoYC9hcHAvZGV2aWNlX3JlZ2lzdGVyP3JhbmRvbV9jb2Rlcz0ke2NvZGVTdHJ9YCwgeyBtZXRob2Q6ICdnZXQnIH0pO1xuICAgICAgICBpZiAoZGF0YS5zdWNjZXNzKSB7XG4gICAgICAgICAgaWYgKGRhdGEuZGF0YS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8vIOmHjeaWsOivt+axglxuICAgICAgICAgICAgICBhd2FpdCBzbGVlcCgzMDAwKTtcbiAgICAgICAgICAgICAgcXVlcnkoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8g5pCc57Si5Yiw6K6+5aSHXG4gICAgICAgICAgICByZXMoe1xuICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICBkYXRhOiBkYXRhLmRhdGFcbiAgICAgICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcyh7XG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIGVycjoge1xuICAgICAgICAgICAgICBlcnJvckNvZGU6IGVycm9yQ29kZS5BUElfRVJST1IsXG4gICAgICAgICAgICAgIGVycm9yTWVzc2FnZTogJ2FwaSBlcnJvcicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcXVlcnkoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDphY3nvZHmjqXlj6NcbiAgICogc2V0RGV2aWNlT25ib2FyZGluZ0RlcGxveeaWueazleS4jeWPr+mHjeWkjeiwg+eUqFxuICAgKi9cbiAgc2V0RGV2aWNlT25ib2FyZGluZ0RlcGxveSA9ICh7XG4gICAgc3NpZCwgcGFzc3dvcmQsIHRpbWVvdXQsIGlzQmluZCA9IHRydWUsIHNvZnRBUFNTSURQcmVmaXggfTogSVNldERldmljZU9uYm9hcmRpbmdEZXBsb3lQcm9wcyk6IGFueSA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXMpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCd0aGlzLnRpbWVvdXQnLCB0aGlzLnRpbWVvdXQpO1xuICAgICAgaWYgKHRoaXMudGltZW91dCkge1xuICAgICAgICAvLyDmlrnms5Xov5jlnKjmiafooYzkuK1cbiAgICAgICAgcmVzKHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnI6IHtcbiAgICAgICAgICAgIGVycm9yQ29kZTogZXJyb3JDb2RlLkVYRUNVVElORyxcbiAgICAgICAgICAgIGVycm9yTWVzc2FnZTogJ2V4ZWN1dGluZycsXG4gICAgICAgICAgfVxuICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLm1haW5SZXMgPSByZXM7XG4gICAgICB0aGlzLmRpc2FibGVTZWFyY2hEZXZpY2UgPSBmYWxzZTtcbiAgICAgIC8qKlxuICAgICAgICog6K6+572u6LaF5pe25pe26Ze0XG4gICAgICAgKi9cbiAgICAgIHRoaXMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAvLyDotoXml7ZcbiAgICAgICAgcmVzKHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnI6IHtcbiAgICAgICAgICAgIGVycm9yQ29kZTogZXJyb3JDb2RlLlRJTUVfT1VULFxuICAgICAgICAgICAgZXJyb3JNZXNzYWdlOiAndGltZSBvdXQnLFxuICAgICAgICAgIH0gYXMgSUVyclxuICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgICB0aGlzLmNsZWFuKCk7XG4gICAgICB9LCB0aW1lb3V0ICogMTAwMCk7XG5cbiAgICAgIC8qKlxuICAgICAgICog5Y+R546w6K6+5aSHXG4gICAgICAgKi9cbiAgICAgIHd4Lm9uTG9jYWxTZXJ2aWNlRm91bmQoYXN5bmMgKGRhdGE6IGFueSkgPT4ge1xuICAgICAgICAvLyDmib7liLDmnI3liqEg5Y+R6YCB5oyH5LukIFxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNvbmZpZ0RldmljZSh7IHNzaWQsIHBhc3N3b3JkLCBzb2Z0QVBTU0lEUHJlZml4IH0sIGRhdGEpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAvLyDlj5Hotbfnu5HlrppcbiAgICAgICAgICBpZiAoaXNCaW5kKSB7XG4gICAgICAgICAgICBjb25zdCBiaW5kRGF0YSA9IGF3YWl0IHRoaXMuYmluZERldmljZXMocmVzdWx0LmRhdGEpO1xuICAgICAgICAgICAgaWYgKGJpbmREYXRhLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgcmVzKHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzKHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnI6IHtcbiAgICAgICAgICAgICAgICAgIGVycm9yQ29kZTogZXJyb3JDb2RlLkJJTkRfRkFJTCxcbiAgICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZTogJ+e7keWumuWksei0pSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcyh7XG4gICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgICAgICAgfSBhcyBJUmVzdWx0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8g6Kej5p6Q6ZSZ6K+v56CBXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jbGVhbigpO1xuICAgICAgfSk7XG5cbiAgICAgIHd4LnN0YXJ0TG9jYWxTZXJ2aWNlRGlzY292ZXJ5KHtcbiAgICAgICAgc2VydmljZVR5cGU6ICdfZXhhbXBsZS5fdWRwJyxcbiAgICAgICAgc3VjY2VzczogKGRhdGEpID0+IHtcbiAgICAgICAgICAvLyDosIPnlKjlj5HnjrDmiJDlip9cbiAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgfSxcbiAgICAgICAgZmFpbDogKGVycikgPT4ge1xuICAgICAgICAgIC8vIOiwg+eUqOWPkeeOsOWksei0pVxuICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnu5HlrprlpJrkuKrorr7lpIdcbiAgICovXG4gIGJpbmREZXZpY2VzID0gKGRldmljZXM6IElEZXZpY2VbXSkgOiBhbnkgPT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzKSA9PiB7XG4gICAgICBjb25zdCBwcm9taXNlcyA6IGFueSA9IFtdO1xuXG4gICAgICBsZXQgdGltZXN0YW1wID0gRGF0ZS5wYXJzZShgJHtuZXcgRGF0ZSgpfWApOyAgXG4gICAgICB0aW1lc3RhbXAgPSB0aW1lc3RhbXAgLyAxMDAwO1xuICAgICAgZGV2aWNlcy5tYXAoaXRlbSA9PiB7XG5cbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLnNwZWNpYWxQcm9kdWN0S2V5cy5maW5kSW5kZXgocGsgPT4gaXRlbS5wcm9kdWN0X2tleSA9PT0gcGspO1xuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHBzID0gdGhpcy5zcGVjaWFsUHJvZHVjdEtleVNlY3JldHNbaW5kZXhdO1xuICAgICAgICBjb25zdCBwcm9taXNlID0gcmVxdWVzdChcbiAgICAgICAgICAnL2FwcC9iaW5kX21hYycsXG4gICAgICAgICAge1xuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdYLUdpendpdHMtVGltZXN0YW1wJzogdGltZXN0YW1wLFxuICAgICAgICAgICAgICAnWC1HaXp3aXRzLVNpZ25hdHVyZSc6IE1ENShgJHtwc30ke3RpbWVzdGFtcH1gKS50b0xvd2VyQ2FzZSgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgXCJwcm9kdWN0X2tleVwiOiBpdGVtLnByb2R1Y3Rfa2V5LFxuICAgICAgICAgICAgICBcIm1hY1wiOiBpdGVtLm1hYyxcbiAgICAgICAgICAgICAgXCJyZW1hcmtcIjogXCJcIixcbiAgICAgICAgICAgICAgXCJkZXZfYWxpYXNcIjogXCJcIlxuICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICAgICAgcHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuICAgICAgY29uc29sZS5sb2coJ1Byb21pc2UuYWxsJywgZGF0YSk7XG4gICAgICBjb25zdCByZXR1cm5EYXRhOiBhbnkgPSBbXTtcbiAgICAgIGRhdGEubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKGl0ZW0uc3VjY2Vzcykge1xuICAgICAgICAgIHJldHVybkRhdGEucHVzaChpdGVtLmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgcmVzKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogcmV0dXJuRGF0YSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOa4hemZpOS4gOS6m3RpbWVvdXTnrYlcbiAgICovXG4gIGNsZWFuID0gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXQpO1xuICAgIHRoaXMudGltZW91dCA9IG51bGw7XG4gICAgY2xlYXJJbnRlcnZhbCh0aGlzLlVEUEludGVydmFsKTtcbiAgICB0aGlzLlVEUEludGVydmFsID0gbnVsbDtcbiAgICB0aGlzLm1haW5SZXMgPSBudWxsO1xuICAgIHd4LnN0b3BMb2NhbFNlcnZpY2VEaXNjb3ZlcnkoKTtcbiAgICB0aGlzLmRpc2FibGVTZWFyY2hEZXZpY2UgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIOWBnOatoumFjee9kVxuICAgKi9cbiAgc3RvcERldmljZU9uYm9hcmRpbmdEZXBsb3kgPSAoKSA9PiB7XG4gICAgaWYgKHRoaXMubWFpblJlcykge1xuICAgICAgdGhpcy5tYWluUmVzKHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycjoge1xuICAgICAgICAgIGVycm9yQ29kZTogZXJyb3JDb2RlLlNUT1AsXG4gICAgICAgICAgZXJyb3JNZXNzYWdlOiAn5omL5Yqo5YGc5q2iJ1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMuY2xlYW4oKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gY29uc3Qgc2RrID0gbmV3IFNESyh7YXBwSUQ6ICcnLCBhcHBTZWNyZXQ6ICcnfSk7XG4vLyBzZGsuc2VuZENvbmZpZyh7c3NpZDogJ2dpendpdHMnLCBwYXNzd29yZDogJ2dpeiQyMDI1J30sIHt9IGFzIGFueSk7XG5leHBvcnQgZGVmYXVsdCBTREs7Il19
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
                const searchDeviceHandle = () => __awaiter(this, void 0, void 0, function* () {
                    console.log('searchDeviceHandle');
                    this.UDPSocket.offMessage();
                    this.UDPSocket.offError();
                    this.disableSendUDP = true;
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
                    console.log('query randomcode');
                    const data = yield openApiRequest_1.default(`/app/device_register?random_codes=${codeStr}`, { method: 'get' });
                    console.log('query randomcode', data);
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
                this.callBack = (data) => __awaiter(this, void 0, void 0, function* () {
                    console.log('onLocalServiceFound', data);
                    this.callBack = null;
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
                });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2RrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyQ0FBb0M7QUFDcEMsNkNBQTBDO0FBQzFDLHFDQUF5QztBQUN6QyxxREFBdUM7QUFDdkMsNkJBQThCO0FBQzlCLG1DQUE0QjtBQXdFNUIsTUFBTSxHQUFHO0lBQ1AsWUFBWSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsa0JBQWtCLEVBQUUsd0JBQXdCLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBVTtRQTBCcEgsVUFBSyxHQUFXLEVBQUUsQ0FBQztRQUNuQixjQUFTLEdBQVcsRUFBRSxDQUFDO1FBQ3ZCLFVBQUssR0FBVyxFQUFFLENBQUM7UUFDbkIsUUFBRyxHQUFXLEVBQUUsQ0FBQztRQUNqQixjQUFTLEdBQVEsSUFBSSxDQUFDO1FBQ3RCLG1CQUFjLEdBQVksS0FBSyxDQUFDO1FBR2hDLFlBQU8sR0FBUSxJQUFJLENBQUM7UUFDcEIsdUJBQWtCLEdBQWEsRUFBRSxDQUFDO1FBQ2xDLDZCQUF3QixHQUFhLEVBQUUsQ0FBQztRQUd4Qyx3QkFBbUIsR0FBWSxLQUFLLENBQUM7UUFNckMsY0FBUyxHQUFHLENBQUMsZ0JBQTBDLEVBQUUsRUFBRTtZQUN6RCxJQUFJLGdCQUFnQixJQUFJLGdCQUFnQixDQUFDLFdBQVcsRUFBRTthQUVyRDtpQkFBTTtnQkFDTCxnQkFBZ0IsR0FBRztvQkFDakIsV0FBVyxFQUFFLGlCQUFpQjtpQkFDL0IsQ0FBQzthQUNIO1lBQ0Qsc0JBQWEsQ0FBQyxrQkFBa0IsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3RELENBQUMsQ0FBQTtRQUtELGlCQUFZLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLEVBQWlFLEVBQUUsTUFBZSxFQUFPLEVBQUU7WUFDM0ksT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO2dCQUN6QixP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bnRlbnQiOlsiaW1wb3J0IGVycm9yQ29kZSBmcm9tIFwiLi9lcnJvckNvZGVcIjtcbmltcG9ydCBnZXRSYW5kb21Db2RlcyBmcm9tIFwiLi9yYW5kb21Db2RlXCI7XG5pbXBvcnQgeyBzZXRHbG9iYWxEYXRhIH0gZnJvbSBcIi4vZ2xvYmFsXCI7XG5pbXBvcnQgcmVxdWVzdCBmcm9tIFwiLi9vcGVuQXBpUmVxdWVzdFwiO1xuaW1wb3J0IE1ENSA9IHJlcXVpcmUoJy4vbWQ1Jyk7XG5pbXBvcnQgc2xlZXAgZnJvbSAnLi9zbGVlcCc7XG5cbmludGVyZmFjZSBJU2V0RGV2aWNlT25ib2FyZGluZ0RlcGxveVByb3BzIHtcbiAgc3NpZDogc3RyaW5nO1xuICBwYXNzd29yZDogc3RyaW5nO1xuICB0aW1lb3V0OiBudW1iZXI7XG4gIGlzQmluZD86IGJvb2xlYW47XG4gIHNvZnRBUFNTSURQcmVmaXg6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElEZXZpY2Uge1xuICBtYWM6IHN0cmluZztcbiAgcHJvZHVjdF9rZXk6IHN0cmluZztcbiAgZGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgc25vPzogc3RyaW5nO1xuICBtYW51ZmFjdHVyZXI/OiBhbnk7XG4gIGFsaWFzPzogc3RyaW5nO1xuICBvbmxpbmVTdGF0dXM6IGJvb2xlYW47XG4gIG5ldFN0YXR1czogbnVtYmVyO1xuICBpc1N1YnNjcmliZWQ/OiBib29sZWFuO1xuICBtZXNoSUQ/OiBzdHJpbmc7XG4gIGlzQmluZD86IGJvb2xlYW47XG4gIGlzT25saW5lPzogYm9vbGVhbjtcbiAgcmVtYXJrPzogc3RyaW5nO1xuICBzaXRlR2lkOiBzdHJpbmc7XG4gIGlkPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSUVyciB7XG4gIGVycm9yQ29kZTogU3ltYm9sO1xuICBlcnJvck1lc3NhZ2U6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElSZXN1bHQge1xuICBzdWNjZXNzOiBib29sZWFuO1xuICBkYXRhPzogSURldmljZSB8IG51bGw7XG4gIGVycj86IElFcnI7XG59XG5cbmludGVyZmFjZSBJVGFyZ2V0IHtcbiAgc2VydmljZVR5cGU6IHN0cmluZztcbiAgc2VydmljZU5hbWU6IHN0cmluZztcbiAgaXA6IHN0cmluZztcbiAgcG9ydDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSVNESyB7XG4gIGFwcElEOiBzdHJpbmc7XG4gIGFwcFNlY3JldDogc3RyaW5nO1xuICB0aW1lb3V0OiBhbnk7XG4gIGRpc2FibGVTZW5kVURQOiBhbnk7XG4gIGNvbmZpZ0RldmljZSh7IHNzaWQsIHBhc3N3b3JkIH06IHsgc3NpZDogc3RyaW5nOyBwYXNzd29yZDogc3RyaW5nIH0sIHRhcmdldDogSVRhcmdldCk6IGFueTtcbiAgc2V0RGV2aWNlT25ib2FyZGluZ0RlcGxveSh7XG4gICAgc3NpZCwgcGFzc3dvcmQsIHRpbWVvdXQsIGlzQmluZCB9OiBJU2V0RGV2aWNlT25ib2FyZGluZ0RlcGxveVByb3BzKTogYW55O1xuICBzdG9wRGV2aWNlT25ib2FyZGluZ0RlcGxveSgpOiB2b2lkO1xufVxuXG5pbnRlcmZhY2UgSUNsb3VkU2VydmljZUluZm8ge1xuICBvcGVuQVBJSW5mbzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSVByb3BzIHtcbiAgYXBwSUQ6IHN0cmluZztcbiAgYXBwU2VjcmV0OiBzdHJpbmc7XG4gIHNwZWNpYWxQcm9kdWN0S2V5czogc3RyaW5nW107XG4gIHNwZWNpYWxQcm9kdWN0S2V5U2VjcmV0czogc3RyaW5nW107XG4gIGNsb3VkU2VydmljZUluZm86IElDbG91ZFNlcnZpY2VJbmZvIHwgbnVsbDtcbiAgdG9rZW46IHN0cmluZztcbiAgdWlkOiBzdHJpbmc7XG59XG5cbmNsYXNzIFNESyBpbXBsZW1lbnRzIElTREsge1xuICBjb25zdHJ1Y3Rvcih7IGFwcElELCBhcHBTZWNyZXQsIHNwZWNpYWxQcm9kdWN0S2V5cywgc3BlY2lhbFByb2R1Y3RLZXlTZWNyZXRzLCBjbG91ZFNlcnZpY2VJbmZvLCB0b2tlbiwgdWlkIH06IElQcm9wcykge1xuICAgIHRoaXMuYXBwSUQgPSBhcHBJRDtcbiAgICB0aGlzLmFwcFNlY3JldCA9IGFwcFNlY3JldDtcbiAgICB0aGlzLnNwZWNpYWxQcm9kdWN0S2V5cyA9IHNwZWNpYWxQcm9kdWN0S2V5cztcbiAgICB0aGlzLnNwZWNpYWxQcm9kdWN0S2V5U2VjcmV0cyA9IHNwZWNpYWxQcm9kdWN0S2V5U2VjcmV0cztcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy51aWQgPSB1aWQ7XG5cbiAgICBzZXRHbG9iYWxEYXRhKCdhcHBJRCcsIGFwcElEKTtcbiAgICBzZXRHbG9iYWxEYXRhKCdhcHBTZWNyZXQnLCBhcHBTZWNyZXQpO1xuICAgIHNldEdsb2JhbERhdGEoJ3NwZWNpYWxQcm9kdWN0S2V5cycsIHNwZWNpYWxQcm9kdWN0S2V5cyk7XG4gICAgc2V0R2xvYmFsRGF0YSgnc3BlY2lhbFByb2R1Y3RLZXlTZWNyZXRzJywgc3BlY2lhbFByb2R1Y3RLZXlTZWNyZXRzKTtcbiAgICBzZXRHbG9iYWxEYXRhKCd0b2tlbicsIHRva2VuKTtcbiAgICBzZXRHbG9iYWxEYXRhKCd1aWQnLCB1aWQpO1xuXG5cbiAgICAvKipcbiAgICAgKiDlkIzml7bkuZ/orr7nva7ln5/lkI3kv6Hmga9cbiAgICAgKi9cbiAgICB0aGlzLnNldERvbWFpbihjbG91ZFNlcnZpY2VJbmZvKTtcblxuICAgIHd4Lm9uTG9jYWxTZXJ2aWNlRm91bmQoKGRhdGE6IGFueSkgPT4ge1xuICAgICAgdGhpcy5jYWxsQmFjayAmJiB0aGlzLmNhbGxCYWNrKGRhdGEpO1xuICAgIH0pO1xuICB9XG5cbiAgYXBwSUQ6IHN0cmluZyA9ICcnO1xuICBhcHBTZWNyZXQ6IHN0cmluZyA9ICcnO1xuICB0b2tlbjogc3RyaW5nID0gJyc7XG4gIHVpZDogc3RyaW5nID0gJyc7XG4gIFVEUFNvY2tldDogYW55ID0gbnVsbDtcbiAgZGlzYWJsZVNlbmRVRFA6IGJvb2xlYW4gPSBmYWxzZTtcbiAgY2FsbEJhY2s6IGFueTtcblxuICB0aW1lb3V0OiBhbnkgPSBudWxsO1xuICBzcGVjaWFsUHJvZHVjdEtleXM6IHN0cmluZ1tdID0gW107XG4gIHNwZWNpYWxQcm9kdWN0S2V5U2VjcmV0czogc3RyaW5nW10gPSBbXTtcblxuXG4gIGRpc2FibGVTZWFyY2hEZXZpY2U6IGJvb2xlYW4gPSBmYWxzZTtcbiAgbWFpblJlczogYW55OyAvLyDkv53lrZhwcm9taXNl55qEcmVz77yM55So5LqO5Li05pe25Lit5patXG5cbiAgLyoqXG4gICAqIOiuvue9ruWfn+WQjVxuICAgKi9cbiAgc2V0RG9tYWluID0gKGNsb3VkU2VydmljZUluZm86IElDbG91ZFNlcnZpY2VJbmZvIHwgbnVsbCkgPT4ge1xuICAgIGlmIChjbG91ZFNlcnZpY2VJbmZvICYmIGNsb3VkU2VydmljZUluZm8ub3BlbkFQSUluZm8pIHtcblxuICAgIH0gZWxzZSB7XG4gICAgICBjbG91ZFNlcnZpY2VJbmZvID0ge1xuICAgICAgICBvcGVuQVBJSW5mbzogJ2FwaS5naXp3aXRzLmNvbScsXG4gICAgICB9O1xuICAgIH1cbiAgICBzZXRHbG9iYWxEYXRhKCdjbG91ZFNlcnZpY2VJbmZvJywgY2xvdWRTZXJ2aWNlSW5mbyk7XG4gIH1cblxuICAvKipcbiAgICog6LSf6LSj5Y+R5oyH5LukXG4gICAqL1xuICBjb25maWdEZXZpY2UgPSAoeyBzc2lkLCBwYXNzd29yZCwgc29mdEFQU1NJRFByZWZpeCB9OiB7IHNzaWQ6IHN0cmluZzsgcGFzc3dvcmQ6IHN0cmluZzsgc29mdEFQU1NJRFByZWZpeDogc3RyaW5nOyB9LCB0YXJnZXQ6IElUYXJnZXQpOiBhbnkgPT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnc3RhcnQgY29uZmlnIGRldmljZScpO1xuICAgICAgbGV0IG9uTmV0d29ya0ZsYWcgPSB0cnVlO1xuXG4gICAgICBjb25zdCBoZWFkZXIgPSBbMCwgMCwgMCwgM107XG4gICAgICBsZXQgbGVuZ3RoOiBudW1iZXJbXSA9IFtdO1xuICAgICAgY29uc3QgZmxhZyA9IFswXTtcbiAgICAgIGNvbnN0IGNtZCA9IFswLCAxXTtcbiAgICAgIGNvbnN0IHNzaWRMZW5ndGggPSBbMCwgc3NpZC5sZW5ndGhdO1xuICAgICAgY29uc3QgcGFzc3dvcmRMZW5ndGggPSBbMCwgcGFzc3dvcmQubGVuZ3RoXTtcblxuICAgICAgbGV0IEFTU0lEOiBudW1iZXJbXSA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzc2lkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIEFTU0lELnB1c2goc3NpZFtpXS5jaGFyQ29kZUF0KDApKTtcbiAgICAgIH1cblxuICAgICAgbGV0IEFQYXNzd29yZDogbnVtYmVyW10gPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFzc3dvcmQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgQVBhc3N3b3JkLnB1c2gocGFzc3dvcmRbaV0uY2hhckNvZGVBdCgwKSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBmbGFnLmNvbmNhdChjbWQsIHNzaWRMZW5ndGgsIEFTU0lELCBwYXNzd29yZExlbmd0aCwgQVBhc3N3b3JkKTtcbiAgICAgIC8vIGxlbmd0aCA9IGNvbnRlbnQubGVuZ3RoLnRvU3RyaW5nKDE2KTtcblxuICAgICAgbGV0IGNvbnRlbnRMZW5ndGggPSBjb250ZW50Lmxlbmd0aDtcbiAgICAgIHdoaWxlIChjb250ZW50TGVuZ3RoID4gMCkge1xuICAgICAgICBsZW5ndGgucHVzaChjb250ZW50TGVuZ3RoKTtcbiAgICAgICAgY29udGVudExlbmd0aCAtPSAyNTU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbmZpZyA9IGhlYWRlci5jb25jYXQobGVuZ3RoKS5jb25jYXQoY29udGVudCk7XG4gICAgICBjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoY29uZmlnLmxlbmd0aCk7XG4gICAgICBjb25zdCB1aW50OEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKVxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWZmZXIuYnl0ZUxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHVpbnQ4QXJyYXlbaV0gPSBjb25maWdbaV07XG4gICAgICB9XG4gICAgICAvKipcbiAgICAgICAqIOi/nuaOpXNvY2tldCDlj5HpgIFcbiAgICAgICAqL1xuICAgICAgdGhpcy5VRFBTb2NrZXQgPSB3eC5jcmVhdGVVRFBTb2NrZXQoKTtcbiAgICAgIHRoaXMuVURQU29ja2V0LmJpbmQoKTtcblxuICAgICAgdGhpcy5kaXNhYmxlU2VuZFVEUCA9IGZhbHNlO1xuICAgICAgY29uc3QgcXVlcnkgPSAoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLmRpc2FibGVTZW5kVURQKSByZXR1cm47XG4gICAgICAgIGNvbnNvbGUubG9nKCdzZW5kIHVkcCcpO1xuICAgICAgICB0aGlzLlVEUFNvY2tldC5zZW5kKHtcbiAgICAgICAgICBhZGRyZXNzOiB0YXJnZXQuaXAsXG4gICAgICAgICAgcG9ydDogdGFyZ2V0LnBvcnQsXG4gICAgICAgICAgbWVzc2FnZTogdWludDhBcnJheSxcbiAgICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgICAgbGVuZ3RoOiB1aW50OEFycmF5LmJ5dGVMZW5ndGgsXG4gICAgICAgIH0pO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICBxdWVyeSgpO1xuICAgICAgICB9LCAyMDAwKVxuICAgICAgfVxuXG4gICAgICAvLyDmiafooYxcbiAgICAgIHF1ZXJ5KCk7XG5cbiAgICAgIHRoaXMuVURQU29ja2V0Lm9uRXJyb3IoKGRhdGE6IGFueSkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnb24gdWRwIEVycm9yJywgZGF0YSk7XG4gICAgICAgIC8vIFVEUFNvY2tldC5jbG9zZSgpO1xuICAgICAgICB0aGlzLmNsZWFuKCk7XG4gICAgICAgIHJlcyh7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXJyOiB7XG4gICAgICAgICAgICBlcnJvckNvZGU6IGVycm9yQ29kZS5XRUNIQVRfRVJST1IsXG4gICAgICAgICAgICBlcnJvck1lc3NhZ2U6IGRhdGEuZXJyTXNnXG4gICAgICAgICAgfVxuICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIOa4heeQhuS4gOS6m+ebkeWQrO+8jOiwg+eUqOaQnOe0ouiuvuWkh1xuICAgICAgY29uc3Qgc2VhcmNoRGV2aWNlSGFuZGxlID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnc2VhcmNoRGV2aWNlSGFuZGxlJyk7XG4gICAgICAgIHRoaXMuVURQU29ja2V0Lm9mZk1lc3NhZ2UoKTtcbiAgICAgICAgdGhpcy5VRFBTb2NrZXQub2ZmRXJyb3IoKTtcbiAgICAgICAgdGhpcy5kaXNhYmxlU2VuZFVEUCA9IHRydWU7XG4gICAgICAgIC8vIOagh+iusOWPr+S7peWBnOatouebkeWQrFxuICAgICAgICBvbk5ldHdvcmtGbGFnID0gZmFsc2U7XG4gICAgICAgIC8vIOWFs+mXrXNvY2tldFxuICAgICAgICBjb25zdCBkZXZpY2VzUmV0dXJuID0gYXdhaXQgdGhpcy5zZWFyY2hEZXZpY2UoeyBzc2lkLCBwYXNzd29yZCB9KTtcbiAgICAgICAgY29uc29sZS5sb2coJ3NlYXJjaERldmljZUhhbmRsZScsIGRldmljZXNSZXR1cm4pO1xuICAgICAgICByZXMoZGV2aWNlc1JldHVybik7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuVURQU29ja2V0Lm9uTWVzc2FnZShhc3luYyAoZGF0YTogYW55KSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdvbiB1ZHAgTWVzc2FnZScsIGRhdGEpO1xuICAgICAgICAvLyDmlLbliLDlm57osIMg5Y+v5Lul5YGc5q2i5Y+R5YyFXG4gICAgICAgIHNlYXJjaERldmljZUhhbmRsZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIHd4Lm9uTmV0d29ya1N0YXR1c0NoYW5nZShhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIOWPkeeUn+e9kee7nOWIh+aNoueahOaXtuWAmeS5n+WBnOatouWPkeWMhe+8jOi/m+WFpeWkp+W+queOr+mFjee9kVxuICAgICAgICBvbk5ldHdvcmtGbGFnICYmIHd4LmdldENvbm5lY3RlZFdpZmkoe1xuICAgICAgICAgIHN1Y2Nlc3M6IGFzeW5jIChkYXRhKSA9PiB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIOajgOafpeW9k+WJjee9kee7nOi/mOaYr+S4jeaYr+eDreeCuee9kee7nFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAoZGF0YS53aWZpLlNTSUQuaW5kZXhPZihzb2Z0QVBTU0lEUHJlZml4KSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgc2VhcmNoRGV2aWNlSGFuZGxlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5aSn5b6q546v56Gu6K6kXG4gICAqL1xuICBzZWFyY2hEZXZpY2UgPSBhc3luYyAoeyBzc2lkLCBwYXNzd29yZCB9KSA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXMpID0+IHtcbiAgICAgIC8vIOi/nue7reWPkei1t+ivt+axgiDnoa7orqTlpKflvqrnjq9cbiAgICAgIGNvbnN0IGNvZGVzID0gZ2V0UmFuZG9tQ29kZXMoeyBTU0lEOiBzc2lkLCBwYXNzd29yZDogcGFzc3dvcmQsIHBrczogdGhpcy5zcGVjaWFsUHJvZHVjdEtleXMgfSk7XG4gICAgICBjb25zb2xlLmxvZygnZ2V0UmFuZG9tQ29kZXMnLCBjb2Rlcyk7XG4gICAgICBsZXQgY29kZVN0ciA9ICcnO1xuICAgICAgY29kZXMubWFwKGl0ZW0gPT4ge1xuICAgICAgICBjb2RlU3RyICs9IGAke2l0ZW19LGBcbiAgICAgIH0pXG4gICAgICBjb2RlU3RyID0gY29kZVN0ci5zdWJzdHJpbmcoMCwgY29kZVN0ci5sZW5ndGggLSAxKTtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5kaXNhYmxlU2VhcmNoRGV2aWNlKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKCdxdWVyeSByYW5kb21jb2RlJyk7XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcXVlc3QoYC9hcHAvZGV2aWNlX3JlZ2lzdGVyP3JhbmRvbV9jb2Rlcz0ke2NvZGVTdHJ9YCwgeyBtZXRob2Q6ICdnZXQnIH0pO1xuICAgICAgICBjb25zb2xlLmxvZygncXVlcnkgcmFuZG9tY29kZScsIGRhdGEpO1xuXG4gICAgICAgIGlmIChkYXRhLnN1Y2Nlc3MpIHtcbiAgICAgICAgICBpZiAoZGF0YS5kYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLy8g6YeN5paw6K+35rGCXG4gICAgICAgICAgICBhd2FpdCBzbGVlcCgzMDAwKTtcbiAgICAgICAgICAgIHF1ZXJ5KCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIOaQnOe0ouWIsOiuvuWkh1xuICAgICAgICAgICAgcmVzKHtcbiAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgZGF0YTogZGF0YS5kYXRhXG4gICAgICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXMoe1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnI6IHtcbiAgICAgICAgICAgICAgZXJyb3JDb2RlOiBlcnJvckNvZGUuQVBJX0VSUk9SLFxuICAgICAgICAgICAgICBlcnJvck1lc3NhZ2U6ICdhcGkgZXJyb3InLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBxdWVyeSgpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOmFjee9keaOpeWPo1xuICAgKiBzZXREZXZpY2VPbmJvYXJkaW5nRGVwbG955pa55rOV5LiN5Y+v6YeN5aSN6LCD55SoXG4gICAqL1xuICBzZXREZXZpY2VPbmJvYXJkaW5nRGVwbG95ID0gKHtcbiAgICBzc2lkLCBwYXNzd29yZCwgdGltZW91dCwgaXNCaW5kID0gdHJ1ZSwgc29mdEFQU1NJRFByZWZpeCB9OiBJU2V0RGV2aWNlT25ib2FyZGluZ0RlcGxveVByb3BzKTogYW55ID0+IHtcbiAgICB0aGlzLmNsZWFuKCk7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXMpID0+IHtcbiAgICAgIGlmICh0aGlzLnRpbWVvdXQpIHtcbiAgICAgICAgLy8g5pa55rOV6L+Y5Zyo5omn6KGM5LitXG4gICAgICAgIHJlcyh7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXJyOiB7XG4gICAgICAgICAgICBlcnJvckNvZGU6IGVycm9yQ29kZS5FWEVDVVRJTkcsXG4gICAgICAgICAgICBlcnJvck1lc3NhZ2U6ICdleGVjdXRpbmcnLFxuICAgICAgICAgIH1cbiAgICAgICAgfSBhcyBJUmVzdWx0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5tYWluUmVzID0gcmVzO1xuICAgICAgdGhpcy5kaXNhYmxlU2VhcmNoRGV2aWNlID0gZmFsc2U7XG4gICAgICAvKipcbiAgICAgICAqIOiuvue9rui2heaXtuaXtumXtFxuICAgICAgICovXG4gICAgICB0aGlzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgLy8g6LaF5pe2XG4gICAgICAgIHJlcyh7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXJyOiB7XG4gICAgICAgICAgICBlcnJvckNvZGU6IGVycm9yQ29kZS5USU1FX09VVCxcbiAgICAgICAgICAgIGVycm9yTWVzc2FnZTogJ3RpbWUgb3V0JyxcbiAgICAgICAgICB9IGFzIElFcnJcbiAgICAgICAgfSBhcyBJUmVzdWx0KTtcbiAgICAgICAgdGhpcy5jbGVhbigpO1xuICAgICAgfSwgdGltZW91dCAqIDEwMDApO1xuXG4gICAgICAvKipcbiAgICAgICAqIOWPkeeOsOiuvuWkh1xuICAgICAgICog5rOo5YaMY2FsbGJhY2sg55uR5ZCs5Y+R546w5Zue5o6JXG4gICAgICAgKi9cbiAgICAgIHRoaXMuY2FsbEJhY2sgPSBhc3luYyAoZGF0YTogYW55KSA9PiB7XG4gICAgICAgIC8vIOaJvuWIsOacjeWKoSDlj5HpgIHmjIfku6QgXG4gICAgICAgIGNvbnNvbGUubG9nKCdvbkxvY2FsU2VydmljZUZvdW5kJywgZGF0YSk7XG4gICAgICAgIC8vIOWBnOatouWPkeeOsFxuICAgICAgICB0aGlzLmNhbGxCYWNrID0gbnVsbDtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jb25maWdEZXZpY2UoeyBzc2lkLCBwYXNzd29yZCwgc29mdEFQU1NJRFByZWZpeCB9LCBkYXRhKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgLy8g5Y+R6LW357uR5a6aXG4gICAgICAgICAgaWYgKGlzQmluZCkge1xuICAgICAgICAgICAgY29uc3QgYmluZERhdGEgPSBhd2FpdCB0aGlzLmJpbmREZXZpY2VzKHJlc3VsdC5kYXRhKTtcbiAgICAgICAgICAgIGlmIChiaW5kRGF0YS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgIHJlcyh7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgICAgICAgICAgfSBhcyBJUmVzdWx0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlcyh7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyOiB7XG4gICAgICAgICAgICAgICAgICBlcnJvckNvZGU6IGVycm9yQ29kZS5CSU5EX0ZBSUwsXG4gICAgICAgICAgICAgICAgICBlcnJvck1lc3NhZ2U6ICfnu5HlrprlpLHotKUnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMoe1xuICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgICAgICAgIH0gYXMgSVJlc3VsdCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8g6Kej5p6Q6ZSZ6K+v56CBXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgd3guc3RvcExvY2FsU2VydmljZURpc2NvdmVyeSh7XG4gICAgICAgIGNvbXBsZXRlOiAoKSA9PiB7XG4gICAgICAgICAgd3guc3RhcnRMb2NhbFNlcnZpY2VEaXNjb3Zlcnkoe1xuICAgICAgICAgICAgc2VydmljZVR5cGU6ICdfZXhhbXBsZS5fdWRwJyxcbiAgICAgICAgICAgIHN1Y2Nlc3M6IChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgIC8vIOiwg+eUqOWPkeeOsOaIkOWKn1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmYWlsOiAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgIC8vIOiwg+eUqOWPkeeOsOWksei0pVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgICByZXMoe1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycjoge1xuICAgICAgICAgICAgICAgICAgZXJyb3JDb2RlOiBlcnJvckNvZGUuV0VDSEFUX0VSUk9SLFxuICAgICAgICAgICAgICAgICAgZXJyb3JNZXNzYWdlOiBlcnIuZXJyTXNnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGFzIElSZXN1bHQpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog57uR5a6a5aSa5Liq6K6+5aSHXG4gICAqL1xuICBiaW5kRGV2aWNlcyA9IChkZXZpY2VzOiBJRGV2aWNlW10pOiBhbnkgPT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzKSA9PiB7XG4gICAgICBjb25zdCBwcm9taXNlczogYW55ID0gW107XG5cbiAgICAgIGxldCB0aW1lc3RhbXAgPSBEYXRlLnBhcnNlKGAke25ldyBEYXRlKCl9YCk7XG4gICAgICB0aW1lc3RhbXAgPSB0aW1lc3RhbXAgLyAxMDAwO1xuXG4gICAgICBkZXZpY2VzLm1hcChpdGVtID0+IHtcblxuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuc3BlY2lhbFByb2R1Y3RLZXlzLmZpbmRJbmRleChwayA9PiBpdGVtLnByb2R1Y3Rfa2V5ID09PSBwayk7XG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHJldHVybjtcbiAgICAgICAgY29uc3QgcHMgPSB0aGlzLnNwZWNpYWxQcm9kdWN0S2V5U2VjcmV0c1tpbmRleF07XG4gICAgICAgIGNvbnN0IHByb21pc2UgPSByZXF1ZXN0KFxuICAgICAgICAgICcvYXBwL2JpbmRfbWFjJyxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ1gtR2l6d2l0cy1UaW1lc3RhbXAnOiB0aW1lc3RhbXAsXG4gICAgICAgICAgICAgICdYLUdpendpdHMtU2lnbmF0dXJlJzogTUQ1KGAke3BzfSR7dGltZXN0YW1wfWApLnRvTG93ZXJDYXNlKCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICBcInByb2R1Y3Rfa2V5XCI6IGl0ZW0ucHJvZHVjdF9rZXksXG4gICAgICAgICAgICAgIFwibWFjXCI6IGl0ZW0ubWFjLFxuICAgICAgICAgICAgICBcInJlbWFya1wiOiBcIlwiLFxuICAgICAgICAgICAgICBcImRldl9hbGlhc1wiOiBcIlwiXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICAgICAgcHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuICAgICAgY29uc29sZS5sb2coJ1Byb21pc2UuYWxsJywgZGF0YSk7XG4gICAgICBjb25zdCByZXR1cm5EYXRhOiBhbnkgPSBbXTtcbiAgICAgIGRhdGEubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKGl0ZW0uc3VjY2Vzcykge1xuICAgICAgICAgIHJldHVybkRhdGEucHVzaChpdGVtLmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgcmVzKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogcmV0dXJuRGF0YSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOa4hemZpOS4gOS6m3RpbWVvdXTnrYlcbiAgICovXG4gIGNsZWFuID0gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXQpO1xuICAgIHRoaXMudGltZW91dCA9IG51bGw7XG4gICAgdGhpcy5tYWluUmVzID0gbnVsbDtcbiAgICB0aGlzLmNhbGxCYWNrID0gbnVsbDtcbiAgICB3eC5zdG9wTG9jYWxTZXJ2aWNlRGlzY292ZXJ5KCk7XG4gICAgdGhpcy5kaXNhYmxlU2VhcmNoRGV2aWNlID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5VRFBTb2NrZXQpIHtcbiAgICAgIHRoaXMuVURQU29ja2V0Lm9mZkVycm9yKCk7XG4gICAgICB0aGlzLlVEUFNvY2tldC5vZmZNZXNzYWdlKCk7XG4gICAgICB0aGlzLlVEUFNvY2tldC5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlgZzmraLphY3nvZFcbiAgICovXG4gIHN0b3BEZXZpY2VPbmJvYXJkaW5nRGVwbG95ID0gKCkgPT4ge1xuICAgIGlmICh0aGlzLm1haW5SZXMpIHtcbiAgICAgIHRoaXMubWFpblJlcyh7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnI6IHtcbiAgICAgICAgICBlcnJvckNvZGU6IGVycm9yQ29kZS5TVE9QLFxuICAgICAgICAgIGVycm9yTWVzc2FnZTogJ+aJi+WKqOWBnOatoidcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0aGlzLmNsZWFuKCk7XG4gICAgfVxuICB9XG59XG5cbi8vIGNvbnN0IHNkayA9IG5ldyBTREsoe2FwcElEOiAnJywgYXBwU2VjcmV0OiAnJ30pO1xuLy8gc2RrLnNlbmRDb25maWcoe3NzaWQ6ICdnaXp3aXRzJywgcGFzc3dvcmQ6ICdnaXokMjAyNSd9LCB7fSBhcyBhbnkpO1xuZXhwb3J0IGRlZmF1bHQgU0RLOyJdfQ==
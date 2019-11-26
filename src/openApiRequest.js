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
const request_1 = require("./request");
const global_1 = require("./global");
function openApiRequest(url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const requestOptions = Object.assign({}, options);
        const headers = {
            'Content-Type': 'application/json',
            'X-Gizwits-Application-Id': global_1.getGlobalData('appID'),
        };
        headers['X-Gizwits-User-token'] = global_1.getGlobalData('token');
        requestOptions.header = Object.assign({}, headers, options.headers);
        delete requestOptions.headers;
        console.log(`openApi request ${url}`, requestOptions);
        const openApiUrl = global_1.getGlobalData('cloudServiceInfo').openAPIInfo;
        return request_1.default('https://' + openApiUrl + url, requestOptions);
    });
}
exports.default = openApiRequest;

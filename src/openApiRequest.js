"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("./request");
const global_1 = require("./global");
function openApiRequest(url, options) {
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
}
exports.default = openApiRequest;

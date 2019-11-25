"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function request(url, options) {
    return new Promise((res, ret) => {
        wx.request(Object.assign({ url }, options, { success: (data) => {
                if (data.data.error_code) {
                    ret({ err: data.data, success: false });
                }
                else {
                    res({ data: data.data, success: true });
                }
            }, fail: (err) => {
                ret({ err, success: false });
            } }));
    });
}
exports.default = request;

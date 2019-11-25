"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errorCode = {
    TIME_OUT: Symbol('TIME_OUT'),
    WECHAT_ERROR: Symbol('WECHAT_ERROR'),
    STOP: Symbol('STOP'),
    EXECUTING: Symbol('EXECUTING'),
    API_ERROR: Symbol('API_ERROR'),
    BIND_FAIL: Symbol('BIND_FAIL'),
};
exports.default = errorCode;

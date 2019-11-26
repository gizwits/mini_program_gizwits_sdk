"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globalData = {};
function setGlobalData(key, value) {
    globalData[key] = value;
}
exports.setGlobalData = setGlobalData;
function getGlobalData(key) {
    return globalData[key];
}
exports.getGlobalData = getGlobalData;

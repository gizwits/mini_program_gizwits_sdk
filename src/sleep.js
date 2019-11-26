"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sleep = time => new Promise(resolve => setTimeout(() => resolve(), time));
exports.default = sleep;

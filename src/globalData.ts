const globalData: any = {};

export function setGlobalData(key: any, value: any) {
  globalData[key] = value;
}

export function getGlobalData(key: any) {
  return globalData[key];
}
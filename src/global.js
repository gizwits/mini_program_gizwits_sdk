const globalData = {};

export function setGlobalData(key, value) {
  globalData[key] = value;
}

export function getGlobalData(key) {
  return globalData[key];
}
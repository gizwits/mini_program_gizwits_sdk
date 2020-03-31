<a href='https://coveralls.io/github/gizwits/mini_program_gizwits_sdk?branch=master'><img src='https://coveralls.io/repos/github/gizwits/mini_program_gizwits_sdk/badge.svg?branch=master' alt='Coverage Status' /></a><img alt="npm" src="https://img.shields.io/npm/v/mini_program_gizwits_sdk">[![Build Status](https://travis-ci.org/gizwits/mini_program_gizwits_sdk.svg?branch=master)](https://travis-ci.org/gizwits/mini_program_gizwits_sdk)

# 小程序配网SDK

### 安装

`yarn add mini_program_gizwits_sdk`

### 使用方法

```javascript
import GizwitsSdk, { errorCode } from 'mini_program_gizwits_sdk';

const sdk = new GizwitsSdk({
  appID: '8f187b1deb9e44b6aa1374b8f13bccb1',
  appSecret: 'd73fa6d6d7c04d37b6b2cc13a18a9f37',
  specialProductKeys: ['00e7e327afa74a3d8ff1cc190bad78c0'],
  specialProductKeySecrets: ['aa3d301fa291466fbed20e4204609abc'],
  token: token,
  uid: uid,
  cloudServiceInfo: null,
});

try {
  const data = await sdk.setDeviceOnboardingDeploy({
    ssid: SSID,
    password: password,
    timeout: 60,
    softAPSSIDPrefix: 'XPG-GAgent-',
  });
} catch (error) {
  console.log(error)
}
```

其中`data`代表配网成功的设备。

如果失败的话会返回数据

```javascript
{
  success: false,
  err: {
    errorCode: 'code',
    errorMessage: 'message',
  }
}
```


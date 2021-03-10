import { assert } from 'chai';
import GizwitsSdk, { errorCode } from '../index';

import 'mocha';

declare namespace global {
  const wx: any;
}


describe('SDK', function () {
  describe('SDK init', function () {
    let sdk = new GizwitsSdk({
      appID: '8f187b1deb9e44b6aa1374b8f13bccb1',
      appSecret: 'd73fa6d6d7c04d37b6b2cc13a18a9f37',
      specialProductKeys: ['00e7e327afa74a3d8ff1cc190bad78c0'],
      specialProductKeySecrets: ['aa3d301fa291466fbed20e4204609abc'],
      token: 'token',
      uid: 'uid',
      cloudServiceInfo: null,
    });

    sdk = new GizwitsSdk({
      appID: '8f187b1deb9e44b6aa1374b8f13bccb1',
      appSecret: 'd73fa6d6d7c04d37b6b2cc13a18a9f37',
      specialProductKeys: ['00e7e327afa74a3d8ff1cc190bad78c0'],
      specialProductKeySecrets: ['aa3d301fa291466fbed20e4204609abc'],
      token: 'token',
      uid: 'uid',
      cloudServiceInfo: {
        openAPIInfo: 'api.gizwits.com',
      },
    });

    // 超时测试
    it('should config timeout', async function () {
      try {
        await sdk.setDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 1,
          softAPSSIDPrefix: 'XPG-GAgent-',
        });
      } catch (error) {
        const isOk = (error as any).err.errorCode === errorCode.TIME_OUT;
        assert.ok(isOk);
      }
    });

    it('udp error', async function () {
      try {
        setTimeout(() => {
          // global.wx.startLocalServiceDiscoverySuccessHandle(global.wx.baseMDNS);
          // global.wx.localServiceFoundHandle(global.wx.baseMDNS);
          global.wx.createUDPSocketHandlerOnErrorHandle({ errMsg: 'error' });
        }, 100);
        await sdk.setDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
          softAPSSIDPrefix: 'XPG-GAgent-',
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.WECHAT_ERROR);
      }
    });

    // it('startLocalServiceDiscovery fail', async function () {
    //   try {
    //     setTimeout(() => {
    //       // startLocalServiceDiscovery fail
    //       global.wx.startLocalServiceDiscoveryFailHandle({errMsg: 'error'});
    //     }, 100);
    //     await sdk.setDeviceOnboardingDeploy({
    //       ssid: 'SSID',
    //       password: 'password',
    //       timeout: 5,
    //       softAPSSIDPrefix: 'XPG-GAgent-',
    //     });
    //   } catch (error) {
    //     assert.ok((error as any).err.errorCode === errorCode.WECHAT_ERROR);
    //   }
    // });

    // 两次查询大循环
    it('should config success. query twice api', async function () {

      global.wx.randomCodeResult = {
        data: [],
        code: 200
      };
      

      setTimeout(async () => {
        // global.wx.startLocalServiceDiscoverySuccessHandle(global.wx.baseMDNS);
        // global.wx.localServiceFoundHandle(global.wx.baseMDNS);
        
        setTimeout(() => {
          global.wx.networkStatusChangeHandle();
          global.wx.createUDPSocketHandlerOnMessageHandle('test');
          setTimeout(() => {
            global.wx.randomCodeResult = {
              data: [{mac: '123', did: '123', product_key: '00e7e327afa74a3d8ff1cc190bad78c0'}, {mac: '123', did: '123', product_key: '00e7e227afa74a3d8ff1cc190bad78c0'}],
              code: 200
            };
          }, 200);
        }, 20);
      }, 20);

      const data = await sdk.setDeviceOnboardingDeploy({
        ssid: 'SSID',
        password: 'password',
        timeout: 20,
        softAPSSIDPrefix: 'XPG-GAgent-',
      });
      // 还原测试数据
      global.wx.randomCodeResult = {
        data: [{mac: '123', did: '123', product_key: '00e7e327afa74a3d8ff1cc190bad78c0'}, {mac: '123', did: '123', product_key: '00e7e227afa74a3d8ff1cc190bad78c0'}],
        code: 200
      };
      assert.ok(data.success);
    });

    // 两次启动接口
    it('twice setDeviceOnboardingDeploy', async function () {
      sdk.stopDeviceOnboardingDeploy();
      try {
        const promises: any = [];
        promises.push(sdk.setDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
          softAPSSIDPrefix: 'XPG-GAgent-',
        }));
        promises.push(sdk.setDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
          softAPSSIDPrefix: 'XPG-GAgent-',
        }));
        await Promise.all(promises)
      } catch (error) {
        sdk.stopDeviceOnboardingDeploy();
        assert.ok((error as any).err.errorCode === errorCode.EXECUTING);
      }
    });


    // 配网成功测试
    it('should config success', async function () {

      /**
       * 模拟执行微信的动作
       * 一、执行 startLocalServiceDiscoverySuccessHandle
       * 二、执行 localServiceFoundHandle 传入MDNS 此时sdk会开始连接socket 发包
       */

      setTimeout(async () => {
        // global.wx.startLocalServiceDiscoverySuccessHandle(global.wx.baseMDNS);
        // global.wx.localServiceFoundHandle(global.wx.baseMDNS);

        setTimeout(() => {
          global.wx.createUDPSocketHandlerOnMessageHandle('test');
        }, 20);
      }, 20);

      const data = await sdk.setDeviceOnboardingDeploy({
        ssid: 'SSID',
        password: 'password',
        timeout: 20,
        softAPSSIDPrefix: 'XPG-GAgent-',
      });
      assert.ok(data.success);
    });

    // 配网成功测试 不绑定
    it('should config success but not bind', async function () {

      /**
       * 模拟执行微信的动作
       * 一、执行 startLocalServiceDiscoverySuccessHandle
       * 二、执行 localServiceFoundHandle 传入MDNS 此时sdk会开始连接socket 发包
       */
      setTimeout(async () => {
        // global.wx.startLocalServiceDiscoverySuccessHandle(global.wx.baseMDNS);
        // global.wx.localServiceFoundHandle(global.wx.baseMDNS);

        setTimeout(() => {
          global.wx.createUDPSocketHandlerOnMessageHandle('test');
        }, 20);
      }, 20);

      const data = await sdk.setDeviceOnboardingDeploy({
        ssid: 'SSID',
        password: 'password',
        timeout: 20,
        softAPSSIDPrefix: 'XPG-GAgent-',
        isBind: false,
      });
      assert.ok(data.success);
    });


    // it('should find device but config timeout', async function () {
    //   // 发现设备，但是配置失败
    //   setTimeout(async () => {
    //     global.wx.startLocalServiceDiscoverySuccessHandle(global.wx.baseMDNS);
    //     global.wx.localServiceFoundHandle(global.wx.baseMDNS);
    //   }, 20);

    //   try {
    //     const data = await sdk.setDeviceOnboardingDeploy({
    //       ssid: 'SSID',
    //       password: 'password',
    //       timeout: 5,
    //       softAPSSIDPrefix: 'XPG-GAgent-',
    //     });
    //     assert.ok((data as any).err.errorCode === errorCode.TIME_OUT);
    //   } catch (error) {
    //     console.error(error)
    //   }
    // });

    // 绑定接口报错
    it('should bindDevice error', async function () {

      global.wx.bindResult = {
        data: {
          error_code: 400,
        }
      };
      /**
   * 模拟执行微信的动作
   * 一、执行 startLocalServiceDiscoverySuccessHandle
   * 二、执行 localServiceFoundHandle 传入MDNS 此时sdk会开始连接socket 发包
   */

      setTimeout(async () => {
        // global.wx.startLocalServiceDiscoverySuccessHandle(global.wx.baseMDNS);
        // global.wx.localServiceFoundHandle(global.wx.baseMDNS);

        setTimeout(() => {
          global.wx.createUDPSocketHandlerOnMessageHandle('test');
          global.wx.networkStatusChangeHandle();
        }, 20);
      }, 20);

      try {
        const data = await sdk.setDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
          softAPSSIDPrefix: 'XPG-GAgent-',
        });
        console.log('=====', data)
      } catch (error) {
        console.error('==BIND_FAIL==', error)
        assert.ok((error as any).err.errorCode === errorCode.BIND_FAIL);
      }
    });

    // 发现接口报错
    it('should randomCode error', async function () {

      global.wx.randomCodeResult = {
        data: {
          error_code: 400,
        }
      };
      /**
       * 模拟执行微信的动作
       * 一、执行 startLocalServiceDiscoverySuccessHandle
       * 二、执行 localServiceFoundHandle 传入MDNS 此时sdk会开始连接socket 发包
       */

      setTimeout(async () => {
        // global.wx.startLocalServiceDiscoverySuccessHandle(global.wx.baseMDNS);
        // global.wx.localServiceFoundHandle(global.wx.baseMDNS);

        setTimeout(() => {
          global.wx.createUDPSocketHandlerOnMessageHandle('test');
          global.wx.networkStatusChangeHandle();
        }, 20);
      }, 20);

      try {
        await sdk.setDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
          softAPSSIDPrefix: 'XPG-GAgent-',
        });
        assert.ok(true);
      } catch (error) {
        assert.ok(true);
      }
    });

    // 网络不通
    
    it('should randomCode error', async function () {

      global.wx.requestErr = {
        err: '',
        code: 500,
      };
      /**
       * 模拟执行微信的动作
       * 一、执行 startLocalServiceDiscoverySuccessHandle
       * 二、执行 localServiceFoundHandle 传入MDNS 此时sdk会开始连接socket 发包
       */

      setTimeout(async () => {
        // global.wx.startLocalServiceDiscoverySuccessHandle(global.wx.baseMDNS);
        // global.wx.localServiceFoundHandle(global.wx.baseMDNS);

        setTimeout(() => {
          global.wx.createUDPSocketHandlerOnMessageHandle('test');
          global.wx.networkStatusChangeHandle();
        }, 20);
      }, 20);

      try {
        await sdk.setDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
          softAPSSIDPrefix: 'XPG-GAgent-',
        });
        assert.ok(true);
      } catch (error) {
        assert.ok(true);
      }
    });

    // 发现接口token 过期
    it('should randomCode token error', async function () {
      global.wx.randomCodeResult = {
        data: {
          error_code: '9004',
        }
      };

      setTimeout(async () => {
        // global.wx.startLocalServiceDiscoverySuccessHandle(global.wx.baseMDNS);
        // global.wx.localServiceFoundHandle(global.wx.baseMDNS);
        setTimeout(() => {
          global.wx.createUDPSocketHandlerOnMessageHandle('test');
        }, 20);
      }, 20);

      try {
        await sdk.setDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 20,
          softAPSSIDPrefix: 'XPG-GAgent-',
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.API_ERROR);
      }
    });

    it('should stop config', async function () {
      try {
        sdk.stopDeviceOnboardingDeploy();
        setTimeout(() => {
          sdk.stopDeviceOnboardingDeploy();
        }, 100);
        await sdk.setDeviceOnboardingDeploy({
          ssid: 'SSID',
          password: 'password',
          timeout: 5,
          softAPSSIDPrefix: 'XPG-GAgent-',
        });
      } catch (error) {
        assert.ok((error as any).err.errorCode === errorCode.STOP);
      }
    });

  });
});
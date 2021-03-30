import { createBLEConnection, getBLEDeviceCharacteristics, getBLEDeviceServices, notifyBLECharacteristicValueChange, unpackWriteBLECharacteristicValue } from "./wechatApi";

interface IArgs {
  bleDeviceId: string,
  arrayBuffer: ArrayBuffer,
  serviceUUIDSuffix?: string;
  characteristicUUIDSuffix?: string;
}

export function sendBLEConfigCmd({
  bleDeviceId,
  arrayBuffer,
  serviceUUIDSuffix = 'abf0',
  characteristicUUIDSuffix = 'abf7',
}: IArgs) {
  return new Promise<boolean>(async (resolve, reject) => {
    try {
      await createBLEConnection(bleDeviceId, 10 * 1000);
      const services = await getBLEDeviceServices(bleDeviceId);
      const service = services.find(s => (s.uuid.split('-')[0]).toLowerCase().endsWith(serviceUUIDSuffix))
      if (!service) {
        // 获取蓝牙设备服务异常
        console.debug('GIZ_SDK: get ble device services fail', bleDeviceId, services);
        resolve(false);
        return;
      }

      const characteristics = await getBLEDeviceCharacteristics(bleDeviceId, service.uuid);
      const characteristic = characteristics.find(c => (c.uuid.split('-')[0]).toLowerCase().endsWith(characteristicUUIDSuffix))
      if (!characteristic) {
        // 获取蓝牙设备特征值异常
        console.debug('GIZ_SDK: get ble device characteristics fail', bleDeviceId, characteristics);
        resolve(false);
        return;
      }

      if (!characteristic.properties.notify && !characteristic.properties.indicate) {
        console.debug('GIZ_SDK: the ble device characteristic not support notify or indicate', bleDeviceId, characteristic);
        // 该设备不支持 notify & indicate 操作
        resolve(false);
        return;
      }

      await notifyBLECharacteristicValueChange(
        bleDeviceId,
        service.uuid,
        characteristic.uuid
      );

      const handleBLECharacteristicValueChange = () => {
        // 发送成功
        wx.offBLECharacteristicValueChange(handleBLECharacteristicValueChange);
        resolve(true);
      }

      // 订阅特征值变化
      wx.onBLECharacteristicValueChange(handleBLECharacteristicValueChange);
      // 写特征值
      await unpackWriteBLECharacteristicValue(
        bleDeviceId,
        service.uuid,
        characteristic.uuid,
        arrayBuffer,
      );
    } catch (error) {
      reject(error);
    }
  }).catch(error => {
    console.debug('GIZ_SDK: sendBLEConfigCmd error', error);
    return false;
  }).finally(() => {
    // 关闭连接
    wx.closeBLEConnection({ deviceId: bleDeviceId });
  })
}
import { expect } from 'chai';
import { ab2hex, compareWXSDKVersion, isError } from '../src/utils';

import 'mocha';

describe('util', function () {
  describe('ab2hex', function () {
    it('arraybuffer to hex', function () {
      const buffer = new Uint8Array([1, 2, 3, 4, 29]);
      expect(ab2hex(buffer)).to.be.equal('010203041d')
    })
  });

  describe('compareWXSDKVersion', function () {
    it('same version', function () {
      expect(compareWXSDKVersion('1.2.0', '1.2.0')).to.equal(0);
      expect(compareWXSDKVersion('1.2', '1.2.0')).to.equal(0);
      expect(compareWXSDKVersion('1.2.0', '1.2')).to.equal(0);
    })
    it('old version', function () {
      expect(compareWXSDKVersion('1.1.9', '1.2.0')).to.equal(-1);
      expect(compareWXSDKVersion('1.1.0', '1.2.0')).to.equal(-1);
      expect(compareWXSDKVersion('0.2.0', '1.2.0')).to.equal(-1);
    })
    it('new version', function () {
      expect(compareWXSDKVersion('1.2.1', '1.2.0')).to.equal(1);
      expect(compareWXSDKVersion('1.3.0', '1.2.0')).to.equal(1);
      expect(compareWXSDKVersion('2.2.0', '1.2.0')).to.equal(1);
    })
  })

  describe('isError', function () {
    it('is error', function () {
      expect(isError({ errorCode: Symbol('123') })).to.be.true;
    })
    it('is not error', function () {
      expect(isError(null)).to.be.false;
      expect(isError({ errorCode: 0 })).to.be.false;
      expect(isError({ errorMessage: '' })).to.be.false;
    })
  })
});
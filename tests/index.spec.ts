import { assert } from 'chai';
import SDK, {errorCode} from '../index';

import 'mocha';

describe('SDK Export', function() {
  describe('errorCode', function() {
    it('should export {errorCode} ', function() {
      assert.ok(typeof errorCode === 'object');
    });
  });
  describe('SDK', function() {
    it('should export SDK ', function() {
      assert.ok(typeof SDK === 'function');
    });
  });
});
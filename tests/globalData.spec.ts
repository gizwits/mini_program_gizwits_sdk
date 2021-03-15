import { assert } from 'chai';
import { getGlobalData, setGlobalData } from '../src/globalData';

import 'mocha';

describe('Global Data Test', function () {
  it('should get success and set success', function () {
    const data = 1;
    setGlobalData('data', data);
    const result = getGlobalData('data');
    assert.ok(result === data);
  });
});
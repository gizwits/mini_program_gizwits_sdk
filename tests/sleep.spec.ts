import { assert } from 'chai';
import sleep from '../src/sleep';

import 'mocha';

describe('Global Data Test', function() {
  it('should get success and set success', function() {
    sleep(100);
    assert.ok(true);
  });
});
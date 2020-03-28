import { assert } from 'chai';
import getRandomCodes from '../src/randomCode';

import 'mocha';

describe('Global Data Test', function() {
  it('should get success and set success', function() {
    const code = getRandomCodes({ SSID: 'gizwits', password: 'giz$2025', pks: ['162866a5336c4a92a7edba1a2b07b182'] });
    assert.ok(code[0] === '1151f0754ded09e8098db90ba7f24ff5');
  });
});
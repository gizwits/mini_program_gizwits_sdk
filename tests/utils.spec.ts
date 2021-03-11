import { expect } from 'chai';
import { ab2hex } from '../src/utils';

import 'mocha';

describe('util', function () {
  it('should ab to hex', function () {
    const buffer = new Uint8Array([1, 2, 3, 4, 29]);
    expect(ab2hex(buffer)).to.be.equal('010203041d')
  });
});
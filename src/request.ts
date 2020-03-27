/**
 * Requests a URL, returning a promise.
 *
 * @param  {string} url       The URL we want to request
 * @param  {object} [options] The options we want to pass to "fetch"
 * @return {object}           An object containing either "data" or "err"
 */

import { IResult } from "./sdk";

export default function request(url: string, options: any): Promise<IResult> {
  return new Promise((res, ret) => {
    wx.request({
      url, ...options,
      success: (data: any) => {
        if (data.data.error_code) {
          ret({ err: data.data, success: false });
        } else {
          res({ data: data.data, success: true });
        }
      },
      fail: (err: any) => {
        ret({ err, success: false });
      },
    });
  });
}

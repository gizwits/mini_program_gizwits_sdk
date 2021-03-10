/**
 * Requests a URL, returning a promise.
 *
 * @param  {string} url       The URL we want to request
 * @param  {object} [options] The options we want to pass to "fetch"
 * @return {object}           An object containing either "data" or "err"
 */


export default function request<T>(url: string, options: any) {
  return new Promise<T>((res, rej) => {
    wx.request({
      url, ...options,
      success: (data: T) => {
        res(data)
      },
      fail: (err: any) => {
        rej(err);
      },
    });
  });
}

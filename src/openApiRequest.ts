import request from './request';
import { getGlobalData } from "./global";

interface IResult<T> {
  data: T & {
    error_code?: string;
  }
}

const openApiRequest = async <T>(url: string, options: any) => {
  const requestOptions = { ...options };
  const headers: any = {
    'Content-Type': 'application/json',
    'X-Gizwits-Application-Id': getGlobalData('appID'),
  };

  headers['X-Gizwits-User-token'] = getGlobalData('token');

  requestOptions.header = { ...headers, ...options.headers };
  delete requestOptions.headers;
  // console.log(`openApi request ${url}`, requestOptions);
  const openApiUrl = getGlobalData('cloudServiceInfo').openAPIInfo;
  const res = await request<IResult<T>>('https://' + openApiUrl + url, requestOptions);
  return res.data;
}

export default openApiRequest;
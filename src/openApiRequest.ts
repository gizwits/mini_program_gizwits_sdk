import request from './request';
import { getGlobalData } from "./global";


export default function openApiRequest(url: string, options: any) {

  const requestOptions = { ...options };
  const headers: any = {
    'Content-Type': 'application/json',
    'X-Gizwits-Application-Id': getGlobalData('appID'),
  };

  headers['X-Gizwits-User-token'] = getGlobalData('token');

  requestOptions.header = { ...headers, ...options.headers };
  delete requestOptions.headers;
  console.log(`openApi request ${url}`, requestOptions);
  const openApiUrl = getGlobalData('cloudServiceInfo').openAPIInfo;
  return request('https://' + openApiUrl + url, requestOptions);
}

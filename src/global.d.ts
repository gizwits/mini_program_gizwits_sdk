interface IError {
  errorCode: Symbol;
  errorMessage?: string;
}

interface ICommonObj {
  [key: string]: any
}

interface IDeviceStatusChangedProps {
  did: string;
  attrs: ICommonObj;
}

interface IDeviceRawStatusChangedProps {
  did: string;
  raw: Uint8Array;
}

interface IOnDeviceStatusChanged {
  (data: IDeviceStatusChangedProps | IDeviceRawStatusChangedProps): void;
}
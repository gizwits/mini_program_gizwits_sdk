

declare namespace md5 {
  function hex(data: any): any;
}

declare function md5(data: any): any;

type TUtf8 = {
  toBytes: (data: any) => any
}

type TUtils = {
  utf8: TUtf8;
}

interface ecb {
  new(data: any): any;
}

type TModeOfOperation = {
  ecb: ecb;
}

declare namespace aesjs {
  const utils: TUtils;
  const ModeOfOperation: TModeOfOperation;
}


export function includeParametersQuery<T extends object>(configInput: T, endpoint: string) {
  const excludedKey = ['clientId', 'clientSecret', 'host', 'redirectURI'];
  endpoint += '&';
  let i = 0;
  let key: keyof T;
  for (key in configInput) {
    if (configInput.hasOwnProperty(key) && configInput[key] !== null && configInput[key] !== undefined && !excludedKey.includes(key.toString())) {
      endpoint += key.toString() + '=' + configInput[key];
      if (i < (Object.keys(configInput).length - 1)) endpoint += '&';
      i++;
    }
  }

  return endpoint;
}
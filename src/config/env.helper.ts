import { ENV, NODE_ENV_VALUES } from '../common/constants/env.constants';

if (
  !process.env[ENV.NODE_ENV] &&
  process.argv.some((arg) => arg.includes('start:dev'))
) {
  process.env[ENV.NODE_ENV] = NODE_ENV_VALUES.LOCAL;
}

export function getEnvFilePath(): string {
  const env = process.env[ENV.NODE_ENV] || NODE_ENV_VALUES.LOCAL;

  let fileName = '.env.local';
  if (env === NODE_ENV_VALUES.PRODUCTION) fileName = '.env.production';
  else if (env === NODE_ENV_VALUES.STAGE) fileName = '.env.stage';

  return fileName;
}

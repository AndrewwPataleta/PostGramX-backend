import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { ENV, NODE_ENV_VALUES } from '../common/constants/env.constants';

let isLoaded = false;

function loadEnvFile(filePath: string, override = false): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const result = config({ path: filePath, override });
  if (result.error) {
    throw result.error;
  }
}

export function loadEnvConfig(): void {
  if (isLoaded) {
    return;
  }

  const projectRoot = path.resolve(__dirname, '..', '..');
  const defaultEnvPath = path.join(projectRoot, '.env');

  if (fs.existsSync(defaultEnvPath)) {
    loadEnvFile(defaultEnvPath);
  } else {
    const fallbackResult = config();
    const fallbackError = fallbackResult.error as
      | NodeJS.ErrnoException
      | undefined;
    if (fallbackError && fallbackError.code !== 'ENOENT') {
      throw fallbackError;
    }
  }

  if (!process.env[ENV.NODE_ENV]) {
    process.env[ENV.NODE_ENV] = NODE_ENV_VALUES.LOCAL;
  }

  const envPath = path.join(projectRoot, `.env.${process.env[ENV.NODE_ENV]}`);
  loadEnvFile(envPath, true);

  isLoaded = true;
}

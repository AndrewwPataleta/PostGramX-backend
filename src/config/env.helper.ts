import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

const logger = new Logger('Config');

// Принудительно читаем NODE_ENV из командной строки (если не определён)
if (!process.env.NODE_ENV && process.argv.some(arg => arg.includes('start:dev'))) {
    process.env.NODE_ENV = 'local';
}

export function getEnvFilePath(): string {
    const env = process.env.NODE_ENV || 'local';

    let fileName = '.env.local';
    if (env === 'production') fileName = '.env.production';
    else if (env === 'stage') fileName = '.env.stage';

    const fullPath = path.resolve(process.cwd(), fileName);

    if (!fs.existsSync(fullPath)) {
        logger.error(`❌ ENV file not found: ${fullPath}`);
    } else {
        logger.log(`🌍 NODE_ENV=${env}`);
        logger.log(`📦 Using env file: ${fileName}`);
    }

    return fileName;
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { isAdminRequestAllowed } from '../adminjs.config';

@Injectable()
export class AdminAccessMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (isAdminRequestAllowed(req)) {
      return next();
    }

    return res.status(403).json({
      statusCode: 403,
      message: 'Admin access denied.',
    });
  }
}

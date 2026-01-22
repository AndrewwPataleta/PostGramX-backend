import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { ApiError } from "../common/errors/api-error";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization as string | undefined;
    if (!header?.startsWith("Bearer ")) {
      throw new ApiError(401, "FORBIDDEN", "Authentication required");
    }

    const token = header.slice("Bearer ".length);
    try {
      const payload = jwt.verify(token, this.config.jwtSecret);
      if (typeof payload !== "object" || !payload || !("sub" in payload)) {
        throw new ApiError(401, "FORBIDDEN", "Invalid token");
      }
      request.user = { id: String((payload as { sub: string }).sub) };
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(401, "FORBIDDEN", "Invalid token");
    }
  }
}

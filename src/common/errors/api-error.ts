import { HttpException, HttpStatus } from "@nestjs/common";

export class ApiError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: Record<string, unknown>) {
    super({ code, message, details }, status);
  }

  get code(): string {
    const response = this.getResponse() as { code?: string };
    return response.code ?? "UNKNOWN";
  }
}

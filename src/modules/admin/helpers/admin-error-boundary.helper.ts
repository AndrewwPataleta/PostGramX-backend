import { adminLog, safeStringify } from './admin-logger.helper';

type AdminHandler<Response = any> = (
  request: any,
  response?: any,
  context?: any,
) => Promise<Response>;

type AdminErrorBoundaryOptions<Response> = {
  buildErrorResponse?: (
    error: unknown,
    request: any,
    response: any,
    context: any,
  ) => Response;
};

type AdminErrorDetails = {
  message: string;
  stack?: string;
};

const buildDefaultErrorResponse = <Response>(message: string): Response =>
  ({
    success: false,
    message:
      'Unable to process the request. Check the server logs for details.',
    error: message,
  }) as unknown as Response;

const formatAdminError = (error: unknown): AdminErrorDetails => {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }

  return { message: safeStringify(error) };
};

export function withAdminErrorBoundary<Response = any>(
  label: string,
  handler: AdminHandler<Response>,
  options?: AdminErrorBoundaryOptions<Response>,
): AdminHandler<Response> {
  return async (request, response, context) => {
    try {
      return await handler(request, response, context);
    } catch (error) {
      const details = formatAdminError(error);


      if (options?.buildErrorResponse) {
        return options.buildErrorResponse(error, request, response, context);
      }

      return buildDefaultErrorResponse<Response>(details.message);
    }
  };
}

declare global {
  namespace Express {
    interface User {
      id?: string | null;
      username?: string | null;
      email?: string | null;
      platformType?: string | null;
      region?: string | null;
      settings?: {
        region?: string | null;
      };
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
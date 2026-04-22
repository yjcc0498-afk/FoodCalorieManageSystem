declare module 'express-serve-static-core' {
  interface Request {
    user?: any;
    token?: string;
    loginRateLimitKey?: string;
  }
}

export {};

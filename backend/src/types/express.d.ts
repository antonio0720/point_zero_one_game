//backend/src/types/express.d.ts

export {};

declare global {
  namespace Express {
    interface Request {
      identityId?: string;
      isAuthenticated?: boolean;
      isGuest?: boolean;
    }
  }
}
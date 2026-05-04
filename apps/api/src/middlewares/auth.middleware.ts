import { Request, Response, NextFunction } from 'express';
import jwt, { JwtHeader, SigningKeyCallback, JwtPayload } from 'jsonwebtoken';
import { jwksClientInstance, keycloakConfig } from '../config/keycloak';
import { sendError } from '../utils/response';

export interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

function getSigningKey(header: JwtHeader, callback: SigningKeyCallback): void {
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'missing or invalid authorization header', 401);
    return;
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(
    token,
    getSigningKey,
    {
      algorithms: ['RS256'],
      issuer: keycloakConfig.issuer,
    },
    (err, decoded) => {
      if (err) {
        sendError(res, 'invalid or expired token', 401);
        return;
      }

      const payload = decoded as JwtPayload & {
        realm_access?: { roles?: string[] };
        email?: string;
        sub?: string;
      };

      req.user = {
        sub: payload.sub!,
        email: payload.email || '',
        roles: payload.realm_access?.roles || [],
      };

      next();
    }
  );
}

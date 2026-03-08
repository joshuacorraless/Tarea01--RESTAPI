import { Request, Response, NextFunction } from 'express';
import jwt, { JwtHeader, SigningKeyCallback, JwtPayload } from 'jsonwebtoken';
import { jwksClientInstance, keycloakConfig } from '../config/keycloak';
import { sendError } from '../utils/response';

// informacion minima del token que se adjunta a req.user
export interface TokenPayload {
  sub: string;     // keycloak user id (externalAuthId)
  email: string;
  roles: string[]; // realm roles
}

// extiende request para incluir datos del usuario autenticado
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

// callback que obtiene la clave publica de keycloak via jwks
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

// middleware que valida el jwt del header authorization contra keycloak
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

      // adjunta solo la informacion minima necesaria para autorizar
      req.user = {
        sub: payload.sub!,
        email: payload.email || '',
        roles: payload.realm_access?.roles || [],
      };

      next();
    }
  );
}

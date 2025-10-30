import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key manquante',
      message: 'Veuillez fournir une clé API via le header X-API-Key',
    });
  }

  if (apiKey !== env.API_SECRET_KEY) {
    return res.status(403).json({
      error: 'API key invalide',
      message: 'La clé API fournie n\'est pas valide',
    });
  }

  next();
};

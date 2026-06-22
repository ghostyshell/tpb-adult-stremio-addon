/**
 * express.d.ts - Augment Express Request with addon-specific fields.
 *
 * The defaultConfig middleware parses the {config} URL segment and attaches
 * the parsed AddonConfig to req.addonConfig for downstream route handlers.
 */

import type { Request } from 'express';
import type { AddonConfig } from './config';

declare module 'express-serve-static-core' {
  interface Request {
    addonConfig?: AddonConfig;
  }
}

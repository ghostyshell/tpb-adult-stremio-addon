'use strict';

/**
 * stremioGo.js
 * Proxy Stremio manifest/catalog/meta requests to the Go backend.
 *
 * The Go backend (torrent-search-go) owns the data plane and serves the Stremio
 * manifest/catalog/meta. The Node addon is a thin edge: it proxies those here and
 * keeps only stream resolution (14 debrid providers + client IP forwarding),
 * the configure page, and favorites. Proxying is unconditional whenever
 * BACKEND_URL is set - there is no local fallback for catalog/meta.
 */

import type { Request, Response } from 'express';
import type { AddonConfig } from '../types/config';
import { ADDON_VERSION } from '../manifest';

const axios = require('axios');
const { backendHeaders } = require('../services/backend');
const { encodeConfig } = require('./config');
const hentai = require('../services/hentai');

/**
 * Forward a Stremio protocol GET to Go's /stremio/{config}/... handler.
 * Returns true when the response was written, false when BACKEND_URL is unset or
 * the upstream request failed (the caller then returns an empty payload).
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {string} subpath        - e.g. "/manifest.json", "/catalog/Porn/xxx_top.json"
 * @param {string} [configOverride] - config segment for routes with no :config param
 */
async function proxyStremioToGo(req: Request, res: Response, subpath: string, configOverride?: string) {
  const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  if (!backendUrl) return false;

  const config = configOverride || (req.params && String(req.params.config)) || 'default';
  const url = `${backendUrl}/stremio/${encodeURIComponent(config)}${subpath}`;
  const headers = {
    ...backendHeaders(process.env.ADDON_API_TOKEN || ''),
    'X-Addon-Base-Url': `${req.protocol}://${req.get('host')}`,
    Accept: 'application/json',
  };

  try {
    const upstream = await axios.get(url, {
      headers,
      timeout: 45000,
      validateStatus: () => true,
    });
    let data = upstream.data;

    // The Go backend hardcodes a baseline addon version; the Node addon owns the
    // real semver (package.json, bumped by scripts/addon-version.mjs). Stremio
    // installs through this edge, so stamp the current addon version onto the
    // proxied manifest regardless of what the backend reported.
    if (subpath === '/manifest.json' && data && typeof data === 'object' && !Array.isArray(data)) {
      data = { ...data, version: ADDON_VERSION };
    }

    // For Hentai catalogs, drop items that have no cover art and no upstream
    // streams. This prevents Stremio from showing titles that error out when played.
    if (subpath.startsWith('/catalog/') && isHentaiCatalogSubpath(subpath) && data && Array.isArray(data.metas)) {
      try {
        data = { ...data, metas: await hentai.filterCatalogMetas(data.metas) };
      } catch (err: any) {
        console.warn('[stremio-go] Hentai catalog filter failed:', err.message);
      }
    }

    if (upstream.headers['content-type']) {
      res.setHeader('Content-Type', upstream.headers['content-type']);
    }
    res.status(upstream.status).json(data);
    return true;
  } catch (err: any) {
    console.warn('[stremio-go] proxy failed:', err.message);
    return false;
  }
}

function isHentaiCatalogSubpath(subpath: string): boolean {
  // /catalog/Porn/hentai_*.json or /catalog/Porn/hentai_*/*.json
  // /catalog/hentai/hentai_*.json or /catalog/hentai/hentai_*/*.json
  const match = subpath.match(/^\/catalog\/[^/]+\/(hentai_[^/]+)(?:\/|$)/);
  return !!match;
}

/**
 * Fetch stream entries from Go's /stremio/{config}/stream/... handler.
 * Used for porndb: items (TPDB catalog → PornRips torrent lookup lives in Go).
 */
async function fetchGoStreams(cfg: AddonConfig, contentType: string, id: string) {
  const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  if (!backendUrl) return [];

  const config = encodeConfig(cfg);
  const subpath = `/stream/${encodeURIComponent(contentType)}/${encodeURIComponent(id)}.json`;
  const url = `${backendUrl}/stremio/${encodeURIComponent(config)}${subpath}`;

  try {
    const res = await axios.get(url, {
      headers: {
        ...backendHeaders(process.env.ADDON_API_TOKEN || ''),
        Accept: 'application/json',
      },
      timeout: 45000,
      validateStatus: () => true,
    });
    const streams = res.data?.streams;
    return Array.isArray(streams) ? streams : [];
  } catch (err: any) {
    console.warn('[stremio-go] fetchGoStreams failed:', err.message);
    return [];
  }
}

export { proxyStremioToGo, fetchGoStreams };

'use client';

import type { InstallInstance } from '../../lib/installBuilder';
import { FooterLinks } from '../configure/ContributeLinks';

interface InstallAppProps {
  addonName: string;
  addonVersion: string;
  instances: InstallInstance[];
  providerTotal: number;
  groupTotal: number;
  hideFromHome: boolean;
}

function badgeFor(name: string) {
  if (name.includes('4K')) return <span className="install-badge badge-4k">4K</span>;
  if (name.includes('1080p')) return <span className="install-badge badge-fhd">1080p</span>;
  return null;
}

function InstallCard({ g }: { g: InstallInstance }) {
  const label = g.groupLabel || 'Add-on';
  const subtitle = g.provider
    ? `${g.provider} · ${g.count} catalog${g.count === 1 ? '' : 's'}`
    : `${g.count} catalog${g.count === 1 ? '' : 's'}`;

  return (
    <div className="install-card">
      <div className="install-head">
        <div className="install-title">{label}</div>
        <div className="install-badges">{g.names.slice(0, 6).map((n) => badgeFor(n))}</div>
      </div>
      <div className="install-subtitle">{subtitle}</div>
      <div className="install-actions">
        <a href={g.installUrl} className="install-btn">Install in Stremio</a>
        <a href={g.manifestUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">Stremio Web</a>
      </div>
      <details className="install-details">
        <summary>Included catalogs</summary>
        <div className="install-catalogs">{g.names.join(', ')}</div>
      </details>
      <div className="url-label">Or copy manifest URL:</div>
      <div
        className="url-box"
        role="button"
        tabIndex={0}
        onClick={() => navigator.clipboard.writeText(g.manifestUrl)}
        onKeyDown={(e) => { if (e.key === 'Enter') navigator.clipboard.writeText(g.manifestUrl); }}
      >
        {g.manifestUrl}
      </div>
    </div>
  );
}

export function InstallApp({
  addonName, addonVersion, instances, providerTotal, groupTotal, hideFromHome,
}: InstallAppProps) {
  const total = instances.length;
  const multi = total > 1;

  let blocks: React.ReactNode;
  if (providerTotal > 1) {
    const byProvider = new Map<string, InstallInstance[]>();
    for (const inst of instances) {
      const key = inst.provider || '';
      if (!byProvider.has(key)) byProvider.set(key, []);
      byProvider.get(key)!.push(inst);
    }
    blocks = [...byProvider.entries()].map(([provider, list]) => (
      <div key={provider} className="provider-section">
        <div className="provider-head">{provider}</div>
        {list.map((g, i) => <InstallCard key={`${provider}-${i}`} g={g} />)}
      </div>
    ));
  } else {
    blocks = instances.map((g, i) => <InstallCard key={i} g={g} />);
  }

  return (
    <div className="install-container">
      <div className="install-header">
        <img src="/icon.svg" className="logo" alt={`${addonName} logo`} />
        <div>
          <h1>Install in Stremio</h1>
          <p className="tagline">{multi ? `You need to install all ${total} add-on entries below.` : 'One add-on is ready to install.'}</p>
        </div>
        <div className="version">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          {' '}v{addonVersion}
        </div>
      </div>

      {hideFromHome ? (
        <div className="banner">
          <strong>Home-screen hiding is enabled.</strong>
          {' '}Remove every previously installed instance of this add-on from Stremio, then install all {total} URL{total === 1 ? '' : 's'} below.
          Catalog rows will not appear on Home/Board, but Discover and Search still work.
          Continue Watching is unaffected.
        </div>
      ) : null}

      {multi ? (
        <div className="banner">
          <strong>Install all {total} add-ons below</strong> for this configuration to fully work.
          {(providerTotal > 1 || groupTotal > 1) ? (
            <>
              {' '}Your selection was split into {total} instances (
              {[providerTotal > 1 ? `${providerTotal} debrid providers` : null, groupTotal > 1 ? `${groupTotal} catalog parts` : null].filter(Boolean).join(' × ')}
              ) to stay under Stremio&apos;s manifest size limit.
            </>
          ) : null}
          {' '}Each installs as a separate, differently-titled add-on in Stremio.
        </div>
      ) : null}

      {blocks}

      <FooterLinks />
      <a href="/configure" className="back">← Back to configure</a>
    </div>
  );
}

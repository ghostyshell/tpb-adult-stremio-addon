// ContributePanel, extracted from ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

import { AdultAddonsLink, RedditLinks, SourceCodeLinks, SupportLinks } from '../ContributeLinks';

interface ContributePanelProps {
  activeTab: string;
}

export function ContributePanel({ activeTab }: ContributePanelProps) {
  return (
    <div className={`panel${activeTab === 'contribute' ? ' active' : ''}`} data-panel="contribute">
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.4 3.9 13a5.2 5.2 0 0 1 7.4-7.3l.7.7.7-.7A5.2 5.2 0 0 1 20.1 13Z" /></svg></div>
          <div><div className="card-title">Support &amp; Community</div><div className="card-desc">Get help, share feedback, or support ongoing development.</div></div>
        </div>
        <SupportLinks />
      </div>
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" /></svg></div>
          <div><div className="card-title">Adult Addons Directory</div><div className="card-desc">Browse and install adult Stremio and Nuvio addons in one place.</div></div>
        </div>
        <AdultAddonsLink />
      </div>
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.2-3.1-.12-.3-.52-1.48.1-3.08 0 0 .97-.31 3.2 1.18a11 11 0 0 1 5.82 0c2.22-1.5 3.2-1.18 3.2-1.18.63 1.6.23 2.78.11 3.07.75.82 1.2 1.85 1.2 3.1 0 4.44-2.7 5.41-5.28 5.69.42.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" /></svg></div>
          <div><div className="card-title">Source Code</div><div className="card-desc">Free and open-source. Fork, self-host, report bugs, or contribute code.</div></div>
        </div>
        <SourceCodeLinks />
      </div>
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24m5.01 4.74c.38 0 .69.31.69.69 0 .38-.31.69-.69.69-.38 0-.69-.31-.69-.69 0-.38.31-.69.69-.69m-4.6.93c1.66 0 3.18.27 4.4.78a2.2 2.2 0 0 1 3.78 1.53 2.2 2.2 0 0 1-1.52 2.09c.04.24.06.49.06.74 0 2.66-3.1 4.82-6.92 4.82s-6.92-2.16-6.92-4.82c0-.25.02-.5.06-.74a2.2 2.2 0 0 1-1.52-2.09 2.2 2.2 0 0 1 3.78-1.53c1.22-.51 2.74-.78 4.4-.78m-3.12 3.04a1.02 1.02 0 1 0 0 2.04 1.02 1.02 0 0 0 0-2.04m6.24 0a1.02 1.02 0 1 0 0 2.04 1.02 1.02 0 0 0 0-2.04m-3.16 3.27a.28.28 0 0 0-.28.25c0 .59-.48 1.07-1.07 1.07-.59 0-1.07-.48-1.07-1.07a.28.28 0 0 0-.56 0c0 .59-.48 1.07-1.07 1.07-.59 0-1.07-.48-1.07-1.07a.28.28 0 0 0-.56 0c0 1.01.82 1.83 1.83 1.83.63 0 1.18-.32 1.51-.8.33.48.88.8 1.51.8 1.01 0 1.83-.82 1.83-1.83a.28.28 0 0 0-.28-.25" /></svg></div>
          <div><div className="card-title">Reddit Communities</div><div className="card-desc">Guides, discussion and addon recommendations from the community.</div></div>
        </div>
        <RedditLinks />
      </div>
    </div>
  );
}
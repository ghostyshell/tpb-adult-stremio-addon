import { cookies } from 'next/headers';
import { ADDON_NAME, ADDON_VERSION } from '../../../manifest';
import { InstallApp } from '../../../components/install/InstallApp';
import type { InstallResult } from '../../../lib/installBuilder';
import { getFlash } from '../../../lib/flashStore';

// Force dynamic rendering so proxy.ts can inject a per-request CSP nonce into
// Next.js's inline __next_f flight scripts (see app/configure/page.tsx).
export const dynamic = 'force-dynamic';

export default async function InstallPage() {
  const cookieStore = await cookies();
  const flashIdCookie = cookieStore.get('install_flash_id');

  let data: InstallResult | null = null;
  if (flashIdCookie?.value) {
    data = getFlash(flashIdCookie.value) as InstallResult | null;
  }

  if (!data || !data.instances?.length) {
    return (
      <div className="install-container">
        <div className="install-header">
          <img src="/icon.svg" className="logo" alt={`${ADDON_NAME} logo`} />
          <div>
            <h1>Install in Stremio</h1>
            <p className="tagline">No install data found. Configure your add-on first.</p>
          </div>
        </div>
        <a href="/configure" className="back">← Back to configure</a>
      </div>
    );
  }

  return (
    <InstallApp
      addonName={ADDON_NAME}
      addonVersion={ADDON_VERSION}
      instances={data.instances}
      providerTotal={data.providerTotal}
      groupTotal={data.groupTotal}
      hideFromHome={data.hideFromHome}
    />
  );
}

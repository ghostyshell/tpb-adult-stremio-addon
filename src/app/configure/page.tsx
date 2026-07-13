import { ConfigureApp } from '../../components/configure/ConfigureApp';
import { getConfigureProps } from '../../lib/configureProps';

// Force dynamic rendering so proxy.ts can inject a per-request CSP nonce into
// Next.js's inline __next_f flight scripts. Static pages are generated at
// build time when no request/nonce exists, so nonce-based CSP requires this.
export const dynamic = 'force-dynamic';

export default async function ConfigurePage() {
  const props = await getConfigureProps();
  return <ConfigureApp {...props} />;
}

// Pure helpers for the configure page's "how many add-ons will this generate"
// note + selected-catalog count. Extracted from ConfigureApp.tsx as a
// structure-preserving refactor (no behaviour change). Kept pure so they can
// be unit-tested without rendering the component.

/** Count checked hidden bases + checked studio entries. */
export function countSelectedCatalogs(
  hiddenCatalogBases: readonly { base: string }[],
  catalogChecks: Record<string, boolean>,
  studioGroups: readonly { entries: readonly { base: string }[] }[],
): number {
  const hidden = hiddenCatalogBases.filter((b) => catalogChecks[b.base]).length;
  const studios = studioGroups.flatMap((g) => g.entries).filter((e) => catalogChecks[e.base]).length;
  return hidden + studios;
}

/**
 * Build the install-count note HTML. `selectedCatalogs` is the result of
 * countSelectedCatalogs; when zero it falls back to totalBases (matches the
 * original memo behaviour).
 */
export function buildInstanceNote(
  debridKeys: readonly { field: string }[],
  debridTokens: Record<string, string>,
  selectedCatalogs: number,
  totalBases: number,
  maxBases: number,
): { warn: boolean; html: string } {
  const providers = Math.max(debridKeys.filter((k) => (debridTokens[k.field] || '').trim()).length, 1);
  const cats = selectedCatalogs || totalBases;
  const groups = Math.max(Math.ceil(cats / maxBases), 1);
  const total = providers * groups;
  if (total <= 1) {
    return { warn: false, html: 'This will generate <strong>1 add-on</strong> to install.' };
  }
  const parts: string[] = [];
  if (providers > 1) parts.push(`${providers} debrid providers`);
  if (groups > 1) parts.push(`${groups} catalog parts to stay under Stremio's manifest size limit`);
  return {
    warn: true,
    html: `This will generate <strong>${total} add-ons</strong> to install `
      + `<strong>all ${total}</strong> in Stremio`
      + (parts.length ? ` (${parts.join(' × ')}).` : '.')
      + '<br>Each add-on is separately titled so you can tell them apart.',
  };
}
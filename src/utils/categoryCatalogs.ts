/**
 * categoryCatalogs.js
 * Curated list of browsable adult-content categories shared by both TPDB and
 * StashDB catalog sources, plus helpers for lookup and config validation.
 *
 * Each category has a stable slug (used as the Redis key component and the
 * Stremio genre value), a display name, a StashDB tag name for runtime tag-id
 * resolution (queryTags), and a TPDB search term for /scenes?q= queries.
 *
 * The `default` flag controls which categories are pre-enabled for an install
 * that has a key but no explicit tpdbCategories / stashdbCategories config
 * field.  Operators can opt users into the full list by setting the config
 * field; see config.js for the presence-check logic.
 *
 * Catalog IDs are per-source constants consumed by the manifest builder and
 * the catalog route.  The category array itself is source-agnostic - both
 * TPDB and StashDB use the same curated list.
 */


// Stable catalog identifiers.  These strings appear in the Stremio manifest
// and in every Redis key produced by the category warmer.
const TPDB_CATALOG_ID    = 'tpdb_cat';
const STASHDB_CATALOG_ID = 'stashdb_cat';

// ---------------------------------------------------------------------------
// Curated category list
// ---------------------------------------------------------------------------
// `slug`      - kebab-case, stable across versions (used as cache key)
// `name`      - display label for the Stremio genre dropdown
// `stashTag`  - tag NAME passed to StashDB queryTags to resolve a tag id
// `tpdbQuery` - search term for TPDB /scenes?q=
// `default`   - true → enabled by default when the source key is set
// ---------------------------------------------------------------------------

const CATEGORIES = [
  // -----------------------------------------------------------------------
  // Default-enabled (~18) - most popular categories; shown for any install
  // that supplies a TPDB or StashDB key without an explicit category list.
  // -----------------------------------------------------------------------
  { slug: 'milf',               name: 'MILF',               stashTag: 'MILF',               tpdbQuery: 'MILF',               default: true  },
  { slug: 'anal',               name: 'Anal',               stashTag: 'Anal',               tpdbQuery: 'Anal',               default: true  },
  { slug: 'teen',               name: 'Teen',               stashTag: 'Teen',               tpdbQuery: 'Teen',               default: true  },
  { slug: 'lesbian',            name: 'Lesbian',            stashTag: 'Lesbian',            tpdbQuery: 'Lesbian',            default: true  },
  { slug: 'threesome',          name: 'Threesome',          stashTag: 'Threesome',          tpdbQuery: 'Threesome',          default: true  },
  { slug: 'big-tits',           name: 'Big Tits',           stashTag: 'Big Tits',           tpdbQuery: 'Big Tits',           default: true  },
  { slug: 'creampie',           name: 'Creampie',           stashTag: 'Creampie',           tpdbQuery: 'Creampie',           default: true  },
  { slug: 'interracial',        name: 'Interracial',        stashTag: 'Interracial',        tpdbQuery: 'Interracial',        default: true  },
  { slug: 'pov',                name: 'POV',                stashTag: 'POV',                tpdbQuery: 'POV',                default: true  },
  { slug: 'blowjob',            name: 'Blowjob',            stashTag: 'Blowjob',            tpdbQuery: 'Blowjob',            default: true  },
  { slug: 'asian',              name: 'Asian',              stashTag: 'Asian',              tpdbQuery: 'Asian',              default: true  },
  { slug: 'latina',             name: 'Latina',             stashTag: 'Latina',             tpdbQuery: 'Latina',             default: true  },
  { slug: 'ebony',              name: 'Ebony',              stashTag: 'Ebony',              tpdbQuery: 'Ebony',              default: true  },
  { slug: 'mature',             name: 'Mature',             stashTag: 'Mature',             tpdbQuery: 'Mature',             default: true  },
  { slug: 'gangbang',           name: 'Gangbang',           stashTag: 'Gangbang',           tpdbQuery: 'Gangbang',           default: true  },
  { slug: 'double-penetration', name: 'Double Penetration', stashTag: 'Double Penetration', tpdbQuery: 'Double Penetration', default: true  },
  { slug: 'hardcore',           name: 'Hardcore',           stashTag: 'Hardcore',           tpdbQuery: 'Hardcore',           default: true  },
  { slug: 'big-ass',            name: 'Big Ass',            stashTag: 'Big Ass',            tpdbQuery: 'Big Ass',            default: true  },

  // -----------------------------------------------------------------------
  // Opt-in only - available but not pre-enabled; operators can surface them
  // by including their slugs in the tpdbCategories / stashdbCategories field.
  // -----------------------------------------------------------------------
  { slug: 'public',             name: 'Public',             stashTag: 'Public',             tpdbQuery: 'Public',             default: false },
  { slug: 'cosplay',            name: 'Cosplay',            stashTag: 'Cosplay',            tpdbQuery: 'Cosplay',            default: false },
  { slug: 'bdsm',               name: 'BDSM',               stashTag: 'BDSM',               tpdbQuery: 'BDSM',               default: false },
  { slug: 'rough-sex',          name: 'Rough Sex',          stashTag: 'Rough Sex',          tpdbQuery: 'Rough Sex',          default: false },
  { slug: 'squirting',          name: 'Squirting',          stashTag: 'Squirting',          tpdbQuery: 'Squirting',          default: false },
  { slug: 'massage',            name: 'Massage',            stashTag: 'Massage',            tpdbQuery: 'Massage',            default: false },
  { slug: 'facial',             name: 'Facial',             stashTag: 'Facial',             tpdbQuery: 'Facial',             default: false },
  { slug: 'orgy',               name: 'Orgy',               stashTag: 'Orgy',               tpdbQuery: 'Orgy',               default: false },
  { slug: 'bukkake',            name: 'Bukkake',            stashTag: 'Bukkake',            tpdbQuery: 'Bukkake',            default: false },
  { slug: 'feet',               name: 'Feet',               stashTag: 'Feet',               tpdbQuery: 'Feet',               default: false },
  { slug: 'redhead',            name: 'Redhead',            stashTag: 'Redhead',            tpdbQuery: 'Redhead',            default: false },
  { slug: 'blonde',             name: 'Blonde',             stashTag: 'Blonde',             tpdbQuery: 'Blonde',             default: false },
  { slug: 'petite',             name: 'Petite',             stashTag: 'Petite',             tpdbQuery: 'Petite',             default: false },
  { slug: 'bbw',                name: 'BBW',                stashTag: 'BBW',                tpdbQuery: 'BBW',                default: false },
  { slug: 'tattoo',             name: 'Tattoo',             stashTag: 'Tattoo',             tpdbQuery: 'Tattoo',             default: false },
  { slug: 'stepfamily',         name: 'Stepfamily',         stashTag: 'Stepfamily',         tpdbQuery: 'Stepfamily',         default: false },
  { slug: 'cuckold',            name: 'Cuckold',            stashTag: 'Cuckold',            tpdbQuery: 'Cuckold',            default: false },
  { slug: 'voyeur',             name: 'Voyeur',             stashTag: 'Voyeur',             tpdbQuery: 'Voyeur',             default: false },
  { slug: 'handjob',            name: 'Handjob',            stashTag: 'Handjob',            tpdbQuery: 'Handjob',            default: false },
  { slug: 'deepthroat',         name: 'Deepthroat',         stashTag: 'Deepthroat',         tpdbQuery: 'Deepthroat',         default: false },
  { slug: 'fisting',            name: 'Fisting',            stashTag: 'Fisting',            tpdbQuery: 'Fisting',            default: false },
  { slug: 'pissing',            name: 'Pissing',            stashTag: 'Pissing',            tpdbQuery: 'Pissing',            default: false },
];

// Build a fast slug → category lookup.  Constructed once at module load to
// avoid repeated linear scans in hot paths (catalog route, config validation).
const _bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));

// Build a fast display-name → slug lookup (used by the catalog route to turn
// a Stremio `genre` param - which carries the display name - back into a slug).
const _nameToSlugMap = new Map(CATEGORIES.map((c) => [c.name, c.slug]));

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Returns the full CATEGORIES array.
 * The `source` parameter ('tpdb' | 'stashdb') is accepted for symmetry and
 * to allow per-source divergence in the future without a breaking API change.
 */
function getCategories(_source?: unknown) {
  return CATEGORIES;
}

/**
 * Returns the category object for a given slug, or null if not found.
 * Source param accepted for future divergence; currently both sources share
 * the same list.
 */
function getCategoryBySlug(_source: unknown, slug: string) {
  return _bySlug.get(slug) || null;
}

/**
 * Returns all slugs for which `default === true`.
 * Used by config.js to fill tpdbCategories / stashdbCategories when the
 * operator has configured a key but not an explicit category list.
 */
function defaultEnabledSlugs(_source?: unknown) {
  return CATEGORIES.filter((c) => c.default).map((c) => c.slug);
}

/**
 * Maps an array of slugs to their display `name`s.
 * Unknown slugs are silently skipped; order is preserved.
 */
function categoryNames(slugs: string[]) {
  return slugs.reduce((acc: string[], slug: string) => {
    const cat = _bySlug.get(slug);
    if (cat) acc.push(cat.name);
    return acc;
  }, []);
}

/**
 * Returns every slug in the list.
 * Used by config.js to validate user-supplied slug arrays.
 */
function allSlugs(_source?: unknown) {
  return CATEGORIES.map((c) => c.slug);
}

/**
 * Maps a display name (as Stremio passes in the `genre` extra) back to a slug.
 * Returns null if the name is not recognised.
 * Source param accepted for symmetry / future divergence.
 */
function nameToSlug(_source: unknown, name: string) {
  return _nameToSlugMap.get(name) || null;
}

export { CATEGORIES, TPDB_CATALOG_ID, STASHDB_CATALOG_ID, getCategories, getCategoryBySlug, defaultEnabledSlugs, categoryNames, allSlugs, nameToSlug, };

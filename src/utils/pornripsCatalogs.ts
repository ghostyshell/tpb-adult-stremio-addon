/**
 * pornripsCatalogs.js
 * PornRips.to catalog system, modelled on the reference adult addon pattern:
 * instead of one Stremio catalog per studio, PornRips
 * exposes a small set of catalogs whose long option lists (studios, tags,
 * qualities) are surfaced as Stremio `genre` dropdowns. The catalog route
 * reads the selected genre and turns it into a PornRips search query.
 *
 * Catalog ids are all prefixed `pr_` so the router can distinguish them from
 * the piratebay/HiddenBay `xxx_` catalogs and scrape website 'pornrips'.
 *
 * Data (studio + tag lists, quality options) mirrors the reference addon.
 */


// Studio names offered in the PornRips "Studio" dropdown (mirrors reference).
const PORNRIPS_STUDIOS = ["Adult Prime","Adult Time","Anal Vids","ARX Bucks","ATKingdom","Aziani","Bang Bros","Blowpass","Dogfart Network","ExploitedX Network","FakeHub","Filthy Kings","Fuck You Cash","Full Porn Network","Gamma Enterprises","It's POV","Kelly Madison Media","Kink","MetArt","Mile High Media","Naughty America","Nookies","Nubiles","Porn CZ","Puffy Network","RHS Photography","SexyHub","Stepped Up","Team Skeet","Top Web Models","VIP 4K","Vixen Media Group","XEmpire","Radical Entertainment","1111Customs","5K Porn","Abby Winters","All Girl Massage","All Over 30","ALS Angels","ALS Scan","Anal Mom","Anal Only","Anilos","Ass Parade","Asshole Fever","ATK Exotics","ATK Galleria","ATK Girlfriends","ATK Hairy","Aunt Judys","Aunt Judys XXX","Backdoor POV","Backroom Casting Couch","Bang Bus","BANG!","BangBros 18","BBC Pie","BBC Surprise","Beauty and the Senior","Beauty Angels","Big Gulp Girls","Big Tit Cream Pie","Big Tits Round Asses","BJ Raw","Blacked","Blacked Raw","Blacks On Blondes","Brand New Amateurs","Brat Tamer","Bratty MILF","Bratty Sis","Brazzers Exxtra","Breeding Material","Broken Sluts","Casting Couch X","Casting Couch-HD","Club Sweethearts","Club Tug","Creampie Angels","Cuck Hunter","Cuckold Sessions","Cum Perfection","Czech Sex Casting","CzechBoobs","Dad Crush","Dane Jones","Daughter JOI","Daughter Swap","Debt 4K","Deep Lush","Deeper","Deepthroat Sirens","Device Bondage","Devil's Film","DFXtra Originals","Digital Playground","Dirty Auditions","Dirty Wives Club","Dorcel Club","Dungeon Sex","Elegant Raw","Erotica X","Eternal Desire","Everything Butt","Evil Angel","Exotic 4K","Exxxtra Small","Fake Taxi","FakeHub Originals","Family Strokes","FemJoy","Filthy Taboo","Fitness Rooms","Freak Mob Media","Freeuse Fantasy","Frolic Me","FTV Girls","FTV Milfs","Fuck Studies","Gangbang Creampie","Gender X","GirlCum","Girls Out West","Girlsway","Gloryhole Secrets","Good Morning Sex","Got Filled","Got Mylf","GrandMams","GrandParentsX","Hard X","Hardwerk","Hegre","Hijab Hookup","Hijab Mylfs","Hollandsche Passie","HomeGrownEurope","Hookup Hotshot","Hot MILFs Fuck","How Women Orgasm","Hunt 4K","Hussie Pass","ILovePOV","Immoral Live","Inserted","Interracial Vision","IntimatePOV","JapanHDV","Jay's POV","Jesse Loads Monster Facials","JOI Babes","Lady Lyne","Lady Voyeurs","Lara's Playground","Legal Porno","Lesbian Summer","Let's Post It","Love Her Feet","Lubed","ManyVids","Mature 4K","Mature NL","MetArtX","MILF AF","MILFY","Mom Drips","Mom is Horny","Mom Wants Creampie","Mom Wants To Breed","Mommy's Boy","Mommy's Girl","Moms Teach Sex","Monsters Of Cock","More POV","Mr Lucky POV","Mucha Sexo","My Dirty Maid","My Family Pies","My First Sex Teacher","My Friend's Hot Mom","My Life In Miami","MYLF Seeker","Naughty Athletics","Naughty Office","Nebraska Coeds","Net Girl","New Sensations","NF Busty","Nookies Originals","Nubile Films","Nympho","OfficePOV","Only Teen Blowjobs","OnlyTarts","Oops Family","Pascals Sub Sluts","Passion HD","Perfect 18","Perv Mom","Perv Therapy","Petite POV","Petite18","Playboy Plus","PlumperPass","Porn Dude Casting","Porn Fidelity","Porn Force","Porn Mega Load","Porn World","PornPlus","Pornstar Wife","POV Masters","POV Perv","POVD","primemature","Private","Private Society","Pure CFNM","Pure Taboo","PurgatoryX","Pussy Patrol","Reality Junkies","Ricky's Room","RK Prime","S3xus","Salsa XXX","See Him Fuck","Sex and Submission","SexArt","SexMex","Shady Spa","Shame 4K","She Seduced Me","She's Breeding Material","Shoplyfter","ShowerX","Sin DeLuxe","Sinful XXX","Sis Loves Me","Sis Swap","Spank Monster","Step Siblings","Step Siblings Caught","Strap Lez","Swallowed","Sweet FemDom","Sweet Sinner","Sweetheart Video","Taboo Heat","Teen From Bohemia","Thai Girls Wild","The Life Erotic","The White Boxxx","Throated","Thundercock","Tiny 4K","Tonight's Girlfriend","Touch My Wife","Transfixed","Tushy","Tushy Raw","Vicky at Home","VIPissy","Viv Thomas","Vixen","Watch 4 Beauty","Wet and Pissy","Wet and Puffy","Whipped Ass","Wifey","Wifey's World","Will Tile XXX","Wow Girls","Other"];

// Content tags offered in the PornRips "Tag" dropdown (mirrors reference).
const PORNRIPS_TAGS = ["Blowjob","Anal","Threesome","Lesbian","MILF","Creampie","Cumshot","Facial","Hardcore","Masturbation","Squirting","Big Tits","Big Ass","Deepthroat","POV","Doggystyle","Missionary","Cowgirl","Riding","Cunnilingus","Rimjob","Double Penetration","Gangbang","Orgy","FFM","MMF","Interracial","Amateur","Teen","Mature","College","Outdoor","Public","Office","Shower","Kitchen","Casting","Audition","Interview","Lingerie","Stockings","High Heels","Uniform","Cosplay","Massage","Oil","Toys","Vibrator","Dildo","Strapon","BDSM","Bondage","Spanking","Domination","Submission","Roleplay","Taboo","Fantasy","Romantic","Solo","Softcore","Glamour","Blonde","Brunette","Redhead","Asian","Latina","Ebony","Busty","Natural Tits","Small Tits","Petite","BBW","Tattoo","Piercing","Stepmom","Stepdaughter","Stepsister","Stepbrother","Boss","Teacher","Doctor","Nurse","Reality","Hidden Camera","Voyeur","Swallow","Gokkun","Cum In Mouth","Handjob","Footjob","Titfuck","Fisting","Fingering","Close Up","Slow Motion","HD","4K","Virtual Reality"];

// Quality options offered in the PornRips "Quality" dropdown.
const PORNRIPS_QUALITIES = ["1080p","720p"];

// PornRips catalog set, modelled on the reference addon. Each entry becomes a
// Stremio catalog; long option lists are exposed as a `genre` dropdown.
//   id      - catalog id (pr_ prefix → routed to the pornrips backend scraper)
//   name    - display name in Stremio
//   genre   - when set, the catalog gets a genre dropdown (options below)
//   options - dropdown values (an 'All' entry is prepended automatically)
//   search  - when true, the catalog is search-only
// hideFromHome: Studio/Tag/Search just mirror Recent on the Home (Board) screen
// (no genre/search selected), so they're hidden from Home via a required genre
// and surface only in Discover (which auto-expands the genre dropdown) / Search.
const PR_CATALOGS = [
  { id: 'pr_recent',  name: 'PornRips · Recent'  },
  { id: 'pr_studio',  name: 'PornRips · Studio',  genre: 'genre', options: PORNRIPS_STUDIOS, hideFromHome: true },
  { id: 'pr_tag',     name: 'PornRips · Tag',     genre: 'genre', options: PORNRIPS_TAGS, hideFromHome: true },
  { id: 'pr_search',  name: 'PornRips · Search',  search: true, hideFromHome: true },
];

/** Bases used by the configure page (one toggle per pornrips catalog). */
function getPornripsBases() {
  return PR_CATALOGS.map((c) => ({ base: c.id, name: c.name.replace('PornRips · ', '') }));
}

/**
 * Resolve a pr_ catalog id (+ optional genre / search query) into a PornRips
 * scrape query. Returns { query } or null if the id isn't a pornrips catalog.
 * 'All' (or empty) genre means browse the latest releases.
 */
function getPornripsParams(catalogId: string, genre: string, searchQ: string) {
  if (!catalogId || !catalogId.startsWith('pr_')) return null;
  const g = (genre && genre !== 'All') ? genre.trim() : '';
  const s = (searchQ || '').trim();
  // Search catalog uses the typed query; genre catalogs use the picked option;
  // recent browses latest. A user search is always combined when present.
  let query = '';
  if (catalogId === 'pr_search') query = s;
  else query = [g, s].filter(Boolean).join(' ').trim();
  return { website: 'pornrips', category: 'all', query };
}

/**
 * Collapse PornRips' separate 720p / 1080p posts for the same release into one
 * entry (they share a title once quality/codec tokens are stripped). Keeps the
 * highest-quality variant and preserves listing order. Idempotent, so it's safe
 * to re-apply at render time on any cached list (warmed or stale).
 */
function dedupePornrips(torrents: any[]) {
  const QUALITY_TOKENS = /\b(?:480p|540p|720p|1080p|1440p|2160p|4k|uhd|hevc|x265|x264|h\.?265|h\.?264|prt)\b/gi;
  const keyOf = (t: any) => (t.title || t.Name || '')
    .toLowerCase()
    .replace(QUALITY_TOKENS, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const titleOf = (t: any) => t.title || t.Name || '';
  const rank = (t: any) => /\b(?:2160p|4k|uhd)\b/i.test(titleOf(t)) ? 3
    : /\b(?:1080p|1440p)\b/i.test(titleOf(t)) ? 2 : 1;

  const seen = new Map();
  for (const t of (torrents || [])) {
    const k = keyOf(t) || t.detailUrl || titleOf(t);
    if (!k) continue;
    const existing = seen.get(k);
    if (!existing || rank(t) > rank(existing)) seen.set(k, t);
  }
  return Array.from(seen.values());
}

export { PORNRIPS_STUDIOS, PORNRIPS_TAGS, PORNRIPS_QUALITIES, PR_CATALOGS, getPornripsBases, getPornripsParams, dedupePornrips, };

/* =====================================================================
 * capabilities.js  -  the app capability manifest bundled INTO every
 * agent-bundle export (zip-store.js, via songbook.js's downloadBundle) and
 * mirrored at the static path music/agent/capabilities.json, so an agent
 * handed only the exported zip knows what the app can do - surfaces, owned
 * data keys, interchange contracts - with zero app code and zero network.
 * ---------------------------------------------------------------------
 * ONE source, two destinations (machine-SSOT: never hand-author the same
 * data twice) - data() is the single source and json() its single render;
 * the bundle export and the static file must both equal json() + newline
 * byte-for-byte (asserted by test/agent-manifest.test.js, same law as
 * agent-readme.js <-> music/agent/AGENTS.md).
 *
 * Interchange schema strings ('skill-competency-profile/v1') are literals
 * here by the dependency-free discipline; test/agent-manifest.test.js pins
 * every occurrence against Competency.SCHEMA so a drift fails the suite.
 *
 * Pure + dependency-free (competency.js / agent-readme.js discipline): no
 * DOM, no storage. Exposes window.Capabilities and require()-able in Node.
 * music/sw.js CORE must precache this file.
 * ===================================================================== */
(function (root) {
  'use strict';

  function data() {
    return {
      schema: 'music-app-capabilities/v1',
      app: 'music',
      capabilities: [
        {
          id: 'tuner',
          name: 'Tuner',
          desc: 'Mic autocorrelation pitch detection with reference tones, per fretted-instrument profile. Purely computational - no persisted state.',
          surfaces: ['play/#tune'],
          data_keys: [],
          interchange: null
        },
        {
          id: 'jam',
          name: 'Jam',
          desc: "Practice a chord progression against the app's own audio-engine backing (strum/tone playback) at a set tempo.",
          surfaces: ['play/#jam'],
          data_keys: ['music.tempo.v1', 'roadcase-<id>.setlist.v1'],
          interchange: null
        },
        {
          id: 'compose',
          name: 'Compose',
          desc: 'Build and save custom chord progressions per key/mode; saved progressions join the practice setlist.',
          surfaces: ['play/#compose'],
          data_keys: ['roadcase-<id>.setlist.v1'],
          interchange: null
        },
        {
          id: 'repertoire',
          name: 'Repertoire',
          desc: 'Curate the songbook - saved songs and setlists across the catalog and the backing-track curation queue.',
          surfaces: ['play/#library'],
          data_keys: ['roadcase-<id>.setlist.v1', 'songbook.'],
          interchange: null
        },
        {
          id: 'backing-tracks',
          name: 'Backing tracks',
          desc: 'Studio view linking YouTube backing tracks to songs; custom scales/tracks for solo practice.',
          surfaces: ['play/#library (Studio)'],
          data_keys: ['bt.custom.v1', 'bt.soloScale.v1', 'music.trackUrls.v1', 'music.studioView.v1'],
          interchange: null
        },
        {
          id: 'competency-tracking',
          name: 'Competency tracking',
          desc: 'Per-skill mastery levels that grow from app use, evidence-tracked against the published frameworks (stringed-instrument, ukulele, guitar, music-composition, lyric-writing).',
          surfaces: ['Settings -> Skills'],
          data_keys: ['music.competency.v1'],
          interchange: 'skill-competency-profile/v1'
        },
        {
          id: 'backup-restore',
          name: 'Backup and restore',
          desc: 'Whole-songbook export/import as one portable JSON envelope - a byte-faithful snapshot of every owned key, schema-versioned and migrated on restore.',
          surfaces: ['Settings -> Backup'],
          data_keys: ['songbook.', 'roadcase-', 'bt.', 'music.', 'tri.'],
          interchange: null
        },
        {
          id: 'jam-deep-link',
          name: 'Jam deep link',
          desc: 'A URL that stands up an ephemeral jam (progression + key + optional YouTube backing) for the user to play, then optionally Save through the existing repertoire/progression forms. Nothing writes storage on load.',
          surfaces: ['play/?jam=...&key=...&yt=...&name=...'],
          data_keys: [],
          interchange: 'url-params: jam,key,yt,name'
        },
        {
          id: 'skills-export-import',
          name: 'Skills export/import',
          desc: 'Per-skill or whole-bundle SKILL.md export (with AGENTS.md, capabilities.json, and the backup envelope bundled at the zip root) and file-picker import - the round-trip surface for handing a skill to another AI tool and back.',
          surfaces: ['Settings -> Skills'],
          data_keys: ['music.competency.v1'],
          interchange: 'skill-competency-profile/v1'
        }
      ]
    };
  }

  // The single render both destinations ship: canonical 2-space JSON.
  // The static file is this + one trailing newline.
  function json() {
    return JSON.stringify(data(), null, 2);
  }

  var API = { data: data, json: json };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Capabilities = API;

})(typeof window !== 'undefined' ? window : this);

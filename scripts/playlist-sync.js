#!/usr/bin/env node
/* =====================================================================
 * playlist-sync.js - the operator playlist pipeline (keyless, repeatable).
 * ---------------------------------------------------------------------
 * Reads a public YouTube playlist WITHOUT any API key (RSS feed + playlist
 * page parse + per-video oEmbed), diffs it against the shipped catalog
 * (music/backing-tracks/tracks.json) by Tracks.trackKey, and writes a
 * normalized payload + a regenerated veto table for the operator to
 * red-pen. A separate offline bake step appends approved entries to the
 * catalog. Two modes so the fetch can run where egress exists (a GitHub
 * Actions runner) while the bake runs anywhere:
 *
 *   node scripts/playlist-sync.js --playlist <PLAYLIST_ID>
 *     Fetch mode. Network required. Writes:
 *       docs/plans/playlist-sync-latest.json   (normalized payload)
 *       docs/plans/playlist-veto-latest.md     (regenerated veto table)
 *
 *   node scripts/playlist-sync.js --bake --from <payload.json>
 *                                 [--skip <ytid> ...] [--dry]
 *     Bake mode. Offline. Appends payload entries with status "new"
 *     (minus --skip ids) to music/backing-tracks/tracks.json. --dry
 *     prints the would-be appends without writing.
 *
 * Conventions enforced here (not left to the caller):
 *   - NEVER mutate an existing catalog row, and NEVER fill a yt id onto
 *     a track that already has one (merge-localstorage.js convention).
 *   - Storage key spelling is the PREFERRED tonic name (Eb, not D#) -
 *     display respells via Circle anyway and identity folds spellings
 *     (TracksModel.normRoot), so the stored JSON reads like a human
 *     wrote it. See engineering-wiki/theory-engine/note-spelling.md.
 *   - Catalog writes preserve the file's exact serialization:
 *     JSON.stringify(all, null, 2) + '\n'.
 *   - Zero parsed entries in fetch mode is an ERROR (exit 1), never an
 *     empty payload commit - a broken read must fail loudly.
 * ===================================================================== */
'use strict';
var fs = require('fs');
var path = require('path');
var YtInfo = require('../music/shared/yt-info.js');
var Circle = require('../music/shared/circle.js');
var Tracks = require('../music/shared/tracks.js');

var REPO = path.join(__dirname, '..');
var CATALOG = path.join(REPO, 'music', 'backing-tracks', 'tracks.json');
var PAYLOAD_OUT = path.join(REPO, 'docs', 'plans', 'playlist-sync-latest.json');
var VETO_OUT = path.join(REPO, 'docs', 'plans', 'playlist-veto-latest.md');
var MODES = ['major', 'minor', 'dorian', 'mixolydian', 'blues'];

function readCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
}

// Preferred storage spelling for a hint key (parseHints emits canonical
// sharps). 'blues' spells in its major-family convention (Eb blues).
function storageKey(root, mode) {
  if (!root) return null;
  var family = mode === 'minor' ? 'minor' : 'major';
  try {
    var pref = Circle.preferredTonicName(root, family);
    if (pref) return pref;
  } catch (e) { /* fall through to the raw root */ }
  return root;
}

// ---- fetch mode helpers (node >= 18 global fetch; Actions uses node 22) --
function fetchText(url) {
  return fetch(url, { headers: { 'user-agent': 'playlist-sync (nhruska.github.io music app)' } })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.text();
    });
}

// RSS feed: authoritative for the first ~15 entries, includes titles.
function parseRss(xml) {
  var out = [];
  var re = /<entry>([\s\S]*?)<\/entry>/g;
  var m;
  while ((m = re.exec(xml))) {
    var entry = m[1];
    var id = /<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/.exec(entry);
    var title = /<title>([\s\S]*?)<\/title>/.exec(entry);
    var author = /<name>([\s\S]*?)<\/name>/.exec(entry);
    if (id) {
      out.push({
        yt: id[1],
        title: title ? decodeXml(title[1]) : '',
        author: author ? decodeXml(author[1]) : ''
      });
    }
  }
  return out;
}

// Playlist page: recovers entries past the RSS window (ordered ids).
function parsePageIds(html) {
  var out = [];
  var seen = {};
  var re = /"videoId":"([A-Za-z0-9_-]{11})"/g;
  var m;
  while ((m = re.exec(html))) {
    if (!seen[m[1]]) { seen[m[1]] = true; out.push(m[1]); }
  }
  return out;
}

function decodeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function fetchOembed(yt) {
  var watch = 'https://www.youtube.com/watch?v=' + yt;
  var urls = [
    'https://www.youtube.com/oembed?url=' + encodeURIComponent(watch) + '&format=json',
    'https://noembed.com/embed?url=' + encodeURIComponent(watch)
  ];
  function tryAt(i) {
    if (i >= urls.length) return Promise.resolve(null);
    return fetchText(urls[i]).then(function (body) {
      var data = JSON.parse(body);
      if (!data || !data.title) return tryAt(i + 1);
      return { title: String(data.title), author: String(data.author_name || '') };
    }).catch(function () { return tryAt(i + 1); });
  }
  return tryAt(0);
}

function buildProposed(yt, title, author) {
  var hints = YtInfo.parseHints(title, author);
  var mode = hints.mode;
  // parseHints leaves mode null for scale words outside the form's 4-option
  // select (e.g. "blues"); the catalog DOES support blues as a first-class
  // mode, so recover it from the raw title before defaulting.
  if (!mode && /\bblues\b/i.test(title) && hints.key) mode = 'blues';
  return {
    yt: yt,
    title: String(title || '').trim(),
    artist: String(author || '').trim(),
    genre: hints.genre || 'jam',
    key: storageKey(hints.key, mode),
    mode: mode,
    bpm: hints.bpm,
    capo: 0,
    tags: ['jam']
  };
}

function runFetch(playlistId) {
  var rssUrl = 'https://www.youtube.com/feeds/videos.xml?playlist_id=' + playlistId;
  var pageUrl = 'https://www.youtube.com/playlist?list=' + playlistId;
  var rssEntries = [];
  var pageIds = [];
  return fetchText(rssUrl).then(function (xml) {
    rssEntries = parseRss(xml);
    return fetchText(pageUrl).then(function (html) {
      pageIds = parsePageIds(html);
    }).catch(function (e) {
      console.error('page parse failed (continuing with RSS only): ' + e.message);
    });
  }).then(function () {
    var byId = {};
    var ordered = [];
    rssEntries.forEach(function (e) { byId[e.yt] = e; ordered.push(e.yt); });
    pageIds.forEach(function (id) {
      if (!byId[id]) { byId[id] = { yt: id, title: '', author: '' }; ordered.push(id); }
    });
    if (!ordered.length) {
      console.error('playlist-sync: FAIL - zero entries parsed from RSS and page. Refusing to write an empty payload.');
      process.exit(1);
    }
    // oEmbed enrich sequentially (polite; a playlist is small)
    var chain = Promise.resolve();
    ordered.forEach(function (id) {
      chain = chain.then(function () {
        var e = byId[id];
        if (e.title) return null;
        return fetchOembed(id).then(function (info) {
          if (info) { e.title = info.title; e.author = info.author; }
        });
      });
    });
    return chain.then(function () { return ordered.map(function (id) { return byId[id]; }); });
  }).then(function (entries) {
    var catalog = readCatalog();
    var existingKeys = {};
    var existingYt = {};
    catalog.forEach(function (t) {
      existingKeys[Tracks.trackKey(t)] = true;
      if (t.yt) existingYt[t.yt] = true;
    });
    var payload = {
      fetchedAt: new Date().toISOString(),
      playlistId: playlistId,
      entries: entries.map(function (e) {
        var proposed = buildProposed(e.yt, e.title, e.author);
        var status = 'new';
        var note = '';
        if (existingYt[e.yt]) { status = 'existing'; note = 'yt id already in catalog'; }
        else if (existingKeys[Tracks.trackKey(proposed)]) { status = 'existing'; note = 'trackKey already in catalog'; }
        else if (!proposed.key || !proposed.mode) { status = 'skip'; note = 'no key/mode parsed - not a keyed backing track? operator to confirm'; }
        return { yt: e.yt, title: e.title, author: e.author, proposed: proposed, status: status, note: note };
      })
    };
    fs.writeFileSync(PAYLOAD_OUT, JSON.stringify(payload, null, 2) + '\n');
    fs.writeFileSync(VETO_OUT, vetoTable(payload));
    console.log('playlist-sync: wrote ' + payload.entries.length + ' entries -> ' + path.relative(REPO, PAYLOAD_OUT));
  });
}

function vetoTable(payload) {
  var lines = [];
  lines.push('# Playlist Veto Table - regenerated ' + payload.fetchedAt);
  lines.push('');
  lines.push('> Source playlist `' + payload.playlistId + '`, read keyless (RSS + page parse + oEmbed).');
  lines.push('> Operator red-pens; entries with status `new` bake via `--bake`. Regenerated by scripts/playlist-sync.js - do not hand-edit.');
  lines.push('');
  lines.push('| # | Title (yt id) | Key | Mode | Genre | BPM | Status | Note |');
  lines.push('|---|---|---|---|---|---|---|---|');
  payload.entries.forEach(function (e, i) {
    var p = e.proposed || {};
    lines.push('| ' + (i + 1) + ' | ' + (e.title || '?') + ' (' + e.yt + ') | ' +
      (p.key || '-') + ' | ' + (p.mode || '-') + ' | ' + (p.genre || '-') + ' | ' +
      (p.bpm || '-') + ' | ' + e.status + ' | ' + (e.note || '') + ' |');
  });
  lines.push('');
  return lines.join('\n') + '\n';
}

// ---- bake mode ---------------------------------------------------------
function runBake(fromPath, skipIds, dry) {
  var payload = JSON.parse(fs.readFileSync(fromPath, 'utf8'));
  var catalog = readCatalog();
  var existingKeys = {};
  var existingYt = {};
  catalog.forEach(function (t) {
    existingKeys[Tracks.trackKey(t)] = true;
    if (t.yt) existingYt[t.yt] = true;
  });
  var appended = [];
  var skipped = [];
  payload.entries.forEach(function (e) {
    var p = e.proposed;
    if (e.status !== 'new' || !p) { skipped.push([e.yt, 'status ' + e.status]); return; }
    if (skipIds.indexOf(e.yt) >= 0) { skipped.push([e.yt, '--skip']); return; }
    if (existingYt[p.yt]) { skipped.push([e.yt, 'yt id already in catalog']); return; }
    if (existingKeys[Tracks.trackKey(p)]) { skipped.push([e.yt, 'trackKey already in catalog']); return; }
    if (!p.key || MODES.indexOf(p.mode) < 0) { skipped.push([e.yt, 'unresolved key/mode - red-pen first']); return; }
    appended.push(p);
    existingKeys[Tracks.trackKey(p)] = true;
    existingYt[p.yt] = true;
  });
  skipped.forEach(function (s) { console.log('  skip ' + s[0] + ' (' + s[1] + ')'); });
  appended.forEach(function (p) { console.log('  bake ' + p.yt + ' "' + p.title + '" [' + p.key + ' ' + p.mode + ']'); });
  console.log('playlist-sync bake: ' + appended.length + ' to append, ' + skipped.length + ' skipped' + (dry ? ' (dry run - nothing written)' : ''));
  if (!appended.length) {
    console.error('playlist-sync bake: nothing to append.');
    process.exit(1);
  }
  if (dry) return;
  var next = catalog.concat(appended);
  fs.writeFileSync(CATALOG, JSON.stringify(next, null, 2) + '\n');
  console.log('playlist-sync bake: catalog ' + catalog.length + ' -> ' + next.length + ' (' + path.relative(REPO, CATALOG) + ')');
}

// ---- CLI ---------------------------------------------------------------
(function main() {
  var args = process.argv.slice(2);
  var playlist = null, bake = false, from = null, dry = false;
  var skipIds = [];
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--playlist') playlist = args[++i];
    else if (args[i] === '--bake') bake = true;
    else if (args[i] === '--from') from = args[++i];
    else if (args[i] === '--skip') skipIds.push(args[++i]);
    else if (args[i] === '--dry') dry = true;
  }
  if (bake) {
    if (!from) { console.error('usage: playlist-sync.js --bake --from <payload.json> [--skip <ytid>] [--dry]'); process.exit(1); }
    runBake(path.resolve(from), skipIds, dry);
  } else if (playlist) {
    runFetch(playlist).catch(function (e) {
      console.error('playlist-sync: FAIL - ' + e.message);
      process.exit(1);
    });
  } else {
    console.error('usage: playlist-sync.js --playlist <id> | --bake --from <payload.json> [--skip <ytid>] [--dry]');
    process.exit(1);
  }
})();

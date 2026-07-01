#!/usr/bin/env node
/* =====================================================================
 * merge-localstorage.js  -  fold exported localStorage curation back into
 * the shipped data files, so new installs get your saved songs + tracks.
 *
 * Usage:
 *   node music/dev/merge-localstorage.js <bundle.json> [<bundle2.json> ...]
 *
 * A bundle is what music/dev/export-data.html downloads:
 *   { exportedAt, customSongs: { <profileId>: [song...] }, customTracks: [track...],
 *     trackUrls: { <trackKey>: <videoId> } }
 *
 * The merge is IDEMPOTENT + deduped - re-running with the same bundle is a
 * no-op. Songs dedup on normalized title+artist (repertoire.matchKey); tracks
 * dedup on tracks.trackKey; the URL overlay fills a curated video id onto an
 * existing track only when it has none. Review `git diff` before committing.
 * ===================================================================== */
'use strict';
var fs = require('fs');
var path = require('path');
var R = require('../shared/repertoire.js');
var T = require('../shared/tracks.js');   // trackKey (safe to require: no DOM at load)

var MUSIC = path.resolve(__dirname, '..');
var songsPath = path.join(MUSIC, 'shared', 'songs.json');
var tracksPath = path.join(MUSIC, 'backing-tracks', 'tracks.json');

var bundles = process.argv.slice(2);
if (!bundles.length) {
  console.error('usage: node music/dev/merge-localstorage.js <bundle.json> [<bundle2.json> ...]');
  process.exit(1);
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
// Preserve the shipped formatting: 2-space indent + trailing newline (minimal diff).
function writeJson(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); }

var songs = readJson(songsPath);
var tracks = readJson(tracksPath);

var songMatch = {}; songs.forEach(function (s) { songMatch[R.matchKey(s)] = true; });
var trackSeen = {}; tracks.forEach(function (t) { trackSeen[T.trackKey(t)] = true; });

var added = { songs: 0, tracks: 0, urls: 0 }, skipped = { songs: 0, tracks: 0 };

bundles.forEach(function (bf) {
  var b = readJson(bf);

  // ---- custom songs -> songs.json ----
  var cs = b.customSongs || {};
  var csList = Array.isArray(cs) ? cs : Object.keys(cs).reduce(function (a, k) { return a.concat(cs[k] || []); }, []);
  csList.forEach(function (song) {
    var rec = { t: song.t != null ? song.t : song.title, a: song.a != null ? song.a : (song.artist || '') };
    var mk = R.matchKey(rec);
    if (songMatch[mk]) { skipped.songs++; return; }
    var seq = Array.isArray(song.seq) ? song.seq : (Array.isArray(song.chords) ? song.chords : []);
    var ship = {
      t: rec.t, a: rec.a,
      y: song.y != null ? song.y : (song.year != null ? song.year : null),
      d: song.d || 'Mine',
      seq: seq,
      // catalog songs carry a chord sheet; build one from the progression if absent
      sheet: song.sheet || [['Progression', seq.map(function (c) { return '[' + c + ']'; }).join(' ')]]
    };
    songs.push(ship); songMatch[mk] = true; added.songs++;
  });

  // ---- custom tracks -> tracks.json ----
  (b.customTracks || []).forEach(function (t) {
    var tk = T.trackKey(t);
    if (trackSeen[tk]) { skipped.tracks++; return; }
    var ship = {
      yt: t.yt || null,
      title: t.title || '',
      artist: t.artist || '',
      genre: (t.genre || 'other'),
      key: t.key || null,
      mode: t.mode === 'minor' ? 'minor' : 'major',
      bpm: t.bpm != null ? t.bpm : null,
      capo: t.capo != null ? t.capo : 0
    };
    if (Array.isArray(t.tags) && t.tags.length) ship.tags = t.tags;
    tracks.push(ship); trackSeen[tk] = true; added.tracks++;
  });

  // ---- URL overlay -> fill yt on an existing track that has none ----
  var urls = b.trackUrls || {};
  tracks.forEach(function (t) {
    var tk = T.trackKey(t);
    if (urls[tk] && !t.yt) { t.yt = urls[tk]; added.urls++; }
  });
});

writeJson(songsPath, songs);
writeJson(tracksPath, tracks);

console.log('merge-localstorage: ' + bundles.length + ' bundle(s)');
console.log('  songs  : +' + added.songs + ' added, ' + skipped.songs + ' already present (' + songs.length + ' total)');
console.log('  tracks : +' + added.tracks + ' added, ' + skipped.tracks + ' already present (' + tracks.length + ' total)');
console.log('  videos : ' + added.urls + ' curated URL(s) filled onto existing tracks');
console.log('  review `git diff` in music/shared/songs.json + music/backing-tracks/tracks.json, then commit.');

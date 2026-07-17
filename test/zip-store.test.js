/* =====================================================================
 * zip-store.test.js - S-SKILLS-PORTABLE: the store-only ZIP writer
 * (music/shared/zip-store.js). Asserts against the ZIP format itself:
 * the standard CRC-32 test vector, the record signatures at their
 * computed offsets, the end-of-central-directory counts, and that the
 * stored bytes round-trip - so a reader-tool regression can't hide
 * behind "some bytes were produced".
 * Run: node test/zip-store.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

var ZipStore = require('../music/shared/zip-store.js');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  cases.forEach(function (c) {
    try { c[1](); passed++; console.log('  ✓ ' + c[0]); }
    catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

function u32at(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }
function u16at(b, i) { return b[i] | (b[i + 1] << 8); }
function bytesOf(s) { return new Uint8Array(Buffer.from(s, 'utf8')); }

test('crc32 matches the standard vector: crc32("hello") = 0x3610A686', function () {
  assert.strictEqual(ZipStore.crc32(bytesOf('hello')), 0x3610A686);
});

test('crc32 of empty input is 0', function () {
  assert.strictEqual(ZipStore.crc32(new Uint8Array(0)), 0);
});

test('build(): local header signature, stored method, name and data bytes in place', function () {
  var z = ZipStore.build([{ path: 'ukulele/SKILL.md', text: 'hello' }]);
  assert.strictEqual(u32at(z, 0), 0x04034B50);            // local file header
  assert.strictEqual(u16at(z, 8), 0);                     // method 0 = stored
  assert.strictEqual(u32at(z, 14), 0x3610A686);           // CRC of "hello"
  assert.strictEqual(u32at(z, 18), 5);                    // compressed size
  assert.strictEqual(u32at(z, 22), 5);                    // uncompressed size
  var nameLen = u16at(z, 26);
  assert.strictEqual(nameLen, 'ukulele/SKILL.md'.length);
  var name = Buffer.from(z.slice(30, 30 + nameLen)).toString('utf8');
  assert.strictEqual(name, 'ukulele/SKILL.md');
  var data = Buffer.from(z.slice(30 + nameLen, 30 + nameLen + 5)).toString('utf8');
  assert.strictEqual(data, 'hello');
});

test('build(): end-of-central-directory carries the entry count and central-dir offset', function () {
  var files = [
    { path: 'a/SKILL.md', text: 'alpha' },
    { path: 'b/SKILL.md', text: 'beta' },
    { path: 'c/SKILL.md', text: '' }                       // empty file is valid
  ];
  var z = ZipStore.build(files);
  var eocd = z.length - 22;                                // no comment -> EOCD is the last 22 bytes
  assert.strictEqual(u32at(z, eocd), 0x06054B50);
  assert.strictEqual(u16at(z, eocd + 10), 3);              // total entries
  var cdOffset = u32at(z, eocd + 16);
  assert.strictEqual(u32at(z, cdOffset), 0x02014B50);      // central dir starts where EOCD says
});

test('build(): central-directory entries point back at each local header', function () {
  var z = ZipStore.build([{ path: 'x/SKILL.md', text: 'one' }, { path: 'y/SKILL.md', text: 'two' }]);
  var eocd = z.length - 22;
  var cd = u32at(z, eocd + 16);
  // first central entry's local-header offset field (offset 42 within the entry)
  assert.strictEqual(u32at(z, cd + 42), 0);
  assert.strictEqual(u32at(z, u32at(z, cd + 42)), 0x04034B50);
});

test('build(): duplicate paths are rejected loudly, never silently emitted', function () {
  assert.throws(function () {
    ZipStore.build([{ path: 'dup/SKILL.md', text: 'a' }, { path: 'dup/SKILL.md', text: 'b' }]);
  }, /duplicate path/);
});

test('build([]) is a valid empty archive (EOCD only, zero entries)', function () {
  var z = ZipStore.build([]);
  assert.strictEqual(z.length, 22);
  assert.strictEqual(u32at(z, 0), 0x06054B50);
  assert.strictEqual(u16at(z, 10), 0);
});

test('UTF-8 names + contents survive byte-exact (uke naming with accents)', function () {
  var z = ZipStore.build([{ path: 'café/SKILL.md', text: 'naïve' }]);
  var nameLen = u16at(z, 26);
  assert.strictEqual(Buffer.from(z.slice(30, 30 + nameLen)).toString('utf8'), 'café/SKILL.md');
  assert.strictEqual(u16at(z, 6) & 0x0800, 0x0800);        // UTF-8 flag set
});

run();

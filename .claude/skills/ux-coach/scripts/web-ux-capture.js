// web-ux-capture.js
// Instrumented UX / human-factors capture for a running screen of this app.
// Serves this repo (or hits a URL), drives Chromium at a phone viewport,
// screenshots every named screen, and emits MEASURED WCAG contrast +
// tap-target geometry off the rendered DOM - the evidence ux-coach critiques
// against instead of eyeballing. See ../references/web-ux-capture-method.md
// for the full procedure and environment gotchas.
//
// Origin: ported from a Cowork-session handoff (2026-07-23, ccp
// handoffs/incoming/2026-07-23-web-ux-capture-harness/). This copy's
// chromium-resolution was generalized to match this repo's own
// test/pw/run-scenario.py convention ($PW_CHROME > /opt/pw-browsers glob >
// ~/.cache/ms-playwright glob > Playwright's bundled default) so it also
// runs on the laptop, not just the Cowork sandbox.
//
// Relationship to test/pw/: this is NOT the regression suite. test/pw is the
// declarative, persona-driven scenario runner (Python) that guards known
// flows. This harness is the freeform exploratory-critique tool: point it at
// any screen, get measured evidence for a NEW ux-coach review pass. Once a
// finding here becomes a fix, its regression belongs in test/pw as a
// scenario, not in this script.
//
// Usage:
//   node .claude/skills/ux-coach/scripts/web-ux-capture.js \
//     --root . --path /music/play/index.html?p=ukulele-gcea
//   (or) node web-ux-capture.js --url https://example.com  (only if reachable)
//
// Flags:
//   --root <dir>     local repo root to serve (default: cwd)
//   --path <p>       path+query under root to open (default: /index.html)
//   --url <u>        absolute URL to open instead of serving locally
//   --w <px>         viewport width (default 412)
//   --h <px>         viewport height (default 915)
//   --dpr <n>        device pixel ratio (default 2)
//   --dark           force dark colorScheme + localStorage theme=dark
//   --out <dir>      output dir for screenshots + json (default ./ux-out)
//
// Screens are app-specific: edit SCREENS below (selector to click, key for
// filenames) for the flow under review.

// playwright is required LAZILY inside the run block, never at module load:
// test/ux-capture-serve.test.js requires this file for its path-resolution
// helper, and CI runs the node suite with no playwright installed. A top-level
// require here fails that suite with MODULE_NOT_FOUND even though nothing in
// the test touches a browser.
const http = require('http'); const fs = require('fs'); const path = require('path');
const os = require('os');

function arg(name, def){const i=process.argv.indexOf('--'+name);if(i<0)return def;const v=process.argv[i+1];return (v&&!v.startsWith('--'))?v:true;}
const ROOT = path.resolve(arg('root', process.cwd()));
const OPEN_PATH = arg('path', '/index.html');
const URL_ABS = arg('url', null);
const W = parseInt(arg('w',412)), H = parseInt(arg('h',915)), DPR = parseFloat(arg('dpr',2));
const DARK = !!arg('dark', false);
const OUT = path.resolve(arg('out','./ux-out'));
// 0 = OS-assigned free port. A hardcoded port fails the whole harness the
// moment anything else holds it (including a second capture run).
const PORT = parseInt(arg('port', 0), 10) || 0;
// The app greets a fresh browser profile with its first-run tour, which sits
// over every screen - capture it and you have measured onboarding while the
// filename claims the target screen. Seed the tour as done (same key
// test/pw/run-scenario.py seeds); --first-run opts back IN to measuring it.
const FIRST_RUN = !!arg('first-run', false);

// EDIT per review: bottom-nav or route selectors to reach each screen you
// want measured. `home` (no click) always runs.
const SCREENS = [
  { key:'home', click:null },
  // { key:'setlist', click:'.tabbar button[data-tab="jam"]' },
  // { key:'compose', click:'.tabbar button[data-tab="compose"]' },
];

// Chromium resolution - mirrors test/pw/run-scenario.py's convention plus the
// shared-toolchain.md second root, so this runs unmodified on the laptop
// AND in a Claude web/Cowork container:
//   $PW_CHROME > /opt/pw-browsers/chromium-*/chrome-linux*/chrome (web container)
//   > ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome (laptop shared install)
//   > Playwright's own bundled default (omit executablePath)
function resolveChromium(){
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const fsmod = require('fs');
  const roots = [
    '/opt/pw-browsers',
    path.join(os.homedir(), '.cache', 'ms-playwright'),
  ];
  for (const root of roots) {
    if (!fsmod.existsSync(root)) continue;
    const dirs = fsmod.readdirSync(root).filter(d => d.startsWith('chromium-')).sort().reverse();
    for (const d of dirs) {
      for (const sub of ['chrome-linux64', 'chrome-linux']) {
        const candidate = path.join(root, d, sub, 'chrome');
        if (fsmod.existsSync(candidate)) return candidate;
      }
    }
  }
  return null; // Playwright falls back to its own managed browser.
}

const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2','.map':'application/json'};

// Path resolution, split out of the request handler so it is unit-testable
// (test/ux-capture-serve.test.js) - the containment rule is the whole security
// surface of this dev server, and it was previously an inline expression no
// test could reach.
//
// `startsWith(ROOT)` is NOT containment: with ROOT=/home/u/repo, the path
// /../repo2/secret resolves to /home/u/repo2/secret, which startsWith(ROOT)
// happily accepts - a sibling-directory escape. path.relative() is the real
// test: an escaping path yields a result that is '..' or starts with '../'.
// Dotfiles are denied outright (.git, .env, .claude) - this serves a repo root.
//
// Returns {file} to serve, or {status, reason} to reject.
function resolveRequestPath(root, rawUrl){
  let p;
  try { p = decodeURIComponent(String(rawUrl).split('?')[0].split('#')[0]); }
  catch (e) { return {status:400, reason:'undecodable path'}; }
  if (p.indexOf('\0') !== -1) return {status:400, reason:'null byte'};
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(root, '.' + path.posix.normalize('/' + p.replace(/\\/g, '/')));
  const rel = path.relative(root, file);
  if (rel === '' || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
    return {status:403, reason:'outside root'};
  }
  if (rel.split(path.sep).some(seg => seg.startsWith('.'))) {
    return {status:403, reason:'dotfile'};
  }
  return {file: file};
}

// Bound to 127.0.0.1 (never 0.0.0.0): this serves a whole repo root with no
// auth, so it must not be reachable from the LAN. Port 0 = let the OS pick a
// free one; the caller reads server.address().port, so a second capture run
// (or any other local server) can no longer collide on a hardcoded 8199.
function serve(){
  return http.createServer((q,r)=>{
    const res = resolveRequestPath(ROOT, q.url);
    if (res.status){ r.statusCode = res.status; return r.end(res.status + ' ' + res.reason); }
    fs.readFile(res.file,(e,b)=>{
      if(e){r.statusCode=404;return r.end('404');}
      r.setHeader('Content-Type',MIME[path.extname(res.file)]||'application/octet-stream');
      r.end(b);
    });
  }).listen(PORT, '127.0.0.1');
}

function lin(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
function L(a){return 0.2126*lin(a[0])+0.7152*lin(a[1])+0.0722*lin(a[2]);}
function ratio(a,b){const l1=L(a),l2=L(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return +((hi+0.05)/(lo+0.05)).toFixed(2);}

const MEASURE = () => {
  function rgb(s){const m=(s||'').match(/rgba?\(([^)]+)\)/);if(!m)return null;const n=m[1].split(',').map(x=>parseFloat(x));return {r:n[0],g:n[1],b:n[2],a:n[3]===undefined?1:n[3]};}
  // Composite the ancestor chain properly instead of taking the first
  // non-transparent colour: a translucent layer over a dark page is NOT its own
  // colour, and scoring it as such was a confidently wrong WCAG number.
  // `ok:false` marks a backdrop we genuinely cannot compute from CSS colours
  // alone (gradient / image), so the report can say "unmeasurable" instead of
  // guessing. Same for translucent text ink, handled by the caller.
  function bgComposite(el){
    const layers=[]; let e=el, imaged=false;
    while(e){
      const cs=getComputedStyle(e);
      if(cs.backgroundImage && cs.backgroundImage!=='none') imaged=true;
      const c=rgb(cs.backgroundColor);
      if(c && c.a>0){ layers.push(c); if(c.a>=1) break; }
      e=e.parentElement;
    }
    // Page default under everything (the app's dark canvas).
    let base=[13,15,18];
    for(let i=layers.length-1;i>=0;i--){
      const c=layers[i];
      base=[c.r*c.a+base[0]*(1-c.a), c.g*c.a+base[1]*(1-c.a), c.b*c.a+base[2]*(1-c.a)];
    }
    return {rgb:base.map(v=>Math.round(v)), ok: !imaged};
  }
  const tap=[];document.querySelectorAll('button,a,[role="button"],input,select,textarea,label,[onclick]').forEach(el=>{const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return;const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return;tap.push({tag:el.tagName.toLowerCase(),text:(el.innerText||el.value||el.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,28),w:Math.round(r.width),h:Math.round(r.height),min:Math.round(Math.min(r.width,r.height)),fs:parseFloat(cs.fontSize)});});
  const text=[];const wk=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT);let n,c=0;
  while((n=wk.nextNode())&&c<6000){c++;const d=Array.from(n.childNodes).some(x=>x.nodeType===3&&x.textContent.trim());if(!d)continue;const r=n.getBoundingClientRect();if(r.width<1||r.height<1)continue;const cs=getComputedStyle(n);if(cs.visibility==='hidden'||cs.opacity==='0')continue;const fg=rgb(cs.color);if(!fg)continue;
    const back=bgComposite(n);
    // Translucent ink must be composited over its own backdrop before it can
    // be scored; element opacity < 1 does the same to everything under it.
    const elOpacity=parseFloat(cs.opacity);
    const inkA=(fg.a===undefined?1:fg.a)*(isNaN(elOpacity)?1:elOpacity);
    const ink=[fg.r*inkA+back.rgb[0]*(1-inkA), fg.g*inkA+back.rgb[1]*(1-inkA), fg.b*inkA+back.rgb[2]*(1-inkA)].map(v=>Math.round(v));
    text.push({t:n.innerText.replace(/\s+/g,' ').trim().slice(0,30),fs:parseFloat(cs.fontSize),fw:cs.fontWeight,fg:ink,bg:back.rgb,measurable:back.ok,inkAlpha:+inkA.toFixed(3)});}
  const heads=Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(h=>h.offsetParent!==null).map(h=>({t:h.tagName,txt:h.innerText.trim().slice(0,40),fs:parseFloat(getComputedStyle(h).fontSize),fw:getComputedStyle(h).fontWeight}));
  // Horizontal overflow is the documented mobile-clipping check and was
  // previously not implemented at all: scrollWidth vs innerWidth is the
  // measurement, plus the widest offenders so the finding names a culprit.
  const scrollW=Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  const overflowX=scrollW > window.innerWidth + 1;
  const wide=[];
  if(overflowX){
    document.querySelectorAll('*').forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.width>0 && r.right > window.innerWidth + 1){
        wide.push({tag:el.tagName.toLowerCase(), cls:(el.className&&el.className.toString?el.className.toString():'').slice(0,40), right:Math.round(r.right), w:Math.round(r.width)});
      }
    });
  }
  return {tap,text,heads,scrollH:document.body.scrollHeight,innerH:window.innerHeight,innerW:window.innerWidth,scrollW,overflowX,overflowOffenders:wide.slice(0,8)};
};

// Exported for test/ux-capture-serve.test.js. Requiring this file must NOT
// launch a browser, hence the require.main guard on the run block below.
module.exports = { resolveRequestPath };

if (require.main === module) (async()=>{
  const { chromium } = require('playwright'); // lazy - see the note at the top
  fs.mkdirSync(OUT,{recursive:true});
  const server = URL_ABS ? null : serve();
  await new Promise(r=>setTimeout(r,400));
  const exe = resolveChromium();
  const launchOpts = { args:['--no-sandbox','--no-proxy-server','--proxy-bypass-list=*'] };
  if (exe) launchOpts.executablePath = exe;
  const browser = await chromium.launch(launchOpts);
  const ctxOpts = { viewport:{width:W,height:H}, deviceScaleFactor:DPR, isMobile:true, hasTouch:true, userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) Mobile' };
  if(DARK) ctxOpts.colorScheme='dark';
  const ctx = await browser.newContext(ctxOpts);
  if(DARK) await ctx.addInitScript(()=>{try{localStorage.setItem('music.theme.v1','dark');}catch(e){}});
  // A fresh browser profile is a first-run device: the welcome tour blocks the
  // screen, per-tab coach marks overlay the controls being measured, and the
  // offline cue toast covers the bottom. Capturing that and filing it as "the
  // library screen" measures onboarding furniture, not the screen.
  //
  // welcomeDone alone is NOT enough - it only clears the tour. This was caught
  // by LOOKING at the smoke-run screenshot after the first fix: three coach
  // marks and the offline toast were still sitting over the UI. All three
  // stores are seeded; --first-run opts back in to measuring onboarding
  // deliberately (which is a legitimate review target, just a different one).
  if(!FIRST_RUN) await ctx.addInitScript(()=>{try{
    localStorage.setItem('music.welcomeDone.v1','1');
    localStorage.setItem('music.calloutsShown.v1', JSON.stringify({library:1, jam:1, compose:1, tune:1}));
    localStorage.setItem('music.offlineReadyCued.v1','1');
  }catch(e){}});
  const page = await ctx.newPage();
  const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));}); page.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,160)));
  // Port 0 means the OS picked one - read it back off the listening server
  // rather than assuming the requested number.
  const livePort = server ? server.address().port : null;
  const target = URL_ABS || ('http://127.0.0.1:'+livePort+OPEN_PATH);
  await page.goto(target,{waitUntil:'networkidle',timeout:60000});
  await page.waitForTimeout(2000);

  const results={}; const failedScreens=[];
  for(const s of SCREENS){
    // A swallowed click is the worst failure this harness can have: the
    // navigation never happens, the PREVIOUS screen is screenshotted under the
    // requested screen's filename, and every downstream measurement is
    // attributed to a screen that was never opened. Evidence tooling that
    // fails silently is worse than no tooling. Record it, name it in the
    // output, and exit non-zero at the end.
    if(s.click){
      try {
        await page.click(s.click,{timeout:3000});
        await page.waitForTimeout(1000);
      } catch(e) {
        const why = 'screen "'+s.key+'": click '+JSON.stringify(s.click)+' failed - '+String(e.message).split('\n')[0];
        console.error('CAPTURE FAILED - ' + why);
        failedScreens.push({key:s.key, selector:s.click, error:String(e.message).split('\n')[0]});
        results[s.key] = {error: why, captured: false};
        continue; // no screenshot, no metrics - never label the old screen as this one
      }
    }
    await page.screenshot({ path: path.join(OUT,`screen-${s.key}${DARK?'-dark':''}.png`) });
    results[s.key]=await page.evaluate(MEASURE);
    results[s.key].captured = true;
  }
  fs.writeFileSync(path.join(OUT,'metrics.json'), JSON.stringify(results,null,2));
  fs.writeFileSync(path.join(OUT,'console-errors.json'), JSON.stringify(errs,null,2));

  // report
  for(const [k,m] of Object.entries(results)){
    if(m.captured === false){ console.log(`## ${k}: NOT CAPTURED - ${m.error}`); continue; }
    const small=m.tap.filter(t=>t.min>0&&t.min<44);
    // Only text whose colours could actually be composited is scored. An
    // unmeasurable line (gradient / image backdrop, translucent ink) is
    // REPORTED as unmeasurable rather than given a confident wrong ratio.
    const measurable=m.text.filter(t=>t.measurable);
    const skipped=m.text.length-measurable.length;
    const scored=measurable.map(t=>({...t,r:ratio(t.fg,t.bg)})).sort((a,b)=>a.r-b.r);
    const worst=scored.slice(0,6).map(w=>`${w.r} "${w.t}"`).join(' | ');
    const ovf=m.overflowX ? ` OVERFLOW-X: scrollW=${m.scrollW} > innerW=${m.innerW}` : '';
    console.log(`## ${k}: ${m.tap.length} targets, <44px=${small.length}; contrast scored=${measurable.length} unmeasurable=${skipped}; worst: ${worst}${ovf}`);
  }
  console.log('console errors:', errs.length, '| output:', OUT, '| chromium:', exe || '(playwright default)');
  await browser.close(); if(server) server.close();
  if(failedScreens.length){
    console.error('\nFAILED SCREENS (' + failedScreens.length + ') - these were NOT captured; do not treat this run as complete:');
    failedScreens.forEach(f=>console.error('  - ' + f.key + ' <- ' + f.selector + ': ' + f.error));
    process.exit(2);
  }
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});

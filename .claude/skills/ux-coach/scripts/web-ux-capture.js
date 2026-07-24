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

const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const os = require('os');

function arg(name, def){const i=process.argv.indexOf('--'+name);if(i<0)return def;const v=process.argv[i+1];return (v&&!v.startsWith('--'))?v:true;}
const ROOT = path.resolve(arg('root', process.cwd()));
const OPEN_PATH = arg('path', '/index.html');
const URL_ABS = arg('url', null);
const W = parseInt(arg('w',412)), H = parseInt(arg('h',915)), DPR = parseFloat(arg('dpr',2));
const DARK = !!arg('dark', false);
const OUT = path.resolve(arg('out','./ux-out'));
const PORT = 8199;

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
function serve(){return http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)){r.statusCode=403;return r.end();}fs.readFile(f,(e,b)=>{if(e){r.statusCode=404;return r.end('404 '+p);}r.setHeader('Content-Type',MIME[path.extname(f)]||'application/octet-stream');r.end(b);});}).listen(PORT);}

function lin(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
function L(a){return 0.2126*lin(a[0])+0.7152*lin(a[1])+0.0722*lin(a[2]);}
function ratio(a,b){const l1=L(a),l2=L(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return +((hi+0.05)/(lo+0.05)).toFixed(2);}

const MEASURE = () => {
  function rgb(s){const m=(s||'').match(/rgba?\(([^)]+)\)/);if(!m)return null;const n=m[1].split(',').map(x=>parseFloat(x));return {r:n[0],g:n[1],b:n[2],a:n[3]===undefined?1:n[3]};}
  function bg(el){let e=el;while(e){const c=rgb(getComputedStyle(e).backgroundColor);if(c&&c.a>0)return[c.r,c.g,c.b];e=e.parentElement;}return[13,15,18];}
  const tap=[];document.querySelectorAll('button,a,[role="button"],input,select,textarea,label,[onclick]').forEach(el=>{const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return;const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return;tap.push({tag:el.tagName.toLowerCase(),text:(el.innerText||el.value||el.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,28),w:Math.round(r.width),h:Math.round(r.height),min:Math.round(Math.min(r.width,r.height)),fs:parseFloat(cs.fontSize)});});
  const text=[];const wk=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT);let n,c=0;
  while((n=wk.nextNode())&&c<6000){c++;const d=Array.from(n.childNodes).some(x=>x.nodeType===3&&x.textContent.trim());if(!d)continue;const r=n.getBoundingClientRect();if(r.width<1||r.height<1)continue;const cs=getComputedStyle(n);if(cs.visibility==='hidden'||cs.opacity==='0')continue;const fg=rgb(cs.color);if(!fg)continue;text.push({t:n.innerText.replace(/\s+/g,' ').trim().slice(0,30),fs:parseFloat(cs.fontSize),fw:cs.fontWeight,fg:[fg.r,fg.g,fg.b],bg:bg(n)});}
  const heads=Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(h=>h.offsetParent!==null).map(h=>({t:h.tagName,txt:h.innerText.trim().slice(0,40),fs:parseFloat(getComputedStyle(h).fontSize),fw:getComputedStyle(h).fontWeight}));
  return {tap,text,heads,scrollH:document.body.scrollHeight,innerH:window.innerHeight,innerW:window.innerWidth};
};

(async()=>{
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
  const page = await ctx.newPage();
  const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));}); page.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,160)));
  const target = URL_ABS || ('http://localhost:'+PORT+OPEN_PATH);
  await page.goto(target,{waitUntil:'networkidle',timeout:60000});
  await page.waitForTimeout(2000);

  const results={};
  for(const s of SCREENS){
    if(s.click){ try{ await page.click(s.click,{timeout:3000}); await page.waitForTimeout(1000);}catch(e){} }
    await page.screenshot({ path: path.join(OUT,`screen-${s.key}${DARK?'-dark':''}.png`) });
    results[s.key]=await page.evaluate(MEASURE);
  }
  fs.writeFileSync(path.join(OUT,'metrics.json'), JSON.stringify(results,null,2));
  fs.writeFileSync(path.join(OUT,'console-errors.json'), JSON.stringify(errs,null,2));

  // report
  for(const [k,m] of Object.entries(results)){
    const small=m.tap.filter(t=>t.min>0&&t.min<44);
    const scored=m.text.map(t=>({...t,r:ratio(t.fg,t.bg)})).sort((a,b)=>a.r-b.r);
    const worst=scored.slice(0,6).map(w=>`${w.r} "${w.t}"`).join(' | ');
    console.log(`## ${k}: ${m.tap.length} targets, <44px=${small.length}; worst contrast: ${worst}`);
  }
  console.log('console errors:', errs.length, '| output:', OUT, '| chromium:', exe || '(playwright default)');
  await browser.close(); if(server) server.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});

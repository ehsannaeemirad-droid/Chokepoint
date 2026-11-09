BLANK SCREEN FIX
================

WHY IT BROKE
1. Files from the patch were uploaded to the REPO ROOT (Game.ts, Ui.ts, index.ts, …)
   instead of into src/...  That does not change the live game.
2. Root index.html is the Vite DEV page. It loads /src/main.ts which GitHub Pages
   cannot run → black screen.
3. The working build lives in dist/ (index.html + assets/*.js). Pages must serve THAT.

IMMEDIATE FIX (restore a working game — old build, not the new features yet)
---------------------------------------------------------------------------
A) In GitHub repo settings → Pages:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /dist   ← preferred if available

OR

B) Upload the contents of THIS folder to the repo ROOT, replacing root index.html
   and adding/replacing the assets/ folder:
   - index.html
   - assets/index-*.js
   - assets/phaser-*.js
   - assets/index-*.css
   - manifest.webmanifest, sw.js, icons

Then hard-refresh (Ctrl+Shift+R) or clear site data so the service worker drops
the broken cache.

DELETE these wrongly uploaded ROOT files (they do not belong there):
  Game.ts, Ui.ts, config.ts, engine.ts, index.ts, objectives.ts, objectives.test.ts,
  prewar.test.ts, radar.ts, save.ts, mapNodes.json, orderOfBattle.json, scenarios.json,
  and any empty folders core/, data/, i18n/ at the ROOT (keep the ones under src/).

TO GET THE NEW FEATURES LIVE
----------------------------
Someone must run a production build after sources are correctly under src/:

  corepack pnpm install
  corepack pnpm build

Then commit the updated dist/ folder (or set Pages to /dist) and push.

Correct source paths for the feature patch:
  src/ui/objectives.ts
  src/ui/objectives.test.ts
  src/ui/Ui.ts
  src/styles.css
  src/i18n/index.ts
  src/data/orderOfBattle.json
  src/data/scenarios.json
  src/data/mapNodes.json
  src/core/config.ts, types.ts, Game.ts, engine.ts, prewar.test.ts
  src/combat/radar.ts
  src/services/save.ts

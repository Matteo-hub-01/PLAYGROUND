import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const shared=read("js/site-features.js"),menu=read("index.html"),manifest=read("manifest.webmanifest"),sw=read("sw.js");

test("les preferences, statistiques et succes sont persistants",()=>{
  assert.match(shared,/localStorage/);assert.match(shared,/achievements/);assert.match(shared,/showStats/);assert.match(shared,/best/);
});
test("les aides, themes, sons et sorties securisees sont communs",()=>{
  assert.match(shared,/showHelp/);assert.match(shared,/showThemes/);assert.match(shared,/showSettings/);assert.match(shared,/beforeunload/);
});
test("le catalogue propose guide, tournoi et animation d ouverture",()=>{
  assert.match(menu,/help\.html/);assert.match(menu,/tournament\.html/);assert.match(shared,/pg-opening/);
});
test("le site est installable et disponible hors connexion",()=>{
  assert.equal(JSON.parse(manifest).display,"standalone");assert.match(sw,/caches\.open/);assert.match(shared,/serviceWorker\.register/);
});
test("chaque jeu charge les fonctions communes",()=>{
  for(const file of["push-off.html","pong.html","chess.html","racing.html"]){const html=read(file);assert.match(html,/shared-features\.css/);assert.match(html,/site-features\.js/)}
});

test("les performances adaptatives et le profil sont disponibles",()=>{
  assert.match(shared,/function frame/);assert.match(shared,/performance/);assert.match(shared,/showProfile/);assert.match(shared,/audioContext/);
  assert.match(read("js/chess-main.js"),/chess-worker\.js/);assert.match(read("scripts/build.mjs"),/dist/);
});

const upgrades=read("js/site-upgrades.js");test("recherche, filtres, tutoriels et défis quotidiens sont disponibles",()=>{assert.match(upgrades,/catalog-controls/);assert.match(upgrades,/seenTutorials/);assert.match(upgrades,/DÉFI DU JOUR/);assert.match(upgrades,/playground:finished/)});
test("la musique possède un réglage séparé des effets",()=>{assert.match(shared,/musicVolume/);assert.match(shared,/pg-music/);assert.match(shared,/function syncMusic/)});
test("le mode clair et sombre est global et persistant",()=>{
  const css=read("css/shared-features.css");
  assert.match(shared,/function addAppearanceToggle/);
  assert.match(shared,/MutationObserver\(syncDialogAppearanceToggles\)/);
  assert.match(shared,/dialog\[open\]/);
  assert.match(shared,/documentElement\.dataset\.pgAppearance/);
  assert.match(css,/html\[data-pg-appearance="light"\]/);
  for(const file of["index.html","push-off.html","pong.html","chess.html","racing.html","tournament.html","help.html"]){
    assert.match(read(file),/documentElement\.dataset\.pgAppearance/);
  }
});
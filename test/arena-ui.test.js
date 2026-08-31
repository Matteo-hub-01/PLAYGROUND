import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../push-off.html",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/arena-main.js",import.meta.url),"utf8");
const styles=readFileSync(new URL("../css/arena.css",import.meta.url),"utf8");

test("le menu expose personnages, arènes, objets et volume",()=>{
  for(const id of["arena-select","character-1","character-2","items-toggle","lives-select","volume-range"])assert.match(html,new RegExp('id="'+id+'"'));
});
test("les commandes tactiles comprennent le dash",()=>assert.match(html,/data-action="dash"/));
test("les manettes et touches personnalisées sont prises en charge",()=>{
  assert.match(main,/getGamepads/);assert.match(main,/pushOffBindings/);assert.match(main,/listeningBinding/);
});
test("les statistiques de fin de partie sont rendues",()=>{
  for(const text of["Coups : ","Esquives : ","Dégâts max : ","Temps en l'air : "])assert.ok(main.includes(text));
});
test("les touches alphabétiques utilisent le caractère du clavier pour AZERTY",()=>{
  assert.match(main,/event\.key\?\.length===1/);assert.match(main,/p1Left:"q"/);
});
test("le mode plein écran est disponible et accessible",()=>{assert.match(html,/id="fullscreen-button"/);assert.match(main,/requestFullscreen/);assert.match(main,/fullscreenchange/);assert.match(styles,/:fullscreen/)});

test("la grille de combattants précède chaque partie",()=>{
  for(const id of["fighter-select","character-grid-1","character-grid-2","confirm-fighters","ai-random-2"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(main,/function renderFighterSelection/);assert.match(main,/function openFighterSelection/);assert.match(main,/playground:replay/);
});

test("les IA reçoivent un personnage aléatoire à chaque duel",()=>{
  assert.match(main,/game\.randomCharacter\(\)/);assert.match(main,/game\.randomCharacter\(\[choices\[0\]\]\)/);
});

test("les trois nouveaux designs et effets d attaque sont rendus",()=>{
  for(const id of["ember","volt","nova"])assert.match(styles,new RegExp('data-character="'+id+'"'));
  for(const style of["firewave","rush","gravity"])assert.match(main,new RegExp('attackStyle==="'+style+'"'));
});
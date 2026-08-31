import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const menu=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const styles=readFileSync(new URL("../css/menu.css",import.meta.url),"utf8");

test("le menu principal rÃ©fÃ©rence tous les jeux du site",()=>{
  assert.match(menu,/href="push-off\.html"/);assert.match(menu,/href="pong\.html"/);assert.match(menu,/href="chess\.html"/);assert.match(menu,/href="racing\.html"/);
  assert.match(menu,/>Push Off</);assert.match(menu,/>Pong</);assert.match(menu,/>Échecs</);assert.match(menu,/>Turbo Circuit</);
});
test("les cartes du catalogue sont responsives et accessibles",()=>{
  assert.match(menu,/aria-labelledby="games-title"/);assert.match(styles,/@media\(max-width:760px\)/);
  assert.match(styles,/\.game-card:focus-visible/);
});
test("chaque jeu possÃ¨de une illustration dÃ©diÃ©e",()=>{
  assert.match(menu,/push-art/);assert.match(menu,/pong-art/);assert.match(menu,/chess-art/);assert.match(menu,/racing-art/);assert.match(styles,/\.push-art/);assert.match(styles,/\.pong-art/);assert.match(styles,/\.chess-art/);assert.match(styles,/\.racing-art/);
});
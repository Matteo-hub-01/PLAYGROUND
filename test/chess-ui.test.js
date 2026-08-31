import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../chess.html",import.meta.url),"utf8"),script=readFileSync(new URL("../js/chess-main.js",import.meta.url),"utf8"),styles=readFileSync(new URL("../css/chess.css",import.meta.url),"utf8");
test("la page d’échecs expose les trois modes",()=>{assert.match(page,/player-vs-ai/);assert.match(page,/player-vs-player/);assert.match(page,/ai-vs-ai/)});
test("l’interface propose difficulté, annulation et rotation",()=>{assert.match(page,/id="difficulty"/);assert.match(page,/id="undo-move"/);assert.match(page,/id="flip-board"/)});
test("l’échiquier est accessible et responsive",()=>{assert.match(page,/role="grid"/);assert.match(script,/aria-label/);assert.match(styles,/@media\(max-width:760px\)/)});
test("la promotion et le mode IA contre IA sont pilotés",()=>{assert.match(script,/showModal/);assert.match(script,/chooseAIMove/);assert.match(script,/modeSelect\.value==="ai-vs-ai"/)});
test("horloge, indice, themes, puzzle et export sont disponibles",()=>{for(const id of["chess-clock","chess-theme","hint-move","puzzle-game","export-game","white-clock","black-clock"])assert.match(page,new RegExp(`id="${id}"`));assert.match(script,/function hint/);assert.match(script,/function loadPuzzle/);assert.match(script,/function exportGame/)});
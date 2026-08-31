import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const page=read("racing.html"),main=read("js/racing-main.js"),styles=read("css/racing.css");
test("Turbo Circuit propose les trois modes et plusieurs tours",()=>{for(const value of["player-vs-ai","player-vs-player","ai-vs-ai"])assert.match(page,new RegExp(`value="${value}"`));assert.match(page,/id="race-laps"/)});
test("le rendu utilise Three.js et un ecran partage WebGL",()=>{assert.match(main,/import.*as T/);assert.match(main,/WebGLRenderer/);assert.match(main,/setScissor/);assert.match(main,/PerspectiveCamera/);assert.ok(main.includes("vendor/three.module.min.js"));assert.ok(read("vendor/three.core.min.js").length>100000)});
test("les commandes AZERTY et tactiles sont disponibles sans plein écran",()=>{assert.match(main,/keys\.has\("q"\)/);assert.match(page,/data-race-action="accelerate"/);assert.match(page,/data-race-action="handbrake"/);assert.match(page,/data-drift/);assert.match(main,/smokePool/);assert.doesNotMatch(page,/fullscreen/i);assert.doesNotMatch(main,/requestFullscreen/);assert.doesNotMatch(styles,/:fullscreen/)});
test("garage et plusieurs circuits, cameras et experiences sont proposés",()=>{for(const id of["race-style","race-circuit","race-camera","race-car","race-color"])assert.match(page,new RegExp(`id="${id}"`));assert.match(main,/trackPresets/);assert.match(main,/cinematic/)});
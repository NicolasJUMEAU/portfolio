/* Path of the Loner – version JavaScript simplifiée du mode PvE.
   Les stats des héros, des monstres et des objets viennent des mêmes fichiers JSON
   que la version C++ (data/hero.json, data/creature.json, data/items.json).
   Règles reprises du C++ : initiative, esquive en %, dégâts = attaque - défense / 2,
   PV remis au max après une victoire, butin (50 %) équipé s'il est meilleur. */
(() => {
  "use strict";

  // ---------- Constantes ----------
  const SIZE = 7;                        // carte 7×7 (10×10 dans le C++)
  const ROOMS = { merchant: 3, boss: 2, elite: 9 };
  const TIER = { normal: 1, elite: 2, boss: 3 };
  const XP = { normal: 1, elite: 3, boss: 6 };
  const GOLD = { normal: [6, 12], elite: [18, 30], boss: [45, 70] };
  const LEVEL_UP = { hp: 20, atk: 3, def: 2 };
  const FLEE_CHANCE = 75;
  const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"];
  const RARITY_NAME = { COMMON: "commune", RARE: "rare", EPIC: "épique", LEGENDARY: "légendaire" };
  const PRICE = { COMMON: 20, RARE: 45, EPIC: 90, LEGENDARY: 170 };
  const POTION_PRICE = 30;
  const WEAPON_NAME = { simple: "Épée", guerrier: "Hache", archer: "Arc", mage: "Bâton" };
  const HERO_DESC = {
    simple: "Équilibré, un bon point de départ.",
    guerrier: "Robuste et puissant, mais lent.",
    archer: "Frappe toujours en premier, esquive souvent.",
    mage: "Plus insaisissable qu'un simple héros."
  };
  const ROOM_NAME = {
    start: "Salle de départ", normal: "Salle de monstre", elite: "Salle d'élite",
    boss: "Antre du boss", merchant: "Le marchand", end: "Salle du trésor"
  };
  const ROOM_COLOR = { normal: "#b33e3e", elite: "#802828", boss: "#5c2020", merchant: "#255e38", end: "#ffdb4a", start: "#3a3530" };
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const IMG_FILE = {
    "Ours polaire": "ours_polaire", "Horde de nains": "horde_de_nains", "Squelette": "skelette",
    "Huldra": "huldra", "Jotnar": "jotnar", "Elf noir": "elf_noir",
    "Fenrir": "fenrir", "Fafnir": "fafnir", "Surt": "surt"
  };

  // ---------- Utilitaires ----------
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = rand(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  let DATA = null;   // { heroes, bestiary, items }
  let G = null;      // état de la partie
  let busy = false;  // animation de combat en cours

  // ---------- Chargement des données ----------
  async function loadData() {
    const [heroes, creatures, items] = await Promise.all(
      ["hero", "creature", "items"].map((f) => fetch(`data/${f}.json`).then((r) => r.json()))
    );
    DATA = { heroes, bestiary: creatures.bestiary, items };
  }

  // ---------- Objets (équivalent de ItemFactory / rollRarity) ----------
  function rollRarity(weights = [50, 30, 15, 5]) {
    let roll = rand(0, 99);
    for (let i = 0; i < 4; i++) { if (roll < weights[i]) return RARITIES[i]; roll -= weights[i]; }
    return "COMMON";
  }
  function makeItem(kind, rarity) {
    const range = DATA.items[kind === "weapon" ? "weapons" : "armors"][rarity];
    return { kind, rarity, value: rand(range.min, range.max) };
  }
  function itemName(item) {
    const base = item.kind === "weapon" ? WEAPON_NAME[G.hero.key] : "Armure";
    return `${base} ${RARITY_NAME[item.rarity]}`;
  }
  function itemImg(item, icon = false) {
    return `img/${icon ? "icons/" : ""}${G.hero.key}_${item.kind === "weapon" ? "weapon" : "armor"}_${item.rarity.toLowerCase()}.webp`;
  }

  // ---------- Génération de la carte (équivalent de Map::map_generation) ----------
  function makeMonster(type) {
    const m = pick(DATA.bestiary.filter((c) => c.level_loot === TIER[type]));
    return { name: m.name, img: `img/${IMG_FILE[m.name]}.webp`, hp: m.stats.hp, max: m.stats.hp, ...m.stats };
  }
  function generateMap() {
    const cells = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) cells.push([x, y]);
    const grid = Array.from({ length: SIZE }, () => Array(SIZE));
    const start = pick(cells);
    // Le trésor est placé loin du départ pour obliger à explorer.
    const far = cells.filter(([x, y]) => Math.abs(x - start[0]) + Math.abs(y - start[1]) >= 5);
    const end = pick(far);
    const rest = shuffle(cells.filter((c) => c !== start && c !== end));
    // Pas d'élite juste à côté du départ, ni de boss à moins de 3 salles.
    const dist = ([x, y]) => Math.abs(x - start[0]) + Math.abs(y - start[1]);
    const place = (type, count, minDist) => {
      for (let n = 0; n < count; n++) {
        const i = rest.findIndex((c) => dist(c) >= minDist);
        const [x, y] = rest.splice(i, 1)[0];
        grid[y][x] = { type, state: "hidden" };
      }
    };
    place("boss", ROOMS.boss, 3);
    place("elite", ROOMS.elite, 2);
    place("merchant", ROOMS.merchant, 1);
    for (const [x, y] of rest) grid[y][x] = { type: "normal", state: "hidden" };
    grid[start[1]][start[0]] = { type: "start", state: "defeated" };
    grid[end[1]][end[0]] = { type: "end", state: "hidden" };
    for (const row of grid) for (const room of row) {
      if (TIER[room.type]) room.monster = makeMonster(room.type);
    }
    return { grid, start: { x: start[0], y: start[1] } };
  }

  // ---------- Héros ----------
  function makeHero(key) {
    const h = DATA.heroes[key];
    return {
      key, name: h.name, hp: h.hp, max: h.hp, atk: [...h.attack], def: h.defense,
      dodge: h.dodge, init: h.initiative, level: 1, xp: 0, gold: 10, weapon: null, armor: null
    };
  }
  const heroAtk = (h) => [h.atk[0] + (h.weapon ? h.weapon.value : 0), h.atk[1] + (h.weapon ? h.weapon.value : 0)];
  const heroDef = (h) => h.def + (h.armor ? h.armor.value : 0);

  // ---------- Combat (équivalent de Character::attack) ----------
  function strike(atkRange, defense, dodge) {
    if (rand(0, 99) < dodge) return null;            // esquive
    return Math.max(1, rand(atkRange[0], atkRange[1]) - Math.floor(defense / 2));
  }

  // ---------- Écrans ----------
  function show(id) {
    for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id;
    window.scrollTo(0, 0);
  }

  function renderHeroChoice() {
    const list = $("hero-list");
    list.innerHTML = "";
    for (const [key, h] of Object.entries(DATA.heroes)) {
      const b = document.createElement("button");
      b.className = "hero-card";
      b.innerHTML = `<img src="img/${key}_unarmed.webp" alt="">
        <h3>${h.name}</h3><p class="desc">${HERO_DESC[key]}</p>
        <dl><dt>PV</dt><dd>${h.hp}</dd><dt>Attaque</dt><dd>${h.attack[0]}–${h.attack[1]}</dd>
        <dt>Défense</dt><dd>${h.defense}</dd><dt>Esquive</dt><dd>${h.dodge} %</dd>
        <dt>Initiative</dt><dd>${h.initiative}</dd></dl>`;
      b.addEventListener("click", () => newGame(key));
      list.appendChild(b);
    }
  }

  // ---------- Partie ----------
  function newGame(key) {
    const { grid, start } = generateMap();
    G = { hero: makeHero(key), grid, pos: start, prev: null, kills: 0, explored: 1, over: false, log: [] };
    $("log").innerHTML = "";
    $("overlay").hidden = true;
    log(`${G.hero.name} entre seul dans le donjon. Trouvez la salle du trésor !`);
    show("screen-game");
    render();
  }

  const room = () => G.grid[G.pos.y][G.pos.x];
  const inFight = () => { const r = room(); return r.monster && r.state === "visited"; };

  function log(text, cls = "") {
    const li = document.createElement("li");
    li.textContent = text;
    if (cls) li.className = cls;
    $("log").prepend(li);
  }

  function move(dir) {
    if (!G || G.over || busy || inFight()) return;
    const [dx, dy] = DIRS[dir];
    const x = G.pos.x + dx, y = G.pos.y + dy;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    G.prev = { ...G.pos };
    G.pos = { x, y };
    enterRoom();
  }

  function enterRoom() {
    const r = room();
    if (r.state === "hidden" || r.state === "known") {
      G.explored++;
      r.state = r.monster ? "visited" : "defeated";
      if (r.monster) log(`${r.monster.name} vous barre la route !`, "bad");
      if (r.type === "merchant") { r.stock = makeStock(); log("Un marchand vous propose ses articles."); }
    }
    render();
    if (r.type === "end") victory();
  }

  function makeStock() {
    const w = [35, 40, 20, 5];
    return [makeItem("weapon", rollRarity(w)), makeItem("armor", rollRarity(w)), { kind: "potion" }];
  }

  async function attack() {
    if (!G || G.over || busy || !inFight()) return;
    busy = true; renderActions();
    const h = G.hero, m = room().monster;
    const heroFirst = h.init >= m.init;
    const order = heroFirst ? ["hero", "monster"] : ["monster", "hero"];
    for (const who of order) {
      if (who === "hero") {
        const dmg = strike(heroAtk(h), m.def, m.dodge);
        await animateHit("hero", dmg);
        if (dmg === null) log(`${m.name} esquive votre coup.`);
        else { m.hp = Math.max(0, m.hp - dmg); log(`Vous infligez ${dmg} dégâts à ${m.name}.`); }
        renderBars();
        if (m.hp <= 0) { await wait(250); busy = false; return winFight(); }
      } else {
        const dmg = strike([m.atk, m.atk], heroDef(h), h.dodge);
        await animateHit("monster", dmg);
        if (dmg === null) log(`Vous esquivez l'attaque de ${m.name}.`, "good");
        else { h.hp = Math.max(0, h.hp - dmg); log(`${m.name} vous inflige ${dmg} dégâts.`, "bad"); }
        renderBars();
        if (h.hp <= 0) { await wait(250); busy = false; return defeat(); }
      }
    }
    busy = false;
    render();
  }

  async function flee() {
    if (!G || G.over || busy || !inFight()) return;
    busy = true; renderActions();
    const m = room().monster;
    if (rand(0, 99) < FLEE_CHANCE) {
      log(`Vous fuyez ${m.name} et revenez sur vos pas.`);
      G.pos = G.prev;
      G.prev = null;
      busy = false;
      render();
      return;
    }
    log("La fuite échoue !", "bad");
    const dmg = strike([m.atk, m.atk], heroDef(G.hero), G.hero.dodge);
    await animateHit("monster", dmg);
    if (dmg !== null) { G.hero.hp = Math.max(0, G.hero.hp - dmg); log(`${m.name} vous inflige ${dmg} dégâts.`, "bad"); }
    renderBars();
    busy = false;
    if (G.hero.hp <= 0) return defeat();
    render();
  }

  function winFight() {
    const r = room(), h = G.hero, m = r.monster;
    r.state = "defeated";
    G.kills++;
    const gold = rand(...GOLD[r.type]);
    h.gold += gold;
    h.hp = h.max;  // comme dans le C++ : PV remis à 100 % après une victoire
    log(`${m.name} est vaincu ! +${gold} or. Vos PV sont restaurés.`, "good");
    // Expérience et niveaux (up_level n'était pas encore codé dans le C++)
    h.xp += XP[r.type];
    while (h.xp >= h.level + 1) {
      h.xp -= h.level + 1; h.level++;
      h.max += LEVEL_UP.hp; h.hp = h.max; h.atk = h.atk.map((v) => v + LEVEL_UP.atk); h.def += LEVEL_UP.def;
      log(`Niveau ${h.level} ! +${LEVEL_UP.hp} PV max, +${LEVEL_UP.atk} attaque, +${LEVEL_UP.def} défense.`, "loot");
    }
    // Butin (Creature::loot) : 50 %, arme ou armure, équipée si meilleure
    if (rand(0, 99) < 50) {
      const item = makeItem(rand(0, 1) ? "armor" : "weapon", rollRarity());
      offerItem(item, "Butin");
    }
    // Un boss vaincu révèle la salle du trésor
    if (r.type === "boss") {
      for (const row of G.grid) for (const c of row) if (c.type === "end" && c.state === "hidden") c.state = "known";
      log("En mourant, le boss vous murmure où se cache le trésor.", "loot");
    }
    render();
  }

  function offerItem(item, source) {
    const h = G.hero, slot = item.kind;
    const current = h[slot];
    const label = item.kind === "weapon" ? `+${item.value} attaque` : `+${item.value} défense`;
    if (!current || item.value > current.value) {
      h[slot] = item;
      log(`${source} : ${itemName(item)} (${label}) équipée !`, "loot");
      return true;
    }
    log(`${source} : ${itemName(item)} (${label}), moins bonne que la vôtre.`);
    return false;
  }

  function buy(i) {
    const r = room(), h = G.hero, it = r.stock[i];
    if (!it || it.sold) return;
    const price = it.kind === "potion" ? POTION_PRICE : PRICE[it.rarity];
    if (h.gold < price) return;
    h.gold -= price;
    it.sold = true;
    if (it.kind === "potion") {
      h.max += 15; h.hp = h.max;
      log("Vous buvez l'hydromel du marchand : +15 PV max.", "loot");
    } else {
      h[it.kind] = it;
      log(`Vous achetez ${itemName(it)} pour ${price} or.`, "loot");
    }
    render();
  }

  function victory() {
    G.over = true;
    endScreen("img/tresor.webp", "Victoire !",
      `Vous avez trouvé le trésor au niveau ${G.hero.level}, après ${G.kills} monstre${G.kills > 1 ? "s" : ""} vaincu${G.kills > 1 ? "s" : ""} et ${G.explored} salles explorées sur ${SIZE * SIZE}.`);
  }
  function defeat() {
    G.over = true;
    render();
    const m = room().monster;
    endScreen(m.img, "Vous êtes mort…",
      `${m.name} a eu raison de vous au niveau ${G.hero.level}. Vous aviez vaincu ${G.kills} monstre${G.kills > 1 ? "s" : ""}.`);
  }
  function endScreen(img, title, text) {
    $("end-img").src = img;
    $("end-title").textContent = title;
    $("end-text").textContent = text;
    $("overlay").hidden = false;
    $("btn-replay").focus();
  }

  // ---------- Animations ----------
  async function animateHit(attacker, dmg) {
    const atkEl = attacker === "hero" ? $("hero-side") : $("enemy-side");
    const defEl = attacker === "hero" ? $("enemy-side") : $("hero-side");
    atkEl.classList.add(attacker === "hero" ? "lunge-right" : "lunge-left");
    await wait(180);
    atkEl.classList.remove("lunge-right", "lunge-left");
    const sprite = defEl.querySelector(".sprite");
    if (dmg !== null) { sprite.classList.remove("hurt"); void sprite.offsetWidth; sprite.classList.add("hurt"); }
    const f = document.createElement("div");
    f.className = "float" + (dmg === null ? " miss" : "");
    f.textContent = dmg === null ? "Esquive !" : `-${dmg}`;
    const stage = $("stage").getBoundingClientRect(), box = defEl.getBoundingClientRect();
    f.style.left = `${box.left - stage.left + box.width / 2 - 20}px`;
    f.style.top = `${box.top - stage.top + box.height * 0.3}px`;
    $("stage").appendChild(f);
    setTimeout(() => f.remove(), 900);
    await wait(420);
  }

  // ---------- Rendu ----------
  function render() {
    const r = room(), h = G.hero;
    $("room-label").textContent = ROOM_NAME[r.type] + (r.monster && r.state === "defeated" ? " (nettoyée)" : "");
    // Héros : corps (armé si une arme est équipée) + calques arme / armure, comme Hero::draw
    const layers = [`img/${h.key}_${h.weapon ? "armed" : "unarmed"}.webp`];
    if (h.armor) layers.push(itemImg(h.armor));
    if (h.weapon) layers.push(itemImg(h.weapon));
    const sprite = $("hero-sprite");
    const html = layers.map((src) => `<img src="${src}" alt="">`).join("");
    if (sprite.dataset.layers !== html) { sprite.innerHTML = html; sprite.dataset.layers = html; }
    // Monstre
    const fighting = inFight();
    $("enemy-side").hidden = !fighting;
    if (fighting) {
      $("enemy-img").src = r.monster.img;
      $("enemy-img").alt = r.monster.name;
      $("enemy-name").textContent = r.monster.name;
    }
    $("merchant-img").hidden = r.type !== "merchant";
    // Portes
    for (const btn of document.querySelectorAll(".door")) {
      const [dx, dy] = DIRS[btn.dataset.dir];
      const x = G.pos.x + dx, y = G.pos.y + dy;
      btn.hidden = fighting || G.over || x < 0 || y < 0 || x >= SIZE || y >= SIZE;
    }
    renderBars();
    renderActions();
    renderMap();
    renderStats();
  }

  function renderBars() {
    const h = G.hero;
    $("hero-bar").style.width = `${(100 * h.hp) / h.max}%`;
    $("hero-bar-txt").textContent = `${h.hp} / ${h.max}`;
    const r = room();
    if (r.monster) {
      $("enemy-bar").style.width = `${(100 * r.monster.hp) / r.monster.max}%`;
      $("enemy-bar-txt").textContent = `${r.monster.hp} / ${r.monster.max}`;
    }
    renderStats();
  }

  function renderActions() {
    const box = $("actions"), r = room();
    box.innerHTML = "";
    if (G.over) return;
    if (inFight()) {
      const a = button("Attaquer", attack); a.disabled = busy;
      const f = button(`Fuir (${FLEE_CHANCE} %)`, flee, "btn red"); f.disabled = busy;
      box.append(a, f);
      return;
    }
    if (r.type === "merchant" && r.stock) {
      r.stock.forEach((it, i) => {
        const div = document.createElement("div");
        div.className = "shop-item";
        const price = it.kind === "potion" ? POTION_PRICE : PRICE[it.rarity];
        if (it.kind === "potion") {
          div.innerHTML = `<div><b>Hydromel</b><br><small>+15 PV max</small></div>`;
        } else {
          const cur = G.hero[it.kind];
          const stat = it.kind === "weapon" ? "attaque" : "défense";
          div.innerHTML = `<img src="${itemImg(it, true)}" alt=""><div><b class="r-${it.rarity}">${cap(itemName(it))}</b><br>
            <small>+${it.value} ${stat}${cur ? ` (actuel : +${cur.value})` : ""}</small></div>`;
        }
        const worse = it.kind !== "potion" && G.hero[it.kind] && it.value <= G.hero[it.kind].value;
        const b = button(it.sold ? "Vendu" : worse ? "Moins bon" : `${price} or`, () => buy(i));
        b.disabled = it.sold || worse || G.hero.gold < price;
        div.appendChild(b);
        box.appendChild(div);
      });
      return;
    }
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Choisissez une direction avec les flèches autour de la salle.";
    box.appendChild(p);
  }

  function button(label, fn, cls = "btn") {
    const b = document.createElement("button");
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", fn);
    return b;
  }

  function renderMap() {
    const map = $("map");
    map.innerHTML = "";
    const known = (x, y) => G.grid[y] && G.grid[y][x] && G.grid[y][x].state !== "hidden" && G.grid[y][x].state !== "known";
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const c = G.grid[y][x], i = document.createElement("i");
      if (c.state === "visited" || (c.state === "defeated" && !c.monster)) i.style.background = ROOM_COLOR[c.type];
      else if (c.state === "defeated") i.style.background = "#646464";
      else if (c.state === "known") { i.style.background = ROOM_COLOR.end; i.style.opacity = ".6"; i.textContent = "★"; }
      else if (known(x - 1, y) || known(x + 1, y) || known(x, y - 1) || known(x, y + 1)) { i.className = "frontier"; i.textContent = "?"; }
      if (x === G.pos.x && y === G.pos.y) i.classList.add("here");
      map.appendChild(i);
    }
  }

  function renderStats() {
    const h = G.hero, a = heroAtk(h);
    $("hero-title").textContent = `${h.name} · niveau ${h.level}`;
    const eq = (it) => it ? `<span class="r-${it.rarity}">${cap(itemName(it))} (+${it.value})</span>` : "aucune";
    $("stats").innerHTML = `
      <dt>PV</dt><dd>${h.hp} / ${h.max}</dd>
      <dt>Attaque</dt><dd>${a[0]}–${a[1]}</dd>
      <dt>Défense</dt><dd>${heroDef(h)}</dd>
      <dt>Esquive</dt><dd>${h.dodge} %</dd>
      <dt>Initiative</dt><dd>${h.init}</dd>
      <dt>Expérience</dt><dd>${h.xp} / ${h.level + 1}</dd>
      <dt>Or</dt><dd>${h.gold}</dd>
      <dt>Arme</dt><dd>${eq(h.weapon)}</dd>
      <dt>Armure</dt><dd>${eq(h.armor)}</dd>
      <dt>Exploré</dt><dd>${G.explored} / ${SIZE * SIZE} salles</dd>`;
  }

  // ---------- Événements ----------
  $("btn-start").addEventListener("click", () => show("screen-heroes"));
  $("btn-back").addEventListener("click", () => show("screen-title"));
  $("btn-replay").addEventListener("click", () => { $("overlay").hidden = true; show("screen-heroes"); });
  for (const d of document.querySelectorAll(".door")) d.addEventListener("click", () => move(d.dataset.dir));
  document.addEventListener("keydown", (e) => {
    if (!G || $("screen-game").hidden || !$("overlay").hidden) return;
    const k = e.key.toLowerCase();
    const dir = { arrowup: "up", z: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", q: "left", a: "left", arrowright: "right", d: "right" }[k];
    if (dir) { e.preventDefault(); move(dir); }
    else if (k === " " || k === "enter") { if (inFight()) { e.preventDefault(); attack(); } }
    else if (k === "f") flee();
  });

  loadData().then(renderHeroChoice).catch(() => {
    $("hero-list").innerHTML = "<p>Impossible de charger les données du jeu.</p>";
  });
})();

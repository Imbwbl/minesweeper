(() => {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const main = $("main");
    const status = $("status");
    const bombsLeft = $("bombs-left");
    const timerEl = $("timer");
    const flagBtn = $("flag-mode");
    const dialog = $("settings");
    const form = $("settings-form");
    const levelSel = $("level");
    const sizeIn = $("size");
    const bombsIn = $("bombs");
    const themeSel = $("theme");
    const recordInfo = $("record-info");

    // --- Réglages (sauvegardés dans le navigateur) ---
    const PRESETS = {
        easy: { size: 9, bombs: 10 },
        medium: { size: 16, bombs: 40 },
        hard: { size: 20, bombs: 70 },
    };
    const MIN_SIZE = 5, MAX_SIZE = 2400;
    const STORAGE_KEY = "demineur";
    const maxBombs = (n) => n * n - 9; // 1er clic + 8 voisines toujours sûrs
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || lo));

    function read() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
    }
    const store = { level: "easy", ...PRESETS.easy, theme: "auto", records: {}, ...read() };
    store.size = clamp(store.size, MIN_SIZE, MAX_SIZE);
    store.bombs = clamp(store.bombs, 1, maxBombs(store.size));

    function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* stockage indisponible */ }
    }

    function applyTheme() {
        if (store.theme === "auto") delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = store.theme;
    }

    const recordKey = () => `${store.size}-${store.bombs}`;

    // --- État privé de la partie (dans la closure, aucune variable globale) ---
    let size, bombs, total;
    let keys, data, revealed, flagged, cells;
    let generated, revealedCount, flags, over, seconds, tick;
    let flagMode = false;

    const MINE = 9;
    const get = (i) => data[i] ^ keys[i];
    const set = (i, v) => { data[i] = v ^ keys[i]; };

    const neighbors = (i) => {
        const r = Math.floor(i / size), c = i % size, out = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (!dr && !dc) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
            }
        }
        return out;
    };

    // Tirage non prédictible (crypto) + mines générées APRÈS le 1er clic :
    // la case cliquée et ses voisines sont toujours sûres.
    function generate(safeIndex) {
        const forbidden = new Set([safeIndex, ...neighbors(safeIndex)]);
        const pool = [];
        for (let i = 0; i < total; i++) if (!forbidden.has(i)) pool.push(i);

        for (let i = pool.length - 1; i > 0; i--) { // Fisher-Yates
            const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const counts = new Uint8Array(total);
        const mines = new Set(pool.slice(0, bombs));
        mines.forEach((m) => neighbors(m).forEach((n) => counts[n]++));
        for (let i = 0; i < total; i++) set(i, mines.has(i) ? MINE : counts[i]);
        generated = true;
    }

    function updateCounter() {
        bombsLeft.textContent = bombs - flags;
    }

    function setFlag(i, on) {
        if (!!flagged[i] === on) return;
        flagged[i] = on ? 1 : 0;
        flags += on ? 1 : -1;
        cells[i].classList.toggle("flag", on);
        cells[i].textContent = on ? "⚑" : "";
        updateCounter();
    }

    function toggleFlag(i) {
        if (over || revealed[i]) return;
        setFlag(i, !flagged[i]);
    }

    // Le DOM ne contient une valeur qu'au moment de sa révélation
    function show(i) {
        if (revealed[i]) return;
        setFlag(i, false);
        revealed[i] = 1;
        const v = get(i);
        cells[i].textContent = v === MINE ? "💣" : v || "";
        cells[i].classList.remove("hidden");
        if (v > 0 && v < MINE) cells[i].classList.add("n" + v);
        if (v !== MINE) revealedCount++;
    }

    function revealAll() {
        for (let i = 0; i < total; i++) show(i);
    }

    function floodReveal(start) {
        const stack = [start];
        while (stack.length) {
            const i = stack.pop();
            if (revealed[i] || flagged[i]) continue;
            show(i);
            if (get(i) === 0) neighbors(i).forEach((n) => { if (!revealed[n]) stack.push(n); });
        }
    }

    function end(won, hitIndex) {
        over = true;
        clearInterval(tick);

        let message;
        if (won) {
            const key = recordKey();
            const best = store.records[key];
            message = `Gagné en ${seconds} s`;
            if (!best || seconds < best) {
                store.records[key] = seconds;
                persist();
                if (best) message += " : nouveau record";
            }
        } else {
            message = "Perdu";
        }
        status.textContent = message;

        if (hitIndex !== undefined) cells[hitIndex].classList.add("boom");
        revealAll();
        if (won) { flags = bombs; updateCounter(); }
    }

    function play(i) {
        if (over || revealed[i] || flagged[i]) return;
        if (!generated) {
            generate(i);
            tick = setInterval(() => { seconds++; timerEl.textContent = seconds; }, 1000);
        }

        if (get(i) === MINE) {
            end(false, i);
            return;
        }
        floodReveal(i);
        if (revealedCount === total - bombs) end(true);
    }

    function newGame() {
        clearInterval(tick);
        size = store.size;
        bombs = store.bombs;
        total = size * size;

        keys = crypto.getRandomValues(new Uint8Array(total)); // masque par case
        data = new Uint8Array(total);                         // valeurs masquées (XOR)
        revealed = new Uint8Array(total);
        flagged = new Uint8Array(total);
        cells = [];
        generated = false;
        revealedCount = 0;
        flags = 0;
        over = false;
        seconds = 0;

        main.replaceChildren();
        main.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        main.style.gridTemplateRows = `repeat(${size}, 1fr)`;
        main.style.setProperty("--n", size);

        status.textContent = "";
        timerEl.textContent = "0";
        updateCounter();

        for (let i = 0; i < total; i++) {
            const cell = document.createElement("div");
            cell.classList.add("hidden"); // vide : aucune valeur dans le DOM
            cell.setAttribute("role", "button");
            cell.addEventListener("click", (e) => {
                if (!e.isTrusted) return; // ignore .click() / dispatchEvent venant de la console
                if (flagMode) toggleFlag(i);
                else play(i);
            });
            cell.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                if (e.isTrusted) toggleFlag(i);
            });
            cells.push(cell);
            main.appendChild(cell);
        }
    }

    // --- Barre d'outils ---
    $("restart").addEventListener("click", newGame);

    flagBtn.addEventListener("click", () => {
        flagMode = !flagMode;
        flagBtn.setAttribute("aria-pressed", flagMode);
    });

    // --- Boîte de réglages ---
    function showRecord() {
        const best = store.records[`${clamp(sizeIn.value, MIN_SIZE, MAX_SIZE)}-${Number(bombsIn.value)}`];
        recordInfo.textContent = best ? `Record pour ce réglage : ${best} s` : "Pas encore de record pour ce réglage.";
    }

    function syncBombsLimit() {
        const n = clamp(sizeIn.value, MIN_SIZE, MAX_SIZE);
        bombsIn.max = maxBombs(n);
    }

    function openSettings() {
        levelSel.value = store.level;
        sizeIn.value = store.size;
        bombsIn.value = store.bombs;
        themeSel.value = store.theme;
        syncBombsLimit();
        showRecord();
        dialog.showModal();
    }

    $("open-settings").addEventListener("click", openSettings);

    levelSel.addEventListener("change", () => {
        const p = PRESETS[levelSel.value];
        if (p) { sizeIn.value = p.size; bombsIn.value = p.bombs; }
        syncBombsLimit();
        showRecord();
    });

    [sizeIn, bombsIn].forEach((input) => input.addEventListener("input", () => {
        levelSel.value = "custom";
        syncBombsLimit();
        showRecord();
    }));

    themeSel.addEventListener("change", () => {
        store.theme = themeSel.value; // aperçu immédiat
        applyTheme();
    });

    $("reset-records").addEventListener("click", () => {
        store.records = {};
        persist();
        showRecord();
    });

    form.addEventListener("submit", (e) => {
        if (e.submitter && e.submitter.value === "apply") {
            const n = clamp(sizeIn.value, MIN_SIZE, MAX_SIZE);
            store.size = n;
            store.bombs = clamp(bombsIn.value, 1, maxBombs(n));
            store.level = levelSel.value;
            store.theme = themeSel.value;
            persist();
            applyTheme();
            newGame();
        } else {
            store.theme = read().theme || "auto"; // annule l'aperçu du thème
            applyTheme();
        }
    });

    // Fermeture par Échap = annulation
    dialog.addEventListener("cancel", () => {
        store.theme = read().theme || "auto";
        applyTheme();
    });

    applyTheme();
    newGame();
})();

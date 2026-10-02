(() => {
    "use strict";

    const main = document.getElementById("main");
    const title = document.getElementsByTagName("h1")[0];
    const size = 9;
    const bombs = 10;
    const total = size * size;

    main.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    main.style.gridTemplateRows = `repeat(${size}, 1fr)`;

    const keys = crypto.getRandomValues(new Uint8Array(total)); // masque par case
    const data = new Uint8Array(total);                         // valeurs masquées (XOR)
    const revealed = new Uint8Array(total);
    const cells = [];
    let generated = false;
    let revealedCount = 0;
    let over = false;

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

    // Le DOM ne contient une valeur qu'au moment de sa révélation
    function show(i) {
        if (revealed[i]) return;
        revealed[i] = 1;
        const v = get(i);
        cells[i].textContent = v === MINE ? "💣" : v;
        cells[i].classList.remove("hidden");
        if (v !== MINE) revealedCount++;
    }

    function revealAll() {
        for (let i = 0; i < total; i++) show(i);
    }

    function floodReveal(start) {
        const stack = [start];
        while (stack.length) {
            const i = stack.pop();
            if (revealed[i]) continue;
            show(i);
            if (get(i) === 0) neighbors(i).forEach((n) => { if (!revealed[n]) stack.push(n); });
        }
    }

    function end(message, delay) {
        over = true;
        title.textContent = message;
        revealAll();
        setTimeout(() => window.location.reload(), delay);
    }

    function play(i) {
        if (over || revealed[i]) return;
        if (!generated) generate(i);

        if (get(i) === MINE) {
            end("You lost!", 2000);
            return;
        }
        floodReveal(i);
        if (revealedCount === total - bombs) end("You win!", 4000);
    }

    for (let i = 0; i < total; i++) {
        const cell = document.createElement("a");
        cell.classList.add("hidden"); // vide : aucune valeur dans le DOM
        cell.addEventListener("click", (e) => {
            if (!e.isTrusted) return; // ignore .click() / dispatchEvent venant de la console
            play(i);
        });
        cells.push(cell);
        main.appendChild(cell);
    }
})();

// Écran titre façon borne d'arcade : la cour du lycée, la nuit
(function () {
  "use strict";

  const ecranTitre = document.getElementById("ecran-titre");
  const cv = document.getElementById("titre-scene");
  const g = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };

  // tirage stable pour que le décor ne bouge pas d'une image à l'autre
  let graine = 7;
  const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
  const etoiles = Array.from({ length: 60 }, () => ({ x: alea() * W, y: alea() * 110, p: alea() * 6 }));
  // deux étages de grandes fenêtres de salles de classe, de part et d'autre du pavillon d'entrée
  const fenetres = [];
  for (let r = 0; r < 2; r++) for (const x0 of [66, 290]) for (let c = 0; c < 5; c++) {
    fenetres.push({ x: x0 + c * 26, y: 116 + r * 32, on: alea() < 0.35, store: Math.floor(alea() * 3) * 4, t: alea() * 100 });
  }
  const gyro = fenetres[17];

  // les élèves qui traversent la cour ; l'un d'eux a une ombre de képi
  const couleurs = ["#2b2f45", "#3a2233", "#22343a", "#3b3426", "#2c2c2c", "#1f2a4a", "#402a22"];
  const passants = couleurs.map((col, i) => ({
    x: alea() * W, y: i % 3 === 2 ? 226 : 208 + (i % 3) * 10, v: (0.25 + alea() * 0.35) * (i % 2 ? 1 : -1),
    col, s: i % 3 === 2 ? 2 : 1, flic: i === 4, capuche: i % 3 === 0,
  }));

  function decor(t) {
    // ciel en bandes
    const bandes = ["#1b2450", "#26336a", "#33427c", "#46588f", "#5d70a3"];
    px(0, 0, W, H, bandes[4]);
    bandes.forEach((c, i) => px(0, i * 30, W, 30, c));
    etoiles.forEach((e) => { if (Math.sin(t / 700 + e.p * 3) > -0.3) px(e.x, e.y, 1, 1, "#c9cbe0"); });
    // croissant de lune
    g.fillStyle = "#e9e2c8"; g.beginPath(); g.arc(52, 36, 11, 0, 7); g.fill();
    g.fillStyle = "#080b18"; g.beginPath(); g.arc(57, 32, 10, 0, 7); g.fill();

    // platane de la cour, à gauche
    px(22, 120, 5, 82, "#1a1612");
    [[4, 92, 44, 30], [12, 80, 30, 16], [0, 108, 50, 18]].forEach(([x, y, w, h]) => px(x, y, w, h, "#16261f"));
    [[10, 96, 8, 6], [30, 86, 6, 5], [36, 112, 8, 5]].forEach(([x, y, w, h]) => px(x, y, w, h, "#1f3329"));

    // le lycée : bâtiment bas en pierre, toit d'ardoise, deux ailes et un pavillon d'entrée
    const pierre = "#1d2238", joint = "#262c48";
    px(56, 104, 368, 98, pierre);
    for (let y = 110; y < 202; y += 8) px(56, y, 368, 1, joint);
    px(56, 140, 368, 3, "#2c3354");           // corniche entre les deux étages
    // toit d'ardoise et cheminées
    for (let i = 0; i < 8; i++) px(60 + i, 96 + i, 360 - i * 2, 1, i % 3 ? "#2a3150" : "#323a5e");
    px(52, 103, 376, 2, "#2c3354");
    px(100, 86, 8, 12, "#252a42"); px(380, 86, 8, 12, "#252a42");
    // pavillon central, plus haut, avec fronton
    px(196, 92, 88, 110, "#232943");
    for (let i = 0; i < 12; i++) px(196 + i * 3.6, 92 - i, 88 - i * 7.2, 1, "#2c3354");
    px(194, 92, 92, 2, "#3a4370");
    // enseigne gravée
    px(200, 98, 80, 13, "#14182b");
    px(200, 98, 80, 1, "#3a4370"); px(200, 110, 80, 1, "#3a4370");
    // horloge
    g.fillStyle = "#e8e2cc"; g.beginPath(); g.arc(240, 124, 7, 0, 7); g.fill();
    g.fillStyle = "#3a4370"; g.beginPath(); g.arc(240, 124, 7, 0, 7); g.lineWidth = 1; g.strokeStyle = "#3a4370"; g.stroke();
    const a = t / 60000;
    px(240, 119, 1, 5, "#14182b");
    px(240 + Math.round(Math.cos(a) * 4), 124 + Math.round(Math.sin(a) * 4), 1, 1, "#14182b");
    px(240 + Math.round(Math.cos(a) * 2), 124 + Math.round(Math.sin(a) * 2), 1, 1, "#14182b");
    // devise de la République, en tout petit
    for (let i = 0; i < 3; i++) px(206 + i * 24, 136, 18, 1, "#4a5280");
    // drapeaux bleu-blanc-rouge et européen, plantés de biais au-dessus de l'entrée
    const vent = Math.floor(t / 400) % 2;
    px(214, 144, 1, 10, "#8a8fa8"); px(265, 144, 1, 10, "#8a8fa8");
    [["#2a4bd8", 0], ["#e8e2cc", 4], ["#e04a3f", 8]].forEach(([c, d]) => px(203 + d - vent, 142, 4, 9 + (d === 8 ? vent : 0), c));
    px(266, 142, 12, 9, "#24439a");
    for (let i = 0; i < 4; i++) px(268 + i * 3, 144 + (i % 2) * 4, 1, 1, "#f2c66b");
    // grande porte en arc
    px(222, 150, 36, 52, "#0e1120");
    g.fillStyle = "#0e1120"; g.beginPath(); g.arc(240, 150, 18, Math.PI, 0); g.fill();
    px(239, 140, 2, 62, "#232943");
    px(226, 160, 10, 1, "#2c3354"); px(244, 160, 10, 1, "#2c3354");

    // fenêtres des salles : petits carreaux, stores à moitié baissés
    fenetres.forEach((f) => {
      let col = "#0b0e1c";
      if (f === gyro) {
        const phase = Math.floor(t / 260) % 8;
        col = phase < 4 ? (phase % 2 ? "#2a4bd8" : "#e04a3f") : "#0b0e1c";
      } else if (f.on && Math.sin(t / 900 + f.t) > -0.85) col = "#f2c66b";
      px(f.x - 1, f.y - 1, 24, 22, "#2c3354");
      px(f.x, f.y, 22, 20, col);
      if (f.store) for (let y = 0; y < f.store; y += 2) px(f.x, f.y + y, 22, 1, "#b8ab88");
      px(f.x + 11, f.y, 1, 20, "#2c3354");
      px(f.x, f.y + 9, 22, 1, "#2c3354");
      px(f.x - 2, f.y + 20, 26, 2, "#323a5e");  // appui de fenêtre
    });

    // sol de la cour
    px(0, 202, W, H - 202, "#10131f");
    for (let x = 0; x < W; x += 24) px(x, 202, 1, H - 202, "#0d1019");
    px(0, 202, W, 1, "#232845");

    // grille et portail, entre deux piliers de pierre
    for (let x = 40; x < 440; x += 6) if (x < 214 || x > 266) {
      px(x, 178, 1, 25, "#2f6b4a");
      px(x - 1, 176, 3, 2, "#3d8c5e");
    }
    px(40, 182, 174, 1, "#2f6b4a"); px(266, 182, 174, 1, "#2f6b4a");
    px(40, 196, 400, 1, "#2f6b4a");
    px(206, 168, 8, 35, "#2c3354"); px(266, 168, 8, 35, "#2c3354");
    px(204, 166, 12, 3, "#3a4370"); px(264, 166, 12, 3, "#3a4370");

    // panier de basket au bout de la cour
    px(452, 150, 2, 52, "#2a2d3a");
    px(440, 146, 16, 12, "#cfd3e0"); px(444, 150, 8, 5, "#cfd3e0");
    px(445, 150, 6, 4, "#10131f");
    px(442, 158, 10, 1, "#e07a3a");

    // lampadaire au sodium
    const vacille = Math.sin(t / 90) > 0.97 ? 0.35 : 1;
    const halo = g.createRadialGradient(408, 118, 2, 408, 118, 120);
    halo.addColorStop(0, `rgba(242,163,58,${0.38 * vacille})`);
    halo.addColorStop(1, "rgba(242,163,58,0)");
    g.fillStyle = halo; g.fillRect(288, 0, 192, H);
    px(409, 112, 2, 110, "#2a2d3a");
    px(398, 110, 14, 3, "#2a2d3a");
    px(398, 113, 8, 2, vacille > 0.5 ? "#ffd38a" : "#6b4a20");
  }

  function passant(p, t) {
    const s = p.s, x = p.x, y = p.y;
    const pas = Math.floor(t / 180 + x) % 2;
    const sombre = "#07090f";
    // ombre au sol, étirée par le lampadaire
    g.fillStyle = "rgba(0,0,0,.45)";
    g.fillRect(x - 2 * s, y + 18 * s, 12 * s, 2 * s);
    if (p.flic) {
      // l'ombre trahit le képi
      px(x + 9 * s, y + 16 * s, 6 * s, 2 * s, "rgba(0,0,0,.55)");
      px(x + 15 * s, y + 17 * s, 2 * s, 1 * s, "rgba(0,0,0,.55)");
    }
    // jambes
    px(x + 1 * s, y + 12 * s, 2 * s, 6 * s - (pas ? 1 : 0) * s, sombre);
    px(x + 4 * s, y + 12 * s, 2 * s, 6 * s - (pas ? 0 : 1) * s, sombre);
    // corps et tête
    px(x, y + 5 * s, 7 * s, 8 * s, p.col);
    px(x + 1 * s, y, 5 * s, 5 * s, p.capuche ? p.col : "#2a1f1a");
    if (!p.capuche) px(x + 2 * s, y + 2 * s, 3 * s, 3 * s, "#8a6a55");
    // reflet bleu-rouge quand il passe sous la fenêtre qui clignote
    if (p.flic && Math.abs(x - gyro.x) < 40 && Math.floor(t / 260) % 8 < 4) {
      px(x, y + 5 * s, 1 * s, 8 * s, Math.floor(t / 260) % 2 ? "#2a4bd8" : "#e04a3f");
    }
  }

  function image(t) {
    decor(t);
    passants.sort((a, b) => a.y - b.y).forEach((p) => {
      if (!calme) {
        p.x += p.v;
        if (p.x > W + 20) p.x = -20;
        if (p.x < -20) p.x = W + 20;
      }
      passant(p, t);
    });
  }

  let anim = 0;
  function boucle(t) {
    image(t);
    anim = requestAnimationFrame(boucle);
  }
  if (calme) image(0);
  else anim = requestAnimationFrame(boucle);

  function piece() {
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      const ctx = window.__AC || (window.__AC = new A());
      if (ctx.state === "suspended") ctx.resume();
      [[988, 0], [1319, 0.08]].forEach(([f, d]) => {
        const o = ctx.createOscillator(), v = ctx.createGain();
        o.type = "square"; o.frequency.value = f; v.gain.value = 0.05;
        o.connect(v); v.connect(ctx.destination);
        o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + (d ? 0.35 : 0.08));
      });
    } catch (e) { /* pas de son */ }
  }

  function inserer() {
    if (ecranTitre.hidden) return;
    piece();
    document.getElementById("titre-credit").textContent = "CRÉDIT 01";
    ecranTitre.classList.add("lance");
    setTimeout(() => {
      cancelAnimationFrame(anim);
      ecranTitre.hidden = true;
      document.getElementById("ecran-regles").hidden = false;
      window.scrollTo(0, 0);
    }, calme ? 0 : 700);
  }

  const bouton = document.getElementById("btn-inserer");
  if (matchMedia("(pointer: coarse)").matches) bouton.textContent = "Touche pour jouer";
  bouton.addEventListener("click", inserer);
  cv.addEventListener("click", inserer);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !ecranTitre.hidden) { e.preventDefault(); inserer(); }
  });
})();

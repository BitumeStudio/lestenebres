// Bismillah c'est les ténèbres : moteur du jeu (JavaScript pur, données en JSON)
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  let cfg = null;      // data/jeu.json
  let jour = null;     // data/jourN.json
  let S = null;        // état de la partie
  let SEM = { trouves: 0, total: 0, erreurs: 0 };  // bilan cumulé de la semaine

  // ---------- Tirage au sort des identités ----------
  // Les prénoms des élèves sont fixes : les textes utilisent des {id} résolus ici.
  const ELEVES = {
    f: ["sarah", "chloe", "jade", "manon", "nina", "anais", "lea"],
    m: ["kenzo", "yanis", "dylan", "moussa", "lucas", "samy", "theo", "rayan", "nolan", "leo", "hugo", "malik"],
  };
  const PRENOMS = {
    f: ["Sarah", "Chloé", "Jade", "Manon", "Nina", "Anaïs", "Léa", "Camille", "Yasmine", "Maëlle", "Fatou", "Louna", "Zoé", "Amira", "Eva", "Ambre"],
    m: ["Kenzo", "Yanis", "Dylan", "Moussa", "Lucas", "Samy", "Théo", "Rayan", "Nolan", "Léo", "Hugo", "Malik", "Enzo", "Ilyes", "Noah", "Mehdi", "Axel", "Eliott", "Sofiane", "Tidiane", "Alexis", "Ousmane"],
  };
  let CAST = {};

  function prng(graine) {
    let a = graine >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // distribution fixe : chaque élève garde son prénom d'origine, la même à chaque partie
  function distribuerPrenoms() {
    const cast = {};
    ["f", "m"].forEach((g) => ELEVES[g].forEach((id, i) => { cast[id] = PRENOMS[g][i]; }));
    return cast;
  }

  // remplace {id} par le prénom tiré au sort, et élide « de / que » devant une voyelle
  function gabarit(txt) {
    return txt
      .replace(/\{(\w+)\}/g, (m, id) => CAST[id] || m)
      .replace(/\b([dD])e ([AEIOUÀÂÉÈÊÎÔÛ])/g, "$1'$2")
      .replace(/\b([qQ])ue ([AEIOUÀÂÉÈÊÎÔÛ])/g, "$1u'$2");
  }

  function appliquerPrenoms(o) {
    if (typeof o === "string") return o.includes("{") ? gabarit(o) : o;
    if (Array.isArray(o)) return o.map(appliquerPrenoms);
    if (o && typeof o === "object") {
      const r = {};
      Object.keys(o).forEach((k) => { r[k] = appliquerPrenoms(o[k]); });
      return r;
    }
    return o;
  }

  // Rôles fixes : dans chaque groupe à double rôle, les premiers de la liste sont les vrais flics.
  // Les réponses des autres personnages qui en parlent s'adaptent (champ « si » sur les questions).
  function appliquerTirage(j) {
    const roles = {};
    (j.tirage || []).forEach((t) => {
      t.groupe.forEach((id, k) => { roles[id] = k < t.nb ? "flic" : "innocent"; });
    });
    j.pnj.forEach((p) => {
      if (!p.roles) return;
      const r = roles[p.id] || "innocent";
      Object.assign(p, p.roles[r]);
      p.infiltre = r === "flic";
      delete p.roles;
    });
    j.pnj.forEach((p) => {
      p.questions = p.questions.filter((q) => !q.si || Object.keys(q.si).every((id) => roles[id] === q.si[id]));
    });
    j.tirageRoles = roles;
  }

  // ---------- Portraits pixel (48 x 48) ----------
  function teinte(hex, k) {
    // k > 0 éclaircit, k < 0 assombrit
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function portrait(sprite, taille, masque) {
    const T = 48;
    const c = document.createElement("canvas");
    c.width = c.height = T;
    c.style.width = c.style.height = taille + "px";
    c.className = "portrait" + (taille < 40 ? " mini" : "");
    const g = c.getContext("2d");
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // ellipse pixelisée, éventuellement coupée en hauteur
    const ovale = (cx, cy, rx, ry, col, yMin = -1, yMax = T) => {
      g.fillStyle = col;
      for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
        if (y < yMin || y > yMax) continue;
        const d = rx * Math.sqrt(Math.max(0, 1 - ((y + 0.5 - cy) / ry) ** 2));
        const x0 = Math.round(cx - d), x1 = Math.round(cx + d);
        if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
      }
    };
    const peau = sprite.peau, ch = sprite.couleurCheveux, haut = sprite.haut;
    const acc = sprite.accessoires || [];
    const contour = "#07090f";
    const peauOmbre = teinte(peau, -0.22), peauLum = teinte(peau, 0.14);
    const chLum = teinte(ch, 0.25), hautOmbre = teinte(haut, -0.3), hautLum = teinte(haut, 0.15);
    const capuche = sprite.cheveux === "capuche" ? (haut === "#111111" ? "#23252e" : haut) : null;

    // fond : mur de la cour
    px(0, 0, T, T, "#1e2440");
    px(0, 30, T, 18, "#191e36");
    for (let x = 0; x < T; x += 8) px(x, 30, 1, 18, "#161a30");

    // arrière : cheveux longs ou capuche
    if (sprite.cheveux === "long") { ovale(24, 22, 13, 14, contour); px(10, 22, 28, 16, contour); ovale(24, 22, 12, 13, ch); px(11, 22, 26, 15, ch); }
    if (capuche) { ovale(24, 22, 16, 18, contour); ovale(24, 22, 15, 17, capuche); }

    // buste
    const buste = (col, d) => {
      px(10 - d, 36 - d, 28 + 2 * d, 1, col); px(7 - d, 37 - d, 34 + 2 * d, 1, col);
      px(5 - d, 38 - d, 38 + 2 * d, 10 + d, col);
    };
    buste(contour, 1); buste(haut, 0);
    px(5, 38, 4, 10, hautLum); px(37, 38, 6, 10, hautOmbre);
    px(16, 44, 1, 4, hautOmbre); px(31, 44, 1, 4, hautOmbre);
    if (capuche) { px(19, 38, 1, 7, "#d9d9d9"); px(28, 38, 1, 7, "#d9d9d9"); }

    // cou
    px(19, 29, 10, 9, contour); px(20, 29, 8, 9, peau); px(20, 29, 8, 3, peauOmbre);
    px(18, 36, 12, 1, hautOmbre);

    // oreilles et tête
    px(12, 18, 4, 7, contour); px(32, 18, 4, 7, contour);
    px(13, 19, 3, 5, peau); px(32, 19, 3, 5, peauOmbre);
    ovale(24, 19.5, 11, 12.5, contour);
    ovale(24, 19.5, 10, 11.5, peau);
    ovale(29, 21, 4.5, 8, peauOmbre, 12, 30);
    ovale(24, 19.5, 10, 11.5, "rgba(0,0,0,0)");
    px(16, 14, 2, 8, peauLum);

    // visage
    const sourcil = teinte(ch, -0.1);
    px(17, 17, 5, 1, sourcil); px(26, 17, 5, 1, sourcil);
    px(18, 19, 4, 3, "#f4efe6"); px(26, 19, 4, 3, "#f4efe6");
    px(19, 19, 2, 3, "#2a1a12"); px(27, 19, 2, 3, "#2a1a12");
    px(19, 19, 1, 1, "#ffffff"); px(27, 19, 1, 1, "#ffffff");
    px(24, 21, 1, 4, peauOmbre); px(23, 25, 3, 1, peauOmbre);
    px(21, 28, 6, 1, teinte(peau, -0.45)); px(22, 29, 4, 1, peauOmbre);
    px(17, 24, 2, 1, "rgba(220,90,80,.18)"); px(29, 24, 2, 1, "rgba(220,90,80,.18)");

    // coiffures
    const calotte = (rx, ry, yMax, col) => { ovale(24, 15, rx + 1, ry + 1, contour, -1, yMax + 1); ovale(24, 15, rx, ry, col, -1, yMax); };
    switch (sprite.cheveux) {
      case "court":
        calotte(11, 9, 13, ch); px(13, 13, 3, 6, ch); px(32, 13, 3, 6, ch);
        px(17, 8, 9, 1, chLum); px(15, 10, 3, 1, chLum); break;
      case "long":
        calotte(11, 9, 13, ch); px(13, 12, 4, 22, ch); px(31, 12, 4, 22, ch);
        px(18, 7, 8, 1, chLum); px(14, 16, 1, 12, chLum); break;
      case "boucle":
        calotte(13, 11, 14, ch);
        for (let x = 12; x <= 36; x += 4) { ovale(x, 6 + ((x / 4) % 2) * 2, 2.6, 2.6, ch); px(x - 1, 5 + ((x / 4) % 2) * 2, 1, 1, chLum); }
        px(12, 14, 4, 6, ch); px(32, 14, 4, 6, ch); break;
      case "chignon":
        ovale(24, 5, 6, 5, contour); ovale(24, 5, 5, 4, ch); px(22, 3, 3, 1, chLum);
        calotte(11, 9, 12, ch); px(13, 12, 3, 5, ch); px(32, 12, 3, 5, ch); px(19, 8, 8, 1, chLum); break;
      case "rase":
        ovale(24, 15, 10.5, 9, teinte(ch, 0.05), -1, 11); px(14, 12, 2, 4, teinte(ch, 0.05)); px(32, 12, 2, 4, teinte(ch, 0.05)); break;
      case "casquette": {
        const k = "#2b2f3a";
        px(13, 12, 3, 6, ch); px(32, 12, 3, 6, ch);
        calotte(11.5, 10, 13, k); px(12, 12, 24, 2, teinte(k, -0.3));
        px(34, 9, 8, 3, contour); px(35, 10, 6, 1, teinte(k, 0.1));
        px(21, 12, 6, 2, "#454b5c"); px(18, 7, 6, 1, teinte(k, 0.2)); break;
      }
      case "capuche":
        calotte(13, 10, 12, capuche);
        px(11, 12, 4, 22, capuche); px(33, 12, 4, 22, capuche);
        px(14, 12, 2, 20, teinte(capuche, -0.4)); px(32, 12, 2, 20, teinte(capuche, -0.4));
        px(16, 12, 16, 2, ch); px(18, 7, 10, 1, teinte(capuche, 0.15)); break;
    }

    // accessoires
    if (acc.includes("lunettes")) {
      const m = "#0a0a0a";
      [[16, 17], [25, 17]].forEach(([x, y]) => { px(x, y, 8, 1, m); px(x, y + 6, 8, 1, m); px(x, y, 1, 7, m); px(x + 7, y, 1, 7, m); px(x + 1, y + 1, 2, 1, "rgba(160,210,255,.5)"); });
      px(23, 19, 3, 1, m);
    }
    if (acc.includes("boucles")) { px(13, 25, 2, 2, "#f2c14e"); px(13, 27, 1, 2, "#b8892a"); px(33, 25, 2, 2, "#f2c14e"); px(34, 27, 1, 2, "#b8892a"); }
    if (acc.includes("oreillette")) { px(33, 20, 3, 3, "#ffffff"); px(34, 23, 1, 3, "#e6e6e6"); px(35, 20, 1, 1, "#c9c9c9"); }
    if (acc.includes("vape")) {
      px(37, 30, 6, 16, contour); px(38, 31, 4, 14, "#8a8fa8"); px(38, 31, 1, 14, "#b9bdd0");
      px(39, 26, 2, 5, "#2b2f3a"); px(38, 25, 4, 2, "rgba(200,230,255,.55)");
      px(39, 36, 2, 2, "#5be3ff");
    }

    if (masque) {
      // bandeau « démasqué » : la carte tricolore
      px(0, 39, T, 9, contour);
      px(6, 40, 12, 7, "#2a4bd8"); px(18, 40, 12, 7, "#f4f1ea"); px(30, 40, 12, 7, "#d8433b");
    }
    return c;
  }

  // ---------- Utilitaires d'état ----------
  const pnj = (id) => jour.pnj.find((p) => p.id === id);
  const indice = (id) => jour.indices[id];
  // classement choisi par le joueur : "suspect", "alibi" ou "?" (à vérifier)
  const classe = (i) => S.classe[i] || "?";
  const notesSur = (id) => [...S.indices].filter((i) => indice(i).sur === id);
  const marques = (id, c) => notesSur(id).filter((i) => classe(i) === c);
  // une vraie preuve : un indice réellement suspect, que le joueur a classé suspect
  const preuves = (id) => marques(id, "suspect").filter((i) => indice(i).type === "suspect").length;

  // Toute observation et toute réponse s'écrit au carnet. Sans indice écrit à la main, la note reprend ce qui a été dit :
  // c'est une note neutre (type « info »), que le joueur peut quand même classer.
  function resume(txt) {
    const t = txt.replace(/\s+/g, " ").trim();
    if (t.length <= 150) return t;
    const coupe = t.slice(0, 150);
    const fin = Math.max(coupe.lastIndexOf(". "), coupe.lastIndexOf("? "), coupe.lastIndexOf("! "));
    return fin > 60 ? coupe.slice(0, fin + 1) : coupe.replace(/\s\S*$/, "") + "…";
  }

  function notesAuto(j) {
    j.pnj.forEach((p) => {
      if (!p.observer.indice) {
        p.observer.indice = "auto_" + p.id + "_obs";
        j.indices[p.observer.indice] = { texte: p.nom + " : " + resume(p.observer.texte), type: "info", sur: p.id };
      }
      p.questions.forEach((q) => {
        if (q.indice || q.gratuit) return;
        q.indice = "auto_" + p.id + "_" + q.id;
        j.indices[q.indice] = { texte: p.nom + " : " + resume(q.r), type: "info", sur: p.id };
      });
    });
  }

  function heure() {
    const m = Math.round(jour.heureDebut * 60 + (jour.actions - S.actions) * jour.minutesParAction);
    return String(Math.floor(m / 60)).padStart(2, "0") + "h" + String(m % 60).padStart(2, "0");
  }

  // poser la question ou faire l'action inscrit la réponse au carnet, sans autre geste
  function gagnerIndice(id, source) {
    if (!id || S.indices.has(id)) return;
    S.sources[id] = source;
    S.indices.add(id);
    dire(source, "note", "Noté au carnet : " + indice(id).texte);
    renderCarnet();
  }

  function depenser(n) {
    if (!n) return;
    S.actions = Math.max(0, S.actions - n);
    renderHud();
    if (S.actions === 0) sonnerie();
  }

  // ---------- Sons (synthétisés, aucun fichier) ----------
  const SON = (() => {
    let ctx = null, actif = true;
    try { actif = localStorage.getItem("bt-son") !== "0"; } catch (e) { /* tant pis */ }
    const C = () => {
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    };
    // note : fréquence, durée, forme, volume, retard, fréquence finale
    function note(f, d, type, vol, t0, fin) {
      const c = actif && C();
      if (!c) return;
      try {
        const t = c.currentTime + (t0 || 0);
        const o = c.createOscillator(), g = c.createGain();
        o.type = type || "square";
        o.frequency.setValueAtTime(f, t);
        if (fin) o.frequency.linearRampToValueAtTime(fin, t + d);
        g.gain.setValueAtTime(vol || 0.04, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(c.destination);
        o.start(t); o.stop(t + d + 0.03);
      } catch (e) { /* pas de son, tant pis */ }
    }
    return {
      get actif() { return actif; },
      basculer() {
        actif = !actif;
        try { localStorage.setItem("bt-son", actif ? "1" : "0"); } catch (e) { /* tant pis */ }
        if (actif) this.clic();
        return actif;
      },
      clic() { note(520, 0.05, "square", 0.035); },
      retour() { note(380, 0.06, "square", 0.03); },
      choisir() { note(440, 0.05, "square", 0.035); note(660, 0.07, "square", 0.035, 0.05); },
      carnet() { note(300, 0.12, "triangle", 0.05, 0, 520); },
      debut() { [262, 330, 392, 523].forEach((f, k) => note(f, 0.09, "square", 0.04, k * 0.09)); note(784, 0.28, "square", 0.04, 0.38); },
      fin() { [784, 659, 523, 392].forEach((f, k) => note(f, 0.1, "square", 0.04, k * 0.1)); note(262, 0.12, "square", 0.04, 0.42); note(196, 0.3, "square", 0.04, 0.55); },
      verdict(n) { n ? (note(262, 0.12, "square", 0.04), note(330, 0.12, "square", 0.04, 0.12), note(392, 0.25, "square", 0.04, 0.24)) : note(220, 0.3, "triangle", 0.05, 0, 160); },
    };
  })();
  const sonnerie = () => SON.fin();

  // ---------- Affichage ----------
  function ecran(id) {
    document.querySelectorAll(".ecran").forEach((e) => (e.hidden = e.id !== id));
    window.scrollTo(0, 0);
  }


  // ---------- Comment jouer ----------
  const REGLES = [
    ["Ta mission", [
      "Des policiers et des élèves retournés se sont glissés parmi vous pour savoir qui organise le blocus de vendredi.",
      "Chaque jour, de lundi à vendredi, tu dois les démasquer sans accuser un innocent."], "Fiction : les personnages, le lycée et les événements sont inventés."],
    ["Enquêter", [
      "Déplace-toi dans le lycée, choisis quelqu'un, puis observe-le ou pose-lui une question.",
      "Chaque observation ou question coûte une action et fait avancer l'horloge. La journée s'arrête quand tu n'as plus d'actions, ou quand tu termines la journée."], "Tu ne peux pas tout faire : choisis qui interroger."],
    ["Le carnet", [
      "Chaque réponse s'écrit dans ton carnet. C'est toi qui classes chaque note : Suspect, Alibi ou À vérifier.",
      "Cherche ce qui cloche : un détail, une réponse qui contredit celle d'un autre élève."], "Une fausse piste classée « suspect » ne compte pas comme preuve."],
    ["La fin de journée", [
      "En fin de journée, tu désignes ceux que tu penses infiltrés. Il faut au moins " + (cfg && cfg.preuvesRequises || 2) + " vraies preuves classées suspectes pour convaincre le groupe.",
      "Démasquer un infiltré fait monter la confiance du lycée. Accuser sans preuve, accuser un innocent ou laisser filer un infiltré la fait baisser. À 0, tu es exclu."], "Pas sûr de toi ? N'accuse personne."],
  ];
  let regleI = 0, regleRetour = "ecran-intro";
  function renderRegle() {
    const [titre, paras, astuce] = REGLES[regleI];
    const c = $("#regle-carte");
    c.innerHTML = "";
    c.append(el("h2", null, titre));
    paras.forEach((t) => c.append(el("p", null, t)));
    c.append(el("p", "astuce", astuce));
    $("#regle-num").textContent = regleI + 1;
    const pts = $("#regle-points");
    pts.innerHTML = "";
    REGLES.forEach((_, i) => pts.append(el("i", i === regleI ? "on" : "")));
    $("#btn-regle-suivant").textContent = regleI === REGLES.length - 1 ? (regleRetour === "ecran-jeu" ? "Reprendre" : "Compris, c'est parti") : "Suivant";
  }
  function ouvrirRegles(retour) {
    regleI = 0; regleRetour = retour || "ecran-intro";
    renderRegle();
    ecran("ecran-regles");
  }

  function renderHud() {
    $("#hud-heure").textContent = heure();
    $("#hud-actions").textContent = S.actions;
    $("#hud-confiance").style.width = S.confiance + "%";
    $("#hud-confiance-val").textContent = S.confiance;
    $("#hud-jour").textContent = "Jour " + jour.jour;
    const fini = S.actions <= 0;
    $("#hud-actions").parentElement.classList.toggle("urgent", S.actions <= 3);
    $("#btn-soir").classList.toggle("pulse", fini);
    // le dernier jour se joue avant l'aube : les textes de fin de journée viennent alors des données
    const T = jour.textesFin || {};
    $("#btn-soir").textContent = fini ? (T.boutonFini || "La sonnerie a retenti : terminer la journée") : (T.bouton || "Terminer la journée");
  }

  function nbEleves(zone) {
    const n = jour.pnj.filter((p) => p.zone === zone).length;
    return n + (n > 1 ? " élèves" : " élève");
  }

  function renderZones() {
    const nav = $("#zones");
    nav.innerHTML = "";
    jour.zones.forEach((z) => {
      const b = el("button", "zone" + (z.id === S.zone ? " active" : ""));
      b.type = "button";
      b.append(el("span", "zone-nom", z.nom));
      b.append(el("span", "zone-nb", nbEleves(z.id)));
      b.onclick = () => { S.zone = z.id; S.cible = null; renderZones(); renderScene(); };
      nav.append(b);
    });
  }

  function renderScene() {
    const z = jour.zones.find((x) => x.id === S.zone);
    $("#scene-nom").textContent = z.nom;
    $("#scene-decor").textContent = z.decor;
    $("#scene").dataset.zone = z.id;
    const liste = $("#scene-pnj");
    liste.innerHTML = "";
    jour.pnj.filter((p) => p.zone === z.id).forEach((p) => {
      const b = el("button", "carte" + (S.cible === p.id ? " active" : ""));
      b.type = "button";
      b.dataset.id = p.id;
      b.append(portrait(p.sprite, 72));
      const txt = el("span", "carte-txt");
      txt.append(el("strong", null, p.nom + (p.allie ? " · ta pote" : "")));
      txt.append(el("span", "carte-posture", p.posture));
      const n = notesSur(p.id).length;
      if (n) txt.append(el("span", "tag neutre", n + " note" + (n > 1 ? "s" : "") + " au carnet"));
      b.append(txt);
      b.onclick = () => {
        S.cible = p.id;
        renderScene();
        if (matchMedia("(max-width: 980px)").matches) $("#dialogue").scrollIntoView({ behavior: "smooth", block: "start" });
      };
      liste.append(b);
    });
    renderDialogue();
  }

  function renderDialogue() {
    const box = $("#dialogue");
    box.innerHTML = "";
    if (!S.cible) {
      box.append(el("p", "vide", "Choisis quelqu'un dans la scène pour l'observer ou lui parler."));
      return;
    }
    const p = pnj(S.cible);
    const tete = el("div", "dia-tete");
    tete.append(portrait(p.sprite, 120));
    const nom = el("div");
    nom.append(el("h3", null, p.nom));
    nom.append(el("p", "carte-posture", p.posture));
    tete.append(nom);
    box.append(tete);

    const log = el("div", "dia-log");
    (S.log[p.id] || []).forEach((l) => {
      const ligne = el("p", l.qui === "toi" ? "ligne toi" : l.qui === "note" ? "ligne note-carnet" : "ligne eux");
      ligne.textContent = l.qui === "toi" ? "Toi : " + l.txt : l.txt;
      log.append(ligne);
    });
    box.append(log);

    const choix = el("div", "dia-choix");
    const plusDeTemps = S.actions <= 0;
    const obsKey = p.id + ":obs";
    if (!S.faits.has(obsKey)) {
      choix.append(bouton("Observer de loin", "1 action", plusDeTemps, () => {
        S.faits.add(obsKey);
        depenser(1);
        dire(p.id, "eux", "[Tu observes] " + p.observer.texte);
        gagnerIndice(p.observer.indice, p.id);
        (p.observer.aussi || []).forEach((i) => gagnerIndice(i, p.id));
        renderScene();
      }));
    }
    const refus = refuse(p);
    if (refus) choix.append(el("p", "refus", refus));
    else p.questions.forEach((q) => {
      const k = p.id + ":" + q.id;
      if (S.faits.has(k)) return;
      if (q.requiert && !S.indices.has(q.requiert)) return;
      if (q.apres && !q.apres.every((id) => S.faits.has(id.includes(":") ? id : p.id + ":" + id))) return;
      const cout = q.gratuit ? 0 : 1;
      choix.append(bouton("« " + q.q + " »", cout ? "1 action" : "gratuit", plusDeTemps && cout > 0, () => {
        S.faits.add(k);
        depenser(cout);
        dire(p.id, "toi", q.q);
        dire(p.id, "eux", p.nom + " : " + q.r);
        gagnerIndice(q.indice, p.id);
        (q.aussi || []).forEach((i) => gagnerIndice(i, p.id));
        renderScene();
      }, ""));
    });
    if (!choix.children.length) choix.append(el("p", "vide", "Tu as fait le tour. Rien de plus à tirer de " + p.nom + " aujourd'hui."));
    else if (plusDeTemps) choix.append(el("p", "vide", ((jour.textesFin || {}).plusDeTemps || "La sonnerie a retenti à {heure}. La journée est finie : tu peux la terminer.").replace("{heure}", heure())));
    else if (S.actions <= 3) choix.append(el("p", "vide alerte", "Plus que " + S.actions + " action" + (S.actions > 1 ? "s" : "") + " avant la sonnerie."));
    box.append(choix);
    log.scrollTop = log.scrollHeight;
  }

  // la confiance du lycée se mérite : trop basse, on te ferme la porte
  function refuse(p) {
    if (p.allie && S.confiance < cfg.seuilAllie) return p.nom + " détourne les yeux. « Je t'ai fait confiance. Plus maintenant. »";
    if (p.reserve && S.confiance < cfg.seuilReserve) return "« Pourquoi je te répondrais, toi ? » " + p.nom + " te tourne le dos.";
    return "";
  }

  function bouton(label, cout, desactive, fn, extra) {
    const b = el("button", "choix " + (extra || ""));
    b.type = "button";
    b.disabled = !!desactive;
    b.append(el("span", null, label));
    b.append(el("span", "cout", cout));
    b.onclick = fn;
    return b;
  }

  function dire(id, qui, txt) {
    (S.log[id] = S.log[id] || []).push({ qui, txt });
  }

  function renderCarnet() {
    const c = $("#carnet-liste");
    c.innerHTML = "";
    $("#carnet-nb").textContent = S.indices.size;
    if (!S.indices.size) {
      c.append(el("p", "vide", "Vide pour l'instant. Observe et pose des questions : ce que tu apprends s'écrit ici."));
      return;
    }
    // chaque note se classe : elle va sous le nom de qui l'a donnée ou de qui elle concerne
    const de = (i) => indice(i).sur || S.sources[i];
    const sansNom = [...S.indices].filter((i) => !jour.pnj.some((p) => p.id === de(i)));
    if (sansNom.length) {
      const g = el("div", "groupe");
      g.append(el("h4", null, "Ce qu'on sait"));
      sansNom.forEach((i) => g.append(noteClassable(i)));
      c.append(g);
    }
    jour.pnj.forEach((p) => {
      const lst = [...S.indices].filter((i) => de(i) === p.id);
      if (!lst.length) return;
      const g = el("div", "groupe");
      const h = el("h4");
      h.append(portrait(p.sprite, 24));
      h.append(document.createTextNode(p.nom));
      g.append(h);
      lst.forEach((i) => g.append(noteClassable(i)));
      c.append(g);
    });
  }

  function noteClassable(i) {
    const n = el("div", "note classee-" + (classe(i) === "?" ? "verifier" : classe(i)));
    n.dataset.id = i;
    n.append(el("p", null, indice(i).texte));
    const rang = el("div", "classer");
    [["suspect", "Suspect"], ["alibi", "Alibi"], ["?", "À vérifier"]].forEach(([v, lib]) => {
      const b = el("button", classe(i) === v ? "on" : "", lib);
      b.type = "button";
      b.setAttribute("aria-pressed", classe(i) === v);
      b.onclick = () => { S.classe[i] = v; renderCarnet(); if (!$("#ecran-jeu").hidden) renderScene(); };
      rang.append(b);
    });
    n.append(rang);
    return n;
  }

  // ---------- Soir : accusation ----------
  function soir() {
    S.accuses = new Set();
    ecran("ecran-soir");
    renderSoir();
  }

  function renderSoir() {
    const grille = $("#soir-grille");
    grille.innerHTML = "";
    jour.pnj.filter((p) => !p.allie).forEach((p) => {
      const b = el("button", "suspect-carte" + (S.accuses.has(p.id) ? " choisi" : ""));
      b.type = "button";
      b.dataset.id = p.id;
      b.setAttribute("aria-pressed", S.accuses.has(p.id));
      b.append(portrait(p.sprite, 72));
      b.append(el("strong", null, p.nom));
      const s = marques(p.id, "suspect").length, inn = marques(p.id, "alibi").length;
      b.append(el("span", "tag " + (s ? "suspect" : "neutre"), s + " suspect" + (s > 1 ? "s" : "")));
      if (inn) b.append(el("span", "tag innocent", inn + " alibi" + (inn > 1 ? "s" : "")));
      b.onclick = () => {
        S.accuses.has(p.id) ? S.accuses.delete(p.id) : S.accuses.add(p.id);
        renderSoir();
      };
      grille.append(b);
    });
    const n = S.accuses.size;
    $("#btn-accuser").textContent = n ? "Démasquer " + n + " personne" + (n > 1 ? "s" : "") : "N'accuser personne";
    $("#soir-rappel").textContent = "Les chiffres viennent de ton classement dans le carnet. Il faut au moins " + cfg.preuvesRequises + " vraies preuves pour convaincre le groupe, et une fausse piste ne compte pas. " + (jour.annonce || "Le message parlait de " + jour.nbInfiltres + " infiltrés.");
  }

  function bilan() {
    const res = [];
    let delta = 0;
    let trouves = 0, erreurs = 0;
    const E = cfg.effets;
    jour.pnj.filter((p) => !p.allie).forEach((p) => {
      const accuse = S.accuses.has(p.id);
      if (p.infiltre && accuse && preuves(p.id) >= cfg.preuvesRequises) {
        res.push({ p, cas: "demasque", txt: p.fin.demasque, d: E.demasque }); trouves++;
      } else if (p.infiltre && accuse) {
        res.push({ p, cas: "sansPreuve", txt: p.fin.sansPreuve, d: E.sansPreuve }); S.rates.push(p.id);
      } else if (p.infiltre) {
        res.push({ p, cas: "rate", txt: p.fin.rate, d: E.rate }); S.rates.push(p.id);
      } else if (accuse) {
        res.push({ p, cas: "accuseATort", txt: p.fin.accuseATort, d: E.accuseATort }); erreurs++;
      }
    });
    res.forEach((r) => (delta += r.d));
    const jourSuivant = cfg.jours.find((j) => j.numero === jour.jour + 1);
    // la méfiance ne grandit la nuit que si un infiltré est encore dans la cour
    const nuit = jourSuivant && jourSuivant.fichier && trouves < jour.nbInfiltres ? cfg.peurNuit : 0;
    delta -= nuit;
    const avant = S.confiance;
    S.confiance = Math.max(0, Math.min(100, S.confiance + delta));
    const exclu = S.confiance <= 0;
    SEM.trouves += trouves; SEM.erreurs += erreurs; SEM.total += jour.nbInfiltres;

    // on ne dit jamais qui a échappé : ils reviennent demain, ou la partie se rejoue autrement
    const secret = true;
    const box = $("#bilan-liste");
    box.innerHTML = "";
    const etiquettes = { demasque: "Démasqué", sansPreuve: "Accusé sans preuve", rate: "Passé inaperçu", accuseATort: "Accusé à tort" };
    const echappes = secret ? res.filter((r) => r.cas === "rate") : [];
    res.filter((r) => !echappes.includes(r)).forEach((r, i) => {
      const cache = secret && r.cas === "sansPreuve";
      const art = el("article", "verdict " + r.cas);
      art.style.animationDelay = i * 0.25 + "s";
      art.append(portrait(r.p.sprite, 96, r.cas === "demasque"));
      const t = el("div");
      const h = el("h3", null, r.p.nom + " · " + (cache ? "Pas assez de preuves" : etiquettes[r.cas]));
      t.append(h);
      if (r.p.infiltre && !cache) t.append(el("p", "grade", "En vrai : " + r.p.grade));
      t.append(el("p", null, r.txt));
      const retenus = marques(r.p.id, "suspect");
      if (S.accuses.has(r.p.id) && retenus.length && !cache) {
        const ul = el("ul", "preuves");
        retenus.forEach((i) => {
          const vraie = r.p.infiltre && indice(i).type === "suspect";
          ul.append(el("li", vraie ? "vraie" : "fausse", (vraie ? "Preuve : " : "Fausse piste : ") + indice(i).texte));
        });
        t.append(ul);
      }
      t.append(el("p", "delta", "Confiance " + (r.d > 0 ? "+" : "") + r.d));
      art.append(t);
      box.append(art);
    });

    if (echappes.length) {
      const fuite = el("p", "verdict nuit");
      const d = echappes.reduce((a, r) => a + r.d, 0);
      fuite.append(el("p", null, "Quelqu'un t'a échappé aujourd'hui. Tu ne sais pas qui. Confiance −" + -d + (nuit ? ", puis −" + nuit + " dans la nuit." : ".")));
      box.append(fuite);
    }

    if (nuit && !echappes.length) {
      const peur = el("p", "verdict nuit");
      peur.append(el("p", null, "Un infiltré court encore : la nuit tombe et la méfiance grandit. Confiance −" + nuit + "."));
      box.append(peur);
    }

    const ep = erreurs === 0 && trouves === jour.nbInfiltres ? "parfait" : S.confiance < 30 ? "mauvais" : "moyen";
    $("#bilan-titre").textContent = ((jour.textesFin || {}).titre || "Soir du jour " + jour.jour) + " · " + trouves + " / " + jour.nbInfiltres + " démasqués";
    $("#bilan-epilogue").textContent = jour.epilogue[ep];
    $("#bilan-confiance").textContent = "Confiance du lycée : " + avant + " → " + S.confiance;
    $("#bilan-jauge").style.width = avant + "%";
    requestAnimationFrame(() => setTimeout(() => ($("#bilan-jauge").style.width = S.confiance + "%"), 400));
    const suivant = cfg.jours.find((j) => j.numero === jour.jour + 1);
    $("#bilan-suite").textContent = suivant && suivant.fichier
      ? "Jour " + suivant.numero + " : demain, ils seront plus nombreux, et mieux déguisés."
      : "Fin de la semaine.";
    $("#btn-suivant").hidden = exclu || !(suivant && suivant.fichier);
    const derniere = !(suivant && suivant.fichier);
    $("#bilan-final").hidden = !(derniere || exclu);
    $("#btn-semaine").hidden = !(derniere || exclu);
    if (derniere || exclu) finDeSemaine(exclu);
    if (exclu) {
      $("#bilan-epilogue").textContent = "Le groupe t'a exclu. Plus personne ne te parle, et vendredi, personne ne t'attendra devant la grille.";
      $("#bilan-suite").textContent = "Partie perdue : il faut recommencer la semaine.";
    }
    $("#btn-rejouer").textContent = exclu ? "Recommencer la semaine" : "Rejouer le jour " + jour.jour;
    $("#btn-rejouer").onclick = async () => {
      if (exclu) await chargerJour(1, cfg.confianceDepart);
      else await chargerJour(jour.jour, S.depart.confiance, S.depart.rates, S.depart.sem);
      ecran("ecran-intro");
    };
    ecran("ecran-bilan");
  }

  // ---------- Fin de semaine ----------
  function finDeSemaine(exclu) {
    const taux = SEM.total ? SEM.trouves / SEM.total : 0;
    let tier = "amer";
    if (exclu || taux < 0.4 || S.confiance < 25) tier = "defaite";
    else if (taux >= 0.75 && SEM.erreurs <= 1 && S.confiance >= 50) tier = "victoire";
    const libelle = { victoire: "Le lycée tient", amer: "Victoire amère", defaite: "Le lycée s'effondre" }[tier];
    const textes = jour.epilogueFinal || {};
    $("#final-titre").textContent = exclu ? "Exclu du groupe" : libelle;
    $("#final-texte").textContent = exclu ? "Tu as perdu la confiance du lycée avant la fin de la semaine. Le blocus de vendredi aura lieu sans toi." : (textes[tier] || "");
    $("#final-score").textContent = SEM.trouves + " / " + SEM.total + " infiltrés démasqués sur la semaine · " + SEM.erreurs + " innocent" + (SEM.erreurs > 1 ? "s" : "") + " accusé" + (SEM.erreurs > 1 ? "s" : "") + " · confiance " + S.confiance + " / 100";
    $("#final-numero").textContent = "";
    $("#final-partage").value = cfg.titre + " · " + SEM.trouves + "/" + SEM.total + " démasqués · " + SEM.erreurs + " innocent" + (SEM.erreurs > 1 ? "s" : "") + " accusé" + (SEM.erreurs > 1 ? "s" : "") + " · confiance " + S.confiance + "/100 · " + (exclu ? "Exclu du groupe" : libelle);
  }

  // ---------- Démarrage ----------
  async function chargerJour(n, confiance, ratesVeille, sem) {
    const info = cfg.jours.find((j) => j.numero === n);
    let brut;
    if (window.DONNEES && window.DONNEES.jours[n]) brut = structuredClone(window.DONNEES.jours[n]);
    else brut = await (await fetch(info.fichier)).json();
    const graine = 1;
    CAST = distribuerPrenoms();
    jour = appliquerPrenoms(brut);
    appliquerTirage(jour);
    // ceux qu'on a ratés la veille peuvent revenir
    const rates = new Set(ratesVeille || []);
    jour.pnj = jour.pnj.filter((p) => !p.condition || rates.has(p.condition.rateLaVeille));
    jour.nbInfiltres = jour.pnj.filter((p) => p.infiltre).length;
    // chaque revenant demande deux preuves de plus : deux actions de plus, sur la même durée de journée
    const revenants = jour.pnj.filter((p) => p.condition).length;
    if (revenants) {
      const duree = jour.actions * jour.minutesParAction;
      jour.actions += 2 * revenants;
      jour.minutesParAction = duree / jour.actions;
    }
    notesAuto(jour);
    SEM = n === 1 || !sem ? { trouves: 0, total: 0, erreurs: 0, graine } : { ...sem };
    S = { actions: jour.actions, confiance, depart: { confiance, rates: [...rates], sem: { ...SEM } }, rates: [], classe: {}, indices: new Set(), sources: {}, faits: new Set(), log: {}, zone: jour.zones[0].id, cible: null, accuses: new Set() };
    $("#intro-jour").textContent = cfg.titre + " · Jour " + jour.jour;
    // « Lundi. La veille du blocus. » : le jour en gros, la suite en dessous
    const [nomJour, ...suite] = jour.titre.split(". ");
    const h = $("#intro-titre");
    h.textContent = nomJour.replace(/\.$/, "");
    if (suite.length) h.append(el("em", null, suite.join(". ")));
    const intro = $("#intro-texte");
    intro.innerHTML = "";
    jour.intro.forEach((t) => intro.append(el("p", null, t)));
    // ceux d'hier qui ont échappé sont signalés, sans être comptés
    if (jour.pnj.some((p) => p.condition)) intro.append(el("p", null, "Le numéro anonyme ajoute : « Ceux d'hier sont encore là. »"));
    $("#intro-regles").textContent = jour.actions + " actions dans la journée. Observer ou poser une question coûte une action. Dans ton carnet, c'est toi qui décides ce qui est suspect ou ce qui est un alibi.";
  }

  function lancerJour() {
    ecran("ecran-jeu");
    renderHud();
    renderZones();
    renderScene();
    renderCarnet();
  }

  async function init() {
    try {
      cfg = window.DONNEES ? window.DONNEES.jeu : await (await fetch("data/jeu.json")).json();
      await chargerJour(1, cfg.confianceDepart);
    } catch (e) {
      $("#intro-texte").textContent = "Impossible de charger les données du jeu (" + e.message + "). Ouvre le jeu depuis un serveur web, pas en double-cliquant sur le fichier.";
      return;
    }
    $("#btn-regle-suivant").onclick = () => {
      if (regleI < REGLES.length - 1) { regleI++; renderRegle(); window.scrollTo(0, 0); }
      else ecran(regleRetour);
    };
    $("#btn-regle-passer").onclick = () => ecran(regleRetour);
    $("#btn-regles").onclick = () => ouvrirRegles("ecran-jeu");
    renderRegle();
    // sons des boutons : un clic discret partout, des sons propres au début et à la fin de journée
    document.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled || b.id === "btn-inserer") return;
      const id = b.id;
      if (id === "btn-commencer") SON.debut();
      else if (id === "btn-soir") { if (S.actions > 0) SON.fin(); else SON.clic(); }
      else if (id === "btn-accuser") SON.verdict(S.accuses && S.accuses.size);
      else if (id === "btn-carnet" || id === "btn-carnet-fermer") SON.carnet();
      else if (id === "btn-retour" || id === "btn-regle-passer") SON.retour();
      else if (id === "btn-son") return;
      else if (b.closest("#dialogue")) SON.choisir();
      else SON.clic();
    });
    const sonBtn = $("#btn-son");
    const majSon = () => { sonBtn.textContent = SON.actif ? "\u{1F50A}" : "\u{1F507}"; sonBtn.setAttribute("aria-pressed", SON.actif); sonBtn.title = SON.actif ? "Couper le son" : "Remettre le son"; };
    sonBtn.onclick = () => { SON.basculer(); majSon(); };
    majSon();
    $("#btn-commencer").onclick = lancerJour;
    $("#btn-soir").onclick = soir;
    $("#btn-retour").onclick = () => ecran("ecran-jeu");
    $("#btn-accuser").onclick = bilan;
    $("#btn-suivant").onclick = async () => { await chargerJour(jour.jour + 1, S.confiance, S.rates, SEM); ecran("ecran-intro"); };
    $("#btn-semaine").onclick = async () => { await chargerJour(1, cfg.confianceDepart); ecran("ecran-intro"); };
    $("#btn-copier").onclick = async () => {
      const champ = $("#final-partage");
      try { await navigator.clipboard.writeText(champ.value); $("#btn-copier").textContent = "Copié"; }
      catch (e) { champ.select(); $("#btn-copier").textContent = "Sélectionné : copie-le"; }
    };
    $("#btn-carnet").onclick = () => document.body.classList.toggle("carnet-ouvert");
    $("#btn-carnet-fermer").onclick = () => document.body.classList.remove("carnet-ouvert");
  }

  // crochet de test : ouvrir le jeu avec ?test pour inspecter l'état depuis un script automatisé
  if (location.search.includes("test")) window.__jeu = { etat: () => S, jour: () => jour, semaine: () => SEM };

  init();
})();

/* W05-C 낭독형 — sig.js (classic script · 의존성 0 · file:// 동작)
   1) my-style.css 의 --my-* 를 읽어 <html> 클래스와 파생 색을 정한다
   2) 로더(작은 격자 + 인물 + 손글씨) → 표지 순차 등장 → 이름 폭 맞춤
   3) 낭독: 스크롤 위치만큼 단어가 회색(또는 윤곽)에서 먹색으로 차오른다 (레퍼런스 GSAP scrub 규칙)
   4) 격자 손글씨 주석 · N–S 진행선 · 떠 있는 오브젝트 시차 · 인물 띠 · 폴라로이드 원색 전환
   스크롤을 가로채지 않는다(휠·터치 기본 동작 그대로). 숫자는 tokens.css 에서 읽는다. */
(function () {
  "use strict";
  var root = document.documentElement;
  var cs = getComputedStyle(root);
  function v(name) { return cs.getPropertyValue(name).trim(); }
  function num(name, fb) { var n = parseFloat(v(name)); return isNaN(n) ? fb : n; }
  function ms(name, fb) { var s = v(name); if (!s) return fb; return /ms$/.test(s) ? parseFloat(s) : parseFloat(s) * 1000; }
  function pick(val, list, fb) { return list.indexOf(val) > -1 ? val : fb; }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ── 1. 커스텀 항목 ─────────────────────────────────── */
  var my = {
    bg: v("--my-bg") || "#E9E9E9",
    point: v("--my-point") || "none",
    type: pick(v("--my-type"), ["serif", "sans", "mono", "hand"], "serif"),
    motion: pick(v("--my-motion"), ["0", "1", "2"], "1"),
    density: pick(v("--my-density"), ["0", "1", "2"], "1"),
    image: pick(v("--my-image"), ["native", "original", "mono", "tint"], "native"),
    reveal: pick(v("--my-reveal"), ["grey", "outline"], "grey"),
    notes: pick(v("--my-notes"), ["0", "1", "2"], "1")
  };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) my.motion = "0";
  var motion = +my.motion;

  function rgb(str) {
    var c = document.createElement("canvas").getContext("2d");
    c.fillStyle = "#010203"; c.fillStyle = str;
    var h = c.fillStyle;
    if (h === "#010203" && str.toLowerCase() !== "#010203") return null;
    if (h.charAt(0) === "#") return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
    var m = h.match(/\d+(\.\d+)?/g); return m ? [+m[0], +m[1], +m[2]] : null;
  }
  function lum(c) {
    var a = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
  function css(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  var bgRGB = rgb(my.bg) || rgb(v("--c-paper"));
  var darkBg = contrast(bgRGB, [255, 255, 255]) > contrast(bgRGB, [0, 0, 0]);
  var inkRGB = rgb(v(darkBg ? "--c-ink-inverse" : "--c-ink"));
  /* 레퍼런스 비율: 회색 단어 #ACACAC = 종이 #E9E9E9 에서 먹 쪽으로 26%, 가져올 줄 #B9B9B9 = 21% */
  var dimRGB = mix(bgRGB, inkRGB, 0.262);
  root.style.setProperty("--bg", css(bgRGB));
  root.style.setProperty("--ink", css(inkRGB));
  root.style.setProperty("--dim", css(dimRGB));
  root.style.setProperty("--claim-dim", css(mix(bgRGB, inkRGB, 0.21)));
  root.style.setProperty("--track", css(mix(bgRGB, inkRGB, 0.1)));
  root.style.setProperty("--caption", css(mix(bgRGB, inkRGB, 0.83)));
  if (darkBg) root.style.setProperty("--grid-color", v("--c-grid-dark"));

  var pointRGB = my.point !== "none" ? rgb(my.point) : null;
  if (!pointRGB) pointRGB = inkRGB;
  root.style.setProperty("--point", css(pointRGB));
  /* 작은 글자(날짜)·이름에 쓰는 포인트: 바탕 대비 4.5:1 이 될 때까지 먹 쪽으로 당긴다(면 색은 그대로) */
  var pInk = pointRGB, t = 0;
  while (contrast(pInk, bgRGB) < 4.5 && t < 1) { t += 0.05; pInk = mix(pointRGB, inkRGB, t); }
  root.style.setProperty("--point-ink", css(pInk));
  if (t > 0) root.setAttribute("data-point-adjusted", t.toFixed(2));

  var cls = ["t-" + my.type, "m-" + my.motion, "d-" + my.density, "i-" + my.image, "rv-" + my.reveal, "n-" + my.notes];
  if (motion > 0) cls.push("m-on", "is-reveal");
  if (darkBg) cls.push("is-dark");
  cls.forEach(function (c) { root.classList.add(c); });

  var mobile = function () { return window.innerWidth <= 1080; };
  var remPx = function () { return mobile() ? 10 : window.innerWidth / 172.8; };

  /* ── 2. 콘텐츠 준비 ─────────────────────────────── */
  var nameEl = $(".mc-name");
  var nameText = nameEl ? nameEl.textContent.trim() : "";
  var enEl = $(".mc-hero__en");
  var enText = enEl ? enEl.textContent.trim() : "";

  /* 인물 띠: width/height 속성 → 비율, 파일이 없으면 같은 크기 빈 자리 */
  var bandRow = $(".mc-band__row");
  var figs = [];
  if (bandRow) {
    $$(".mc-band__fig", bandRow).forEach(function (im, i) {
      var w = +im.getAttribute("width") || 300, h = +im.getAttribute("height") || 900;
      im.style.setProperty("--a", (w / h).toFixed(4));
      im.style.setProperty("--i", i);
      if (motion > 0) im.classList.add("is-idle");
      function empty() {
        var s = document.createElement("span");
        s.className = "mc-band__fig is-empty";
        s.style.setProperty("--a", (w / h).toFixed(4));
        s.setAttribute("data-missing", im.getAttribute("src"));
        if (im.parentNode) im.parentNode.replaceChild(s, im);
      }
      if (!im.getAttribute("src") || (im.complete && im.naturalWidth === 0)) empty();   // src="" = 파일 대기 빈 자리
      else { im.addEventListener("error", empty); figs.push(im.getAttribute("src")); }
    });
    if (!$$(".mc-band__fig", bandRow).length) { var band = $(".mc-band"); if (band) band.parentNode.removeChild(band); }
  }
  function figAt(i) { return figs.length ? figs[i % figs.length] : null; }
  /* 파일이 없으면 조용히 지운다(문장 속 인물·표지 인물·로더 인물·떠 있는 오브젝트) */
  function dropOnError(im, box) {
    im.addEventListener("error", function () { var t = box || im; if (t.parentNode) t.parentNode.removeChild(t); });
  }
  $$(".mc-object img").forEach(function (im) {
    if (im.complete && im.naturalWidth === 0) { im.parentNode.parentNode.removeChild(im.parentNode); return; }
    dropOnError(im, im.parentNode);
  });

  /* 폴라로이드 방향 */
  $$(".mc-polaroid img").forEach(function (im) {
    var w = +im.getAttribute("width") || 1, h = +im.getAttribute("height") || 1;
    im.parentNode.classList.add(h > w ? "is-portrait" : "is-landscape");
  });

  /* 어절 쪼개기 — 텍스트는 그대로, 공백 단위로 <span class="w"> 만 씌운다 */
  function split(el) {
    if (!el) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (tn) {
      var parts = tn.nodeValue.split(/(\s+)/), frag = document.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
        else { var s = document.createElement("span"); s.className = "w"; s.textContent = p; frag.appendChild(s); }
      });
      tn.parentNode.replaceChild(frag, tn);
    });
  }
  var readLine = $(".mc-read__line"), readIntro = $(".mc-read__intro");
  var claimA = $(".mc-claim__a"), claimB = $(".mc-claim__b");
  [readLine, readIntro, claimA, claimB].forEach(split);

  /* 문장 속 인물(레퍼런스: 낭독문 사이 펜 드로잉 5점) — 띠 일러스트를 1~3점 빌려 어절 사이에 끼운다 */
  function doodleAfter(container, frac, figIndex) {
    var src = figAt(figIndex); if (!container || !src) return;
    var ws = $$(".w", container); if (ws.length < 4) return;
    var at = ws[clamp(Math.round(ws.length * frac) - 1, 1, ws.length - 2)];
    var im = document.createElement("img");
    im.className = "mc-doodle"; dropOnError(im); im.src = src; im.alt = ""; im.setAttribute("aria-hidden", "true");
    at.parentNode.insertBefore(document.createTextNode(" "), at.nextSibling);
    at.parentNode.insertBefore(im, at.nextSibling.nextSibling);
  }
  doodleAfter(readLine, 0.3, 1);
  if (readLine && $$(".w", readLine).length >= 12) doodleAfter(readLine, 0.72, 3);
  doodleAfter(readIntro, 0.55, 5);

  /* 날짜 (레퍼런스: 메타 줄의 현재 시각, 포인트색) */
  var now = $(".mc-meta__now");
  function tick() {
    if (!now) return;
    var d = new Date();
    now.setAttribute("datetime", d.toISOString());
    now.textContent = d.toLocaleString("ko-KR", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  tick(); setInterval(tick, 30000);

  /* 푸터 손글씨 서명 (레퍼런스 "say hello" 손글씨 자리) — 영문 이름, 없으면 한글 이름 */
  var sign = $(".mc-footer__sign");
  if (sign) sign.textContent = enText || nameText;

  /* ── 3. 이름 맞춤 — 실제 렌더 폭을 재서 가장 크게, 어절 중간에서 끊지 않는다 ─ */
  var h1 = $(".mc-hero__name");
  var heroDoodle = null;
  if (figAt(0) && $(".mc-hero")) {
    heroDoodle = document.createElement("img");
    heroDoodle.className = "mc-hero__doodle"; dropOnError(heroDoodle); heroDoodle.src = figAt(0); heroDoodle.alt = "";
    heroDoodle.setAttribute("aria-hidden", "true");
    $(".mc-hero").appendChild(heroDoodle);
  }
  function fitName() {
    if (!h1 || !nameEl) return;
    h1.style.fontSize = "";
    var cap = parseFloat(getComputedStyle(h1).fontSize);          // 토큰 상한(1280에서 251.85px)
    var W = h1.clientWidth;
    var words = nameText.split(/\s+/);
    function measure(lines, size) {
      nameEl.innerHTML = "";
      lines.forEach(function (l) { var s = document.createElement("span"); s.className = "mc-name__line"; s.textContent = l; nameEl.appendChild(s); });
      h1.style.fontSize = size + "px";
      return nameEl.getBoundingClientRect().width;
    }
    var one = measure([nameText], 100);
    var s1 = Math.min(cap, Math.floor(100 * W / one * 0.995));
    var best = { lines: [nameText], size: s1 };
    if (words.length > 1) {
      /* 두 줄: 어절 경계 중 가장 고르게 나뉘는 곳 */
      var bestSplit = null;
      for (var k = 1; k < words.length; k++) {
        var a = words.slice(0, k).join(" "), b = words.slice(k).join(" ");
        var w2 = measure([a, b], 100);
        var s2 = Math.min(cap, Math.floor(100 * W / w2 * 0.995));
        if (!bestSplit || s2 > bestSplit.size) bestSplit = { lines: [a, b], size: s2 };
      }
      if (bestSplit && bestSplit.size > s1 * 1.25) best = bestSplit;
    }
    measure(best.lines, best.size);
    root.setAttribute("data-name-size", best.size);
    placeDoodle();
  }
  function placeDoodle() {
    if (!heroDoodle || !nameEl) return;
    var hero = $(".mc-hero"), hr = hero.getBoundingClientRect();
    var lines = $$(".mc-name__line", nameEl), last = lines[lines.length - 1];
    if (!last) return;
    var r = last.getBoundingClientRect(), fs = parseFloat(h1.style.fontSize) || 100;
    var hgt = Math.max(48, fs * 0.46);                               // 레퍼런스 담배 인물 ≈ 제목 0.44em
    var wid = hgt * (heroDoodle.naturalWidth && heroDoodle.naturalHeight ? heroDoodle.naturalWidth / heroDoodle.naturalHeight : 0.33);
    heroDoodle.style.height = hgt + "px";
    var bottom = r.bottom - hr.top - fs * 0.16;                     // 글자 바닥선 근처
    var gap = fs * 0.06;
    var left;
    if (r.right + gap + wid < hr.right - 16) left = r.right - hr.left + gap;
    else if (r.left - gap - wid > hr.left + 16) left = r.left - hr.left - gap - wid;
    else { heroDoodle.style.display = "none"; return; }
    heroDoodle.style.display = "";
    heroDoodle.style.left = left + "px";
    heroDoodle.style.top = (bottom - hgt) + "px";
  }
  if (heroDoodle) heroDoodle.addEventListener("load", placeDoodle);
  fitName();

  /* ── 4. 손글씨 주석 (격자 칸 좌표 · 기보 표기) ─────────── */
  var notesBox = $(".mc-notes");
  var seed = 0; for (var si = 0; si < nameText.length; si++) seed = (seed * 31 + nameText.charCodeAt(si)) >>> 0;
  function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  var notes = [];
  function buildNotes() {
    if (!notesBox) return; /* 격자 손글씨 기보 주석 삭제(2026-09-26) — .mc-notes 요소가 없어 실행되지 않음 */
    notesBox.innerHTML = ""; notes = [];
    if (my.notes === "0") return;
    var s0 = seed;
    var H = document.documentElement.scrollHeight, W = document.documentElement.clientWidth;
    var step = mobile() ? W * 0.25 : W * 0.11574;
    var perScreen = (my.notes === "2" ? 11 : 6) * (mobile() ? 0.6 : 1);
    var count = Math.round(H / window.innerHeight * perScreen);
    var pieces = ["", "", "", "N", "B", "R", "Q"], files = "abcdefgh";
    for (var i = 0; i < count; i++) {
      var x = 16 + rand() * (W - 80), y = 70 + rand() * (H - 140);
      var col = Math.floor(x / step), row = Math.floor(y / step);
      var p = pieces[Math.floor(rand() * pieces.length)];
      var label = p + files.charAt(col % 8) + (8 - (row % 8));
      var s = document.createElement("span");
      s.className = "mc-note"; s.textContent = label;
      s.style.left = x + "px"; s.style.top = y + "px";
      s.style.setProperty("--tilt", ((rand() - 0.5) * 16).toFixed(1) + "deg");
      notesBox.appendChild(s);
      notes.push({ el: s, y: y });
    }
    seed = s0;
    if (motion > 0) armNotes();
  }
  var queue = [], busy = false, io = null;
  function pop(el) {
    el.classList.remove("is-set"); el.classList.add("is-pop");
    setTimeout(function () { el.classList.remove("is-pop"); el.classList.add("is-set"); }, ms("--note-pop", 450));
  }
  function runQueue() {
    var el = queue.shift();
    if (!el) { busy = false; return; }
    busy = true; pop(el); setTimeout(runQueue, ms("--note-queue", 140));
  }
  function armNotes() {
    if (io) io.disconnect();
    if (!("IntersectionObserver" in window)) { notes.forEach(function (n) { n.el.classList.add("is-set"); }); return; }
    io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        var el = e.target;
        if (e.isIntersecting) {
          if (el.classList.contains("is-pop") || el.classList.contains("is-set") || queue.indexOf(el) > -1) return;
          if (!root.classList.contains("is-ready")) return;       // 첫 화면 주석은 로더 뒤 순서대로
          queue.push(el); if (!busy) runQueue();
        } else if (e.boundingClientRect.top > window.innerHeight) {
          var qi = queue.indexOf(el); if (qi > -1) queue.splice(qi, 1);
          el.classList.remove("is-pop", "is-set");
        }
      });
    });
    notes.forEach(function (n) { io.observe(n.el); });
  }
  function popAboveFold() {
    var d0 = ms("--note-atf-delay", 1300), st = ms("--note-atf-step", 220), k = 0;
    notes.forEach(function (n) {
      var r = n.el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) { (function (el, i) { setTimeout(function () { pop(el); }, d0 + i * st); })(n.el, k++); }
    });
  }

  /* ── 5. 로더 → 표지 등장 ─────────────────────── */
  var loader = $(".mc-loader");
  function ready() {
    root.classList.add("is-ready");
    if (motion > 0) popAboveFold();
  }
  if (motion > 0 && loader) {
    var stage = $(".mc-loader__stage", loader);
    var lf = figAt(figs.length - 1);
    if (lf) { var li = document.createElement("img"); li.className = "mc-loader__fig"; dropOnError(li); li.src = lf; li.alt = ""; stage.appendChild(li); }
    var dur = ms("--loader-dur", 1700), timer = null; /* 손글씨 기보 표기 삭제(2026-09-26 교수 지시) */
    setTimeout(function () { clearInterval(timer); loader.classList.add("is-zoom"); }, dur - 500);
    setTimeout(function () { loader.classList.add("is-out"); ready(); }, dur);
    setTimeout(function () { loader.style.display = "none"; }, dur + 500);
  } else {
    if (loader) loader.style.display = "none";
    ready();
  }

  /* ── 6. 낭독 (스크롤 위치 = 진행도, 단어마다 길이 3·간격 1) ────── */
  var groups = [];
  function group(container, targets, start, end, mode) {
    if (!container || !targets.length) return;
    groups.push({ el: container, t: targets, start: start, end: end, mode: mode });
  }
  if (motion > 0) {
    var readBox = $(".mc-read__text");
    if (readBox) {
      /* 내 한 문장은 --my-reveal, 소개는 늘 회색→먹 */
      var tl = $$(".w, .mc-doodle", readBox);
      group(readBox, tl, function (r, vh) { return r.top - vh * num("--read-start", .75); },
                         function (r, vh) { return r.bottom - vh * num("--read-end", .55); }, "read");
    }
    group(claimA, $$(".w", claimA || document.createElement("i")),
      function (r, vh) { return r.top - vh * num("--claim-start", .8); },
      function (r, vh) { return r.bottom - vh * num("--claim-end", .5); }, "fill");
    group(claimB, $$(".w", claimB || document.createElement("i")),
      function (r, vh, max) { var S = Math.min(r.top - 0.313 * vh, max - 0.35 * vh); return Math.max(S, r.top - 0.95 * vh, 0); },
      function (r, vh, max) { return max; }, "fill");
  }
  var wordLen = num("--read-word", 3), dimOp = num("--doodle-dim", .32);
  function paint() {
    var vh = window.innerHeight, y = window.scrollY, max = document.documentElement.scrollHeight - vh;
    groups.forEach(function (g) {
      var rc = g.el.getBoundingClientRect(), r = { top: rc.top + y, bottom: rc.bottom + y };
      var a = g.start(r, vh, max), b = g.end(r, vh, max);
      if (b <= a + 1) b = a + 1;
      var p = clamp((y - a) / (b - a), 0, 1);
      var n = g.t.length, T = n - 1 + wordLen;
      g.t.forEach(function (el, i) {
        var k = clamp((p * T - i) / wordLen, 0, 1);
        if (el.tagName === "IMG") { el.style.opacity = (dimOp + (1 - dimOp) * k).toFixed(3); return; }
        var outline = g.mode === "fill" || (my.reveal === "outline" && readLine && readLine.contains(el));
        if (outline) el.style.color = "rgba(" + inkRGB.join(",") + "," + k.toFixed(3) + ")";
        else el.style.color = css(mix(dimRGB, inkRGB, k));
      });
    });
  }

  /* ── 7. 진행선 · 오브젝트 시차 · 주석 흔들림 ───────────── */
  var fill = $(".mc-compass__fill"), compass = $(".mc-compass");
  if (compass) compass.addEventListener("click", function (e) {
    var line = $(".mc-compass__line", compass).getBoundingClientRect();
    var p = clamp((e.clientY - line.top) / line.height, 0, 1);
    window.scrollTo({ top: p * (document.documentElement.scrollHeight - window.innerHeight), behavior: motion ? "smooth" : "auto" });
  });
  var objects = $$(".mc-object").map(function (o, i) { return { el: o, img: $("img", o), s: [2.5, 4][i % 2] }; });
  var lastY = window.scrollY, Z = 0, rt = 0, tt = 0;
  function frame(time) {
    var y = window.scrollY, vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
    if (fill) fill.parentNode.parentNode.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);
    if (motion > 0) {
      paint();
      var amp = motion === 2 ? 2 : 1;
      objects.forEach(function (o) {
        if (!o.img) return;
        var r = o.el.getBoundingClientRect();
        var p = clamp((vh - r.top) / (vh + r.height), 0, 1);           // top bottom → bottom top
        var d = o.s * remPx() * amp;
        o.img.style.setProperty("--py", (-d + 2 * d * p).toFixed(1) + "px");
        if (motion === 2) o.img.style.setProperty("--sway", (Math.sin(time / 1400) * 3).toFixed(2) + "deg");
      });
      /* 레퍼런스 coord drift: 스크롤 속도에 스프링으로 따라가는 -0~7px 이동 */
      var vel = y - lastY; lastY = y;
      Z += (vel - Z) * 0.12;
      var st = Math.min(Math.max(Z, 0) / 22, 1) * 7 * amp;
      tt += (st - rt) * 0.045; tt *= 0.88; rt += tt;
      if (notesBox) { notesBox.style.setProperty("--drift-y", (-rt).toFixed(3) + "px"); notesBox.style.setProperty("--drift-s", (1 - rt / 7 * 0.07).toFixed(4)); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ── 8. 폴라로이드: 화면 가운데 들어오면 원색 (native) ─────── */
  if ("IntersectionObserver" in window) {
    var pio = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { e.target.classList.toggle("is-colored", e.isIntersecting); });
    }, { rootMargin: "-30% 0px -30% 0px" });
    $$(".mc-polaroid").forEach(function (f) { pio.observe(f); });
  }

  /* ── 9. 다시 맞춤 ─────────────────────────── */
  var rz;
  function refit() { fitName(); buildNotes(); if (root.classList.contains("is-ready") && motion > 0) notes.forEach(function (n) { var r = n.el.getBoundingClientRect(); if (r.top < window.innerHeight) n.el.classList.add("is-set"); }); }
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(refit, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitName(); buildNotes(); });
  window.addEventListener("load", function () { fitName(); buildNotes(); });
  buildNotes();
})();

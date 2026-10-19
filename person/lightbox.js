/* 사진 크게 보기 + 스와이프 + 마우스 오버 클로즈업 (교수 지시로 추가 · 시스템 파일 밖)
   사진을 누르면 그 자리에서 화면 가운데로 커지고(클로즈업),
   좌우로 밀거나 ← → 로 같은 묶음의 사진을 넘긴다. Esc·× ·바깥 누르기로 닫는다.
   묶음은 둘: 이유 근거 사진(.mc-polaroid 3장) · 사진 모음(.sc-card, scatter.js가 섞은 순서). */
(function () {
  "use strict";
  var PAD = { top: 64, bottom: 88, side: 24 };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function makeGroup(sel, meta, zoom) {
    var figs = Array.prototype.slice.call(document.querySelectorAll(sel));
    return {
      zoom: zoom,
      figs: figs,
      items: figs.map(function (f, i) {
        var img = f.querySelector("img");
        var m = meta(f, i);
        return {
          fig: f, src: img.getAttribute("src"), alt: img.getAttribute("alt") || "",
          w: +img.getAttribute("width") || img.naturalWidth || 1,
          h: +img.getAttribute("height") || img.naturalHeight || 1,
          no: m.no, title: m.title
        };
      })
    };
  }

  var groups = [
    makeGroup(".mc-polaroid", function (f, i) {
      var art = f.closest(".mc-reason");
      var no = art && art.querySelector(".mc-reason__no");
      var title = art && art.querySelector(".mc-reason__title");
      return { no: no ? no.textContent.trim() : "사진 " + (i + 1), title: title ? title.textContent.trim() : "" };
    }, 1.14),
    makeGroup(".sc-card", function (f, i) { return { no: "사진 모음", title: "" }; }, 1.1)
  ].filter(function (g) { return g.figs.length; });
  if (!groups.length) return;

  /* ── 틀 만들기 ── */
  var lb = document.createElement("div");
  lb.className = "lb";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "사진 크게 보기");
  lb.innerHTML =
    '<div class="lb__bg"></div>' +
    '<div class="lb__track"></div>' +
    '<div class="lb__bar"><p class="lb__cap"></p><p class="lb__count"></p></div>' +
    '<button type="button" class="lb__btn lb__prev" aria-label="이전 사진">‹</button>' +
    '<button type="button" class="lb__btn lb__next" aria-label="다음 사진">›</button>' +
    '<button type="button" class="lb__btn lb__close" aria-label="닫기">×</button>';
  document.body.appendChild(lb);

  var track = lb.querySelector(".lb__track");
  var cap = lb.querySelector(".lb__cap");
  var count = lb.querySelector(".lb__count");
  var btnPrev = lb.querySelector(".lb__prev");
  var btnNext = lb.querySelector(".lb__next");
  var btnClose = lb.querySelector(".lb__close");

  var G = null, items = [], slides = [], cur = 0, open = false, lastFocus = null;

  /* 열 때마다 그 묶음의 슬라이드를 만든다. 멀리 있는 사진은 가까이 올 때 불러온다 */
  function build(group) {
    G = group; items = group.items;
    track.innerHTML = "";
    slides = items.map(function (it) {
      var s = document.createElement("div");
      s.className = "lb__slide";
      var im = document.createElement("img");
      im.alt = it.alt; im.draggable = false; im.dataset.src = it.src;
      s.appendChild(im);
      track.appendChild(s);
      return s;
    });
  }
  function load(i) {
    for (var k = i - 1; k <= i + 1; k++) {
      var s = slides[k]; if (!s) continue;
      var im = s.querySelector("img");
      if (!im.getAttribute("src")) im.src = im.dataset.src;
    }
  }

  function fitRect(it) {
    var bw = window.innerWidth - PAD.side * 2;
    var bh = window.innerHeight - PAD.top - PAD.bottom;
    var k = Math.min(bw / it.w, bh / it.h, 1);
    var w = it.w * k, h = it.h * k;
    return { left: PAD.side + (bw - w) / 2, top: PAD.top + (bh - h) / 2, width: w, height: h };
  }

  function setPos(dx, snap) {
    track.classList.toggle("is-snap", !!snap);
    track.style.transform = "translate3d(" + (-cur * window.innerWidth + (dx || 0)) + "px,0,0)";
  }

  function paint() {
    var it = items[cur];
    cap.innerHTML = "";
    var b = document.createElement("b"); b.textContent = it.no;
    cap.appendChild(b); cap.appendChild(document.createTextNode(it.title));
    count.textContent = (cur + 1) + " / " + items.length;
    btnPrev.disabled = cur === 0;
    btnNext.disabled = cur === items.length - 1;
    load(cur);
  }

  function go(i) {
    cur = Math.max(0, Math.min(items.length - 1, i));
    setPos(0, !reduce);
    paint();
  }

  /* 제자리 ↔ 가운데 자리를 오가는 날아가는 사진 */
  function flyImg(src, r) {
    var f = document.createElement("img");
    f.className = "lb__fly"; f.src = src; f.alt = "";
    f.style.left = r.left + "px"; f.style.top = r.top + "px";
    f.style.width = r.width + "px"; f.style.height = r.height + "px";
    document.body.appendChild(f);
    return f;
  }
  function delta(a, b) { // b 자리에 놓인 그림을 a 자리로 보이게 하는 변형
    return "translate(" + (a.left - b.left) + "px," + (a.top - b.top) + "px) scale(" + (a.width / b.width) + "," + (a.height / b.height) + ")";
  }
  function after(f, done) {
    var end = function () { if (f.isConnected) f.remove(); done(); done = function () {}; };
    f.addEventListener("transitionend", end, { once: true });
    setTimeout(end, 750);
  }
  function fly(fromR, toR, src, done) {
    if (reduce || !fromR.width) { done(); return; }
    var f = flyImg(src, toR);
    f.style.transform = delta(fromR, toR);
    f.getBoundingClientRect();
    requestAnimationFrame(function () { f.style.transform = "none"; after(f, done); });
  }
  function reverseFly(fromR, toR, src, done) {
    if (reduce || !toR.width || !fromR.width) { done(); return; }
    var f = flyImg(src, fromR);
    f.getBoundingClientRect();
    requestAnimationFrame(function () { f.style.transform = delta(toR, fromR); after(f, done); });
  }

  function inView(r) { return r.width && r.bottom > 0 && r.top < window.innerHeight; }
  function srcBox(it) { return it.fig.querySelector(".lb-lens") || it.fig.querySelector("img"); }

  function show(group, i) {
    if (open) return;
    open = true; lastFocus = document.activeElement;
    build(group);
    cur = i; paint();
    document.documentElement.style.overflow = "hidden";
    lb.classList.add("is-open");
    setPos(0, false);
    var ni = items[cur].fig.querySelector("img"); // 크기를 몰랐던 사진(webp)은 지금 실제 크기로
    if (ni.naturalWidth && items[cur].w <= 1) { items[cur].w = ni.naturalWidth; items[cur].h = ni.naturalHeight; }
    var target = slides[cur].querySelector("img");
    target.style.visibility = "hidden";
    var fromR = srcBox(items[cur]).getBoundingClientRect();
    requestAnimationFrame(function () { lb.classList.add("is-shown"); });
    fly(fromR, fitRect(items[cur]), items[cur].src, function () {
      target.style.visibility = "";
      btnClose.focus({ preventScroll: true });
    });
  }

  function hide() {
    if (!open) return;
    var it = items[cur];
    var toR = srcBox(it).getBoundingClientRect();
    var slideImg = slides[cur].querySelector("img");
    var fromR = slideImg.getBoundingClientRect();
    lb.classList.remove("is-shown");
    var finish = function () {
      lb.classList.remove("is-open");
      slideImg.style.visibility = "";
      document.documentElement.style.overflow = "";
      open = false;
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    if (inView(toR)) { slideImg.style.visibility = "hidden"; reverseFly(fromR, toR, it.src, finish); }
    else setTimeout(finish, reduce ? 0 : 300);
  }

  /* ── 사진을 버튼처럼 + 마우스 오버 클로즈업 ──
     사진을 .lb-lens 액자로 감싸 넘치는 부분을 가리고, 올라가 있는 동안
     액자 안 사진을 한 단계 당기며 커서 쪽으로 시선을 옮긴다. 값은 매 프레임
     목표값을 따라가게(lerp) 해서 멈칫하지 않고 흐르듯 움직인다. */
  groups.forEach(function (g) {
    g.figs.forEach(function (f, i) {
      f.setAttribute("tabindex", "0");
      f.setAttribute("role", "button");
      f.setAttribute("aria-label", (g.items[i].title ? g.items[i].no + " " : "") + (g.items[i].alt || "사진") + " 크게 보기");
      f.addEventListener("click", function () { show(g, i); });
      f.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(g, i); }
      });

      var im = f.querySelector("img");
      var lens = document.createElement("span");
      lens.className = "lb-lens";
      im.parentNode.insertBefore(lens, im);
      lens.appendChild(im);
      if (!canHover || reduce) return;

      var st = { x: 0, y: 0, z: 1 }, tg = { x: 0, y: 0, z: 1 }, raf = 0;
      var ZOOM = g.zoom, PAN = 0.5; // PAN: 넘치는 여백 중 얼마만큼 커서를 따라갈지
      function tick() {
        var k = 0.09; // 작을수록 느리고 부드럽다
        st.x += (tg.x - st.x) * k; st.y += (tg.y - st.y) * k; st.z += (tg.z - st.z) * k;
        im.style.setProperty("--lx", st.x.toFixed(2) + "px");
        im.style.setProperty("--ly", st.y.toFixed(2) + "px");
        im.style.setProperty("--lz", st.z.toFixed(4));
        var rest = Math.abs(tg.x - st.x) + Math.abs(tg.y - st.y) + Math.abs(tg.z - st.z) * 100;
        raf = rest > 0.05 ? requestAnimationFrame(tick) : 0;
      }
      function kick() { if (!raf) raf = requestAnimationFrame(tick); }
      function aim(e) {
        var r = lens.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;  // -0.5 ~ 0.5
        var py = (e.clientY - r.top) / r.height - 0.5;
        var sx = lens.offsetWidth * (ZOOM - 1) / 2, sy = lens.offsetHeight * (ZOOM - 1) / 2;
        tg.x = -px * 2 * sx * PAN; tg.y = -py * 2 * sy * PAN;
      }
      f.addEventListener("pointerenter", function (e) { tg.z = ZOOM; aim(e); kick(); });
      f.addEventListener("pointermove", function (e) { aim(e); kick(); });
      f.addEventListener("pointerleave", function () { tg.x = 0; tg.y = 0; tg.z = 1; kick(); });
    });
  });

  btnPrev.addEventListener("click", function () { go(cur - 1); });
  btnNext.addEventListener("click", function () { go(cur + 1); });
  btnClose.addEventListener("click", hide);

  document.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") hide();
    else if (e.key === "ArrowLeft") go(cur - 1);
    else if (e.key === "ArrowRight") go(cur + 1);
    else if (e.key === "Tab") { // 포커스를 창 안에 가둔다
      var bs = [btnPrev, btnNext, btnClose].filter(function (b) { return !b.disabled && b.offsetParent; });
      var k = bs.indexOf(document.activeElement);
      e.preventDefault();
      bs[(k + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus();
    }
  });

  /* ── 스와이프 (터치·마우스 끌기 모두) ── */
  var down = null;
  track.addEventListener("pointerdown", function (e) {
    if (!open) return;
    down = { x: e.clientX, t: Date.now(), dx: 0, moved: false, onImg: e.target.tagName === "IMG" };
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener("pointermove", function (e) {
    if (!down) return;
    var dx = e.clientX - down.x;
    if (Math.abs(dx) > 6) down.moved = true;
    var atEdge = (cur === 0 && dx > 0) || (cur === items.length - 1 && dx < 0);
    down.dx = atEdge ? dx * 0.3 : dx; // 끝에서는 덜 끌린다
    setPos(down.dx, false);
  });
  function up() {
    if (!down) return;
    var d = down; down = null;
    if (!d.moved) { setPos(0, false); if (!d.onImg) hide(); return; }
    var W = window.innerWidth;
    var fast = Math.abs(d.dx) / Math.max(1, Date.now() - d.t) > 0.5;
    if ((d.dx < -W * 0.18 || (fast && d.dx < -30)) && cur < items.length - 1) go(cur + 1);
    else if ((d.dx > W * 0.18 || (fast && d.dx > 30)) && cur > 0) go(cur - 1);
    else setPos(0, !reduce);
  }
  track.addEventListener("pointerup", up);
  track.addEventListener("pointercancel", up);

  window.addEventListener("resize", function () { if (open) setPos(0, false); });
})();

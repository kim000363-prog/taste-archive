/* 사진 모음 — 무작위 흩뿌림 (학생 요청으로 추가 · 시스템 파일 밖)
   불러올 때마다 순서를 섞고, 칸마다 크기·자리·기울기를 조금씩 흔들어
   책상 위에 던져 둔 사진처럼 살짝 겹쳐 쌓는다. 창 크기가 바뀌면 같은 무작위 값으로 다시 쌓는다. */
(function () {
  "use strict";
  var sec = document.querySelector(".sc");
  if (!sec) return;
  var field = sec.querySelector(".sc__field");
  var cards = Array.prototype.slice.call(field.querySelectorAll(".sc-card"));
  if (!cards.length) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 한 번 정한 씨앗으로 같은 무작위를 되풀이한다 */
  var seed = (Math.random() * 4294967296) >>> 0;
  function rng(s) {
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function between(r, a, b) { return a + (b - a) * r(); }

  /* 순서 섞기 — 화면 순서와 크게 보기(스와이프) 순서가 같도록 DOM도 옮긴다 */
  var shuf = rng(seed ^ 0x9E3779B9);
  for (var i = cards.length - 1; i > 0; i--) {
    var j = Math.floor(shuf() * (i + 1)), t = cards[i]; cards[i] = cards[j]; cards[j] = t;
  }
  cards.forEach(function (c, k) {
    field.appendChild(c);
    var im = c.querySelector("img");
    im.alt = "사진 " + (k + 1);
  });

  function ratio(c) {
    var im = c.querySelector("img");
    var w = +im.getAttribute("width") || im.naturalWidth, h = +im.getAttribute("height") || im.naturalHeight;
    return w && h ? h / w : 1;
  }

  function layout() {
    var W = field.clientWidth;
    if (!W) return;
    var cols = W >= 1100 ? 6 : W >= 700 ? 4 : 2;
    var cell = W / cols;
    var r = rng(seed);
    var colH = [];
    for (var c = 0; c < cols; c++) colH.push(between(r, 0, cell * 0.25)); // 첫 줄부터 들쭉날쭉
    cards.forEach(function (card, k) {
      var col = 0;
      for (var c = 1; c < cols; c++) if (colH[c] < colH[col]) col = c;
      var w = cell * between(r, 0.74, 1.12);
      var h = w * ratio(card);
      var x = col * cell + (cell - w) / 2 + between(r, -0.14, 0.14) * cell;
      x = Math.max(0, Math.min(W - w, x));
      var y = colH[col] + between(r, -0.12, 0.04) * h;
      colH[col] = y + h * between(r, 0.8, 0.94); // 다음 사진이 아래쪽을 살짝 덮는다
      var s = card.style;
      s.setProperty("--x", x.toFixed(1) + "px");
      s.setProperty("--y", Math.max(0, y).toFixed(1) + "px");
      s.setProperty("--w", w.toFixed(1) + "px");
      s.setProperty("--r", between(r, -8, 8).toFixed(2) + "deg");
      s.setProperty("--z", String(1 + Math.floor(r() * cards.length)));
      var d = between(r, 0, 0.35);
      s.setProperty("--d", (reduce || card.classList.contains("is-in") ? 0 : d).toFixed(2) + "s");
    });
    var bottom = 0;
    cards.forEach(function (card) {
      var y = parseFloat(card.style.getPropertyValue("--y")) || 0;
      var w = parseFloat(card.style.getPropertyValue("--w")) || 0;
      bottom = Math.max(bottom, y + w * ratio(card));
    });
    field.style.height = Math.ceil(bottom + 40) + "px";
  }

  sec.classList.add("is-laid");
  layout();

  /* 크기를 모르는 사진(webp)은 불러온 뒤 다시 쌓는다 */
  cards.forEach(function (c) {
    var im = c.querySelector("img");
    if (!im.getAttribute("width")) im.addEventListener("load", layout, { once: true });
  });

  var rz;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(layout, 120); });

  /* 들어오기 · 가운데 오면 원색 */
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) {
        var el = e.target; el.classList.add("is-in"); io.unobserve(el);
        setTimeout(function () { el.style.setProperty("--d", "0s"); }, 1600); // 들어온 뒤에는 오버 반응에 지연이 없게
      } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    cards.forEach(function (c) { io.observe(c); });
  } else {
    cards.forEach(function (c) { c.classList.add("is-in"); });
  }
  if ("IntersectionObserver" in window) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("is-colored", e.isIntersecting); });
    }, { rootMargin: "-30% 0px -30% 0px" });
    cards.forEach(function (c) { co.observe(c); });
  }
})();

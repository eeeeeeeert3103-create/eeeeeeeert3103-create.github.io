/* ГРАНИ — общие утилиты интерфейса */

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const ICONS = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 015.5 6h1.2a2 2 0 001.7-.9l.6-.9A1.6 1.6 0 0110.4 3h3.2a1.6 1.6 0 011.4.8l.6.9a2 2 0 001.7.9h1.2A2.5 2.5 0 0121 8.5v9A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6.5" r="2.6"/><circle cx="6" cy="17.5" r="2.6"/><path d="M8.2 8.2L20 18M8.2 15.8L20 6"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 006 6l1.5-2 4 1.5v3a2 2 0 01-2.2 2A17 17 0 014.5 5.7 2 2 0 016.5 3.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.8"/><path d="M4 17l5-5 4 4 3-2.5 4 4"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.8l5.9-.9z"/></svg>',
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function money(n) {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("ru-RU").replace(/\u00a0/g, " ") + " ₽";
}

function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(iso) {
  const d = parseDate(iso);
  if (!d) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDay(iso) {
  const d = parseDate(iso);
  if (!d) return "—";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function fmtAgo(iso) {
  const d = parseDate(iso);
  if (!d) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 2) return "вчера";
  return `${Math.floor(diff / 86400)} дн назад`;
}

function statusPill(status, label) {
  return `<span class="pill pill-${esc(status)}"><i class="dot"></i>${esc(label || status)}</span>`;
}

async function api(path, options = {}) {
  const opts = { headers: {}, ...options };
  if (opts.body && typeof opts.body !== "string") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* пустой ответ */ }
  if (!res.ok) throw new Error((data && data.error) || `Ошибка ${res.status}`);
  return data;
}

function toast(message, isError = false) {
  const old = $(".toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " err" : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function lightbox(src) {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `<img src="${esc(src)}" alt="">`;
  box.addEventListener("click", () => box.remove());
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") { box.remove(); document.removeEventListener("keydown", onKey); }
  });
  document.body.appendChild(box);
}

function modal(html, { onMount } = {}) {
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); };
  function onKey(e) { if (e.key === "Escape") close(); }
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(back);
  if (onMount) onMount(back, close);
  return { close, back };
}

function askPrice(current) {
  return new Promise((resolve) => {
    const m = modal(`
      <h3>Отметить выполненной</h3>
      <p class="muted small">Сумма пойдёт в отчёт и бухгалтерию.</p>
      <label class="field"><span class="label">Итоговая оплата, ₽</span>
        <input class="input" id="m-price" type="number" min="0" step="50" value="${current ? esc(current) : ""}" placeholder="2 000"></label>
      <div class="row" style="margin-top:18px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" data-cancel>Отмена</button>
        <button class="btn btn-primary btn-sm" data-ok>Подтвердить</button>
      </div>`, {
      onMount(back, close) {
        back.querySelector("[data-cancel]").onclick = () => { close(); resolve(null); };
        back.querySelector("[data-ok]").onclick = () => {
          const v = back.querySelector("#m-price").value;
          close(); resolve(v ? Number(v) : null);
        };
      },
    });
    void m;
  });
}

function askReview() {
  return new Promise((resolve) => {
    let rating = 0;
    const m = modal(`
      <h3>Как прошло?</h3>
      <p class="muted small">Отзыв видят мастер и владелец сети.</p>
      <div class="stars" id="m-stars">${[1, 2, 3, 4, 5].map((i) => `<button class="star" data-v="${i}" aria-label="${i} из 5">★</button>`).join("")}</div>
      <label class="field" style="margin-top:14px"><span class="label">Комментарий</span>
        <textarea class="textarea" id="m-text" placeholder="Что понравилось, что улучшить"></textarea></label>
      <div class="row" style="margin-top:18px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" data-cancel>Позже</button>
        <button class="btn btn-primary btn-sm" data-ok>Отправить</button>
      </div>`, {
      onMount(back, close) {
        const stars = Array.from(back.querySelectorAll(".star"));
        stars.forEach((b) => b.onclick = () => {
          rating = Number(b.dataset.v);
          stars.forEach((s) => s.classList.toggle("on", Number(s.dataset.v) <= rating));
        });
        back.querySelector("[data-cancel]").onclick = () => { close(); resolve(null); };
        back.querySelector("[data-ok]").onclick = () => {
          if (!rating) { toast("Поставьте оценку", true); return; }
          const text = back.querySelector("#m-text").value;
          close(); resolve({ rating, text });
        };
      },
    });
    void m;
  });
}

async function compressImage(file, maxSide = 1500, quality = 0.82) {
  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/* ---------- рендер разбора ---------- */

function verdictClass(v) {
  return v === "recommended" ? "ok" : v === "conditional" ? "warn" : "bad";
}

function renderAnalysis(a, { compact = false } = {}) {
  if (!a) return "";
  const cls = verdictClass(a.verdict);
  const pct = Math.max(8, Math.round((a.score / (a.score_max || 12)) * 100));
  const marks = { ok: "✓", warn: "!", bad: "×" };
  const checks = (a.checks || []).map((c) => `
    <div class="check ${esc(c.status)}">
      <span class="mark">${marks[c.status] || "·"}</span>
      <div><b>${esc(c.title)}</b>${esc(c.text)}</div>
    </div>`).join("");

  const steps = (a.technique || []).map((s) => `
    <div class="step">
      <span class="n">${s.n}</span>
      <div><div class="zone">${esc(s.zone)}</div><div class="text">${esc(s.text)}</div></div>
    </div>`).join("");

  const t = a.timing || {};
  const params = a.params || {};
  const paramRow = [params.sides_mm && `Бока ${params.sides_mm}`, params.top_cm && `Верх ${params.top_cm}`,
    params.fade && `Фейд: ${params.fade}`].filter(Boolean);

  const alt = a.alternative ? `
    <div class="alt-card">
      <div><div class="an">${esc(a.alternative.name)}</div><div class="aw">${esc(a.alternative.why || "")}</div></div>
      <div class="tiny muted nowrap">${a.alternative.price_min ? money(a.alternative.price_min) : ""}${a.alternative.price_max ? " – " + money(a.alternative.price_max) : ""}</div>
    </div>` : "";

  return `
    <div class="verdict ${cls}">
      <div class="vt">${ICONS.spark} ${esc(a.verdict_title || "")}</div>
      <div class="vs">${esc(a.summary || "")}</div>
      <div class="score">
        <div class="score-bar"><i style="width:${pct}%"></i></div>
        <span class="tiny mono">${a.score} из ${a.score_max || 12}</span>
      </div>
    </div>

    ${paramRow.length ? `<div class="row" style="margin-top:12px">${paramRow.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>` : ""}

    ${a.master_note ? `<div class="master-note" style="margin-top:16px">${esc(a.master_note)}</div>` : ""}

    <h4 style="margin:22px 0 10px">Проверка по параметрам</h4>
    <div class="checks">${checks}</div>

    <h4 style="margin:24px 0 4px">Как делать</h4>
    <div class="steps">${steps}</div>

    <div class="meta-grid" style="margin-top:20px">
      <div class="meta"><div class="k">Время</div><div class="v">${t.minutes || "—"} мин</div></div>
      <div class="meta"><div class="k">Стоимость</div><div class="v">${money(t.price_min)} – ${money(t.price_max)}</div></div>
      <div class="meta"><div class="k">Обновление</div><div class="v">${esc(t.upkeep_text || "—")}</div></div>
    </div>

    <div class="grid-2" style="margin-top:22px">
      <div>
        <h4 style="margin-bottom:8px">Инструменты</h4>
        <div class="row">${(a.tools || []).map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>
      </div>
      <div>
        <h4 style="margin-bottom:8px">Средства</h4>
        <div class="row">${(a.products || []).map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>
      </div>
    </div>

    ${alt ? `<h4 style="margin:22px 0 8px">Альтернатива</h4>${alt}` : ""}

    ${compact ? "" : `
    <div class="grid-2" style="margin-top:22px">
      <div>
        <h4 style="margin-bottom:8px">Риски</h4>
        <ul class="list-tick">${(a.risks || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div>
        <h4 style="margin-bottom:8px">После стрижки</h4>
        <ul class="list-tick">${(a.aftercare || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
    </div>

    <h4 style="margin:22px 0 8px">Что уточнить на консультации</h4>
    <ul class="list-tick">${(a.questions || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`}
  `;
}

function photoUrl(f) { return `./uploads/${encodeURIComponent(f)}`; }

window.G = {
  $, $$, esc, plural, money, api, toast, lightbox, modal, askPrice, askReview,
  compressImage, fmtDateTime, fmtDay, fmtAgo, statusPill, renderAnalysis,
  photoUrl, ICONS, MONTHS,
};

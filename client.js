(function () {
"use strict";
/* ГРАНИ — клиентское приложение */

const { $, $$, esc, money, api, toast, lightbox, askReview, fmtDateTime, fmtDay, fmtAgo,
  statusPill, renderAnalysis, photoUrl, compressImage, plural, ICONS } = window.G;

const avatarImg = (m, cls = "avatar") => m.avatar
  ? `<img class="${cls}" src="${photoUrl(m.avatar)}" alt="">`
  : `<span class="${cls} avatar-letter">${esc((m.name || "?")[0])}</span>`;

const LS_KEY = "grani_client_v1";
const DEMO_CLIENTS = [
  ["Кирилл Орлов", "+7 999 111-22-33", "male"],
  ["Анна Ветрова", "+7 999 333-44-55", "female"],
  ["Дмитрий Смирнов", "+7 999 222-33-44", "male"],
  ["Марина Ким", "+7 999 444-55-66", "female"],
];
const TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const EVENT_LABELS = {
  new: "Заявка отправлена", open: "Мастер открыл заявку", analysis: "Разбор опубликован",
  booking: "Запись подтверждена", done: "Услуга выполнена", review: "Отзыв оставлен",
  declined: "Заявка отклонена", reschedule: "Время перенесено", draft: "Черновик разбора",
};

const state = { client: null, meta: null, requests: [], preview: {}, error: null };
let wizard = null;

/* ---------------- инициализация ---------------- */

(async function init() {
  try {
    state.meta = await api("/api/meta");
  } catch (e) {
    document.getElementById("view").innerHTML = `<div class="card card-pad">Сервер не отвечает. Запустите <b>python3 app.py</b> в папке проекта.</div>`;
    return;
  }
  const phoneParam = new URLSearchParams(location.search).get("phone");
  if (phoneParam) {
    try { saveClient(await api(`/api/clients?phone=${encodeURIComponent(phoneParam)}`)); } catch (e) { /* гость */ }
  }
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
  if (saved && saved.phone) {
    try {
      state.client = await api(`/api/clients?phone=${encodeURIComponent(saved.phone)}`);
    } catch (e) { state.client = null; }
  }
  window.addEventListener("hashchange", route);
  route();
})();

function saveClient(c) {
  state.client = c;
  localStorage.setItem(LS_KEY, JSON.stringify({ id: c.id, phone: c.phone }));
}

function route() {
  const hash = location.hash || "#/home";
  const [, , arg] = hash.split("/");
  renderWho();
  $$("#nav [data-nav]").forEach((a) => {
    const active = (a.dataset.nav === "new" && hash.startsWith("#/new")) || (a.dataset.nav === "home" && !hash.startsWith("#/new"));
    a.classList.toggle("active", active);
  });
  if (!state.client) return renderAuth();
  if (hash.startsWith("#/new")) return wizard ? renderWizard() : startWizard();
  if (hash.startsWith("#/request/")) return renderRequest(Number(arg));
  return renderHome();
}

function renderWho() {
  const who = document.getElementById("who");
  if (!state.client) { who.innerHTML = ""; return; }
  who.innerHTML = `<button class="navlink" id="who-btn" title="Выйти из кабинета">${esc(state.client.name.split(" ")[0])} · выйти</button>`;
  document.getElementById("who-btn").addEventListener("click", () => {
    localStorage.removeItem(LS_KEY);
    state.client = null;
    location.hash = "#/home";
    route();
  });
}

/* ---------------- вход ---------------- */

function renderAuth() {
  document.getElementById("view").innerHTML = `
    <div class="auth">
      <div class="eyebrow">вход в кабинет</div>
      <h1 style="margin-bottom:10px">Как вас зовут?</h1>
      <p class="lead small" style="margin-bottom:22px">Телефон нужен, чтобы мастер знал, с кем говорить,
        а вы видели свои заявки. Пароль в демо не нужен.</p>
      <div class="card card-pad">
        <label class="field"><span class="label">Имя и фамилия</span>
          <input class="input" id="auth-name" placeholder="Кирилл Орлов" autocomplete="name"></label>
        <label class="field"><span class="label">Телефон</span>
          <input class="input" id="auth-phone" placeholder="+7 999 111-22-33" inputmode="tel"></label>
        <div class="grid-2" style="margin-top:16px">
          <label class="field"><span class="label">Кто вы</span>
            <select class="select" id="auth-gender">
              <option value="male">Мужчина</option>
              <option value="female">Женщина</option>
            </select></label>
          <label class="field"><span class="label">Куда писать</span>
            <select class="select" id="auth-channel">
              <option>Telegram</option><option>WhatsApp</option><option>VK</option><option>СМС</option>
            </select></label>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:20px" data-action="login">Войти</button>

        <hr class="hairline">
        <div class="eyebrow" style="margin-bottom:8px">быстрый вход в демо</div>
        <div class="quick-list">
          ${DEMO_CLIENTS.map(([n, p, g]) => `
            <button class="quick-row" data-action="quick" data-name="${esc(n)}" data-phone="${esc(p)}" data-gender="${g}">
              <span class="avatar" style="display:grid;place-items:center;font-size:13px;color:var(--copper)">${esc(n[0])}</span>
              <span class="grow">${esc(n)}<br><span class="tiny muted">${esc(p)}</span></span>
              <span class="tiny muted">войти →</span>
            </button>`).join("")}
        </div>
      </div>
    </div>`;
}

async function doLogin(name, phone, gender, channel) {
  if (!name.trim()) return toast("Введите имя", true);
  if ((phone.match(/\d/g) || []).length < 10) return toast("Введите телефон", true);
  try {
    const c = await api("/api/clients", { method: "POST", body: { name, phone, gender, channel } });
    saveClient(c);
    renderWho();
    location.hash = "#/home";
    route();
    toast(`Здравствуйте, ${c.name.split(" ")[0]}`);
  } catch (e) { toast(e.message, true); }
}

/* ---------------- главная ---------------- */

async function loadRequests() {
  state.requests = (await api(`/api/requests?client_id=${state.client.id}`)).requests;
}

function branchCard(b) {
  const wait = b.waiting ? `<span class="pill pill-in_work"><i class="dot"></i>очередь ${b.waiting}</span>` : `<span class="pill pill-ready"><i class="dot"></i>без очереди</span>`;
  return `
    <div class="card card-pad">
      <div class="row between" style="align-items:flex-start">
        <div>
          <div style="font-weight:600">${esc(b.address)}</div>
          <div class="tiny muted">${esc(b.hours)} · мастеров: ${b.masters}</div>
        </div>
        ${wait}
      </div>
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="btn btn-primary btn-sm" data-action="book-branch" data-id="${b.id}">Записаться</button>
        <button class="btn btn-ghost btn-sm" data-action="queue-branch" data-id="${b.id}">Живая очередь</button>
      </div>
    </div>`;
}

async function renderHome() {
  const view = document.getElementById("view");
  await loadRequests();
  const [tickets] = await Promise.all([api("/api/tickets")]);
  const myTickets = tickets.tickets.filter((t) => t.client_id === state.client.id && ["waiting", "called"].includes(t.status));
  const reqs = state.requests;
  const active = reqs.filter((r) => ["new", "in_work", "ready", "booked"].includes(r.status));
  const branches = state.meta.branches;
  const c = state.meta.company;

  view.innerHTML = `
    <div class="row between" style="align-items:flex-end;margin-bottom:22px">
      <div>
        <div class="eyebrow">${esc(c.tagline)} · ${esc(c.city)}</div>
        <h1 style="margin:0;font-size:36px">Здравствуйте, ${esc(state.client.name.split(" ")[0])}</h1>
        <p class="muted small" style="margin:6px 0 0">Записаться можно заранее или просто прийти — работает живая очередь.</p>
      </div>
      <a class="btn btn-primary" href="#/new">${ICONS.plus} Новая заявка</a>
    </div>

    ${myTickets.map((t) => `
      <div class="card card-pad" style="border-color:#e7cbb2;background:var(--copper-soft);margin-bottom:14px">
        <div class="row between">
          <div>
            <div class="eyebrow" style="margin-bottom:4px">живая очередь · ${esc(t.branch_code)}</div>
            <div style="font-family:var(--display);font-size:26px">Талон №${t.number}</div>
            <div class="small muted">${esc(t.service_name)}${t.status === "called" ? " · вас пригласили" : ""}</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-action="cancel-ticket" data-id="${t.id}">Отменить</button>
        </div>
      </div>`).join("")}

    ${active.length ? `<div class="eyebrow">активные</div><div class="req-list">${reqs.filter(r => active.includes(r)).map(reqCard).join("")}</div>` : ""}
    ${reqs.length > active.length ? `<div class="eyebrow" style="margin-top:22px">история</div><div class="req-list">${reqs.filter(r => !active.includes(r)).map(reqCard).join("")}</div>` : ""}
    ${reqs.length ? "" : emptyState()}

    <div class="section-head"><h2>Салоны во Владимире</h2><span class="small muted">${esc(c.hours)} · ${esc(c.phone)}</span></div>
    <div class="grid-2">${branches.slice(0, 6).map(branchCard).join("")}</div>
    <div class="hint" style="margin-top:10px">Ещё ${branches.length - 6} адресов — при записи покажем все.</div>

    <div class="section-head" style="margin-top:34px"><h2>Мастера, о которых пишут</h2>
      <span class="small muted">по открытым отзывам на Zoon и Яндекс Картах</span></div>
    <div class="grid-3">
      <div class="card card-pad">
        <div class="eyebrow" style="margin-bottom:6px">Елена</div>
        <p class="small" style="margin:0 0 8px">«По скрину из TikTok воплотила идею сына: и он, и мама в восторге».</p>
        <div class="tiny muted">гостья сети, Zoon, май 2026</div>
      </div>
      <div class="card card-pad">
        <div class="eyebrow" style="margin-bottom:6px">Татьяна</div>
        <p class="small" style="margin:0 0 8px">«Мужские стрижки топ, и длинные волосы стрижёт отлично».</p>
        <div class="tiny muted">гостья сети, Яндекс Карты, 2025</div>
      </div>
      <div class="card card-pad">
        <div class="eyebrow" style="margin-bottom:6px">Елена и Татьяна</div>
        <p class="small" style="margin:0 0 8px">«Вежливые сотрудники, приятная атмосфера, удобное расположение».</p>
        <div class="tiny muted">гостья сети, Zoon, 2026</div>
      </div>
    </div>
    <p class="hint" style="margin-top:10px">Цитаты из открытых отзывов, профили мастеров в демо вымышлены: персональные данные сотрудников не публикуем.</p>
  `;
}

function emptyState() {
  return `
    <div class="card card-pad center" style="padding:40px 24px">
      <div style="width:54px;height:54px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;background:var(--copper-soft);color:var(--copper)">${ICONS.scissors}</div>
      <h3 style="margin-bottom:6px">Пока ни одной заявки</h3>
      <p class="muted small" style="max-width:46ch;margin:0 auto 18px">Выберите салон и услугу из прайса, приложите фото и референс.
        Мастер посмотрит и предложит время.</p>
      <a class="btn btn-primary" href="#/new">Записаться</a>
    </div>`;
}

function reqCard(r) {
  const self = r.photos.find((p) => p.kind === "self") || r.photos[0];
  const when = r.appointment_at ? fmtDateTime(r.appointment_at) : `создана ${fmtAgo(r.created_at)}`;
  return `
    <div class="req-card" data-action="open" data-id="${r.id}">
      <div class="req-thumb">${self ? `<img src="${photoUrl(self.file)}" alt="">` : ""}</div>
      <div class="req-main">
        <div class="title">${esc(r.service_name)} ${r.analysis_published ? '<span class="tiny" style="color:var(--ok)">разбор готов</span>' : ""}</div>
        <div class="req-meta">
          <span>${esc(r.branch ? r.branch.address : "салон не выбран")}</span>
          <span>${esc(r.master ? r.master.name : "мастер не выбран")}</span>
          <span>${esc(when)}</span>
          ${r.price ? `<span>${money(r.price)}</span>` : ""}
        </div>
      </div>
      <div class="req-side">${statusPill(r.status, r.status_label)}</div>
    </div>`;
}

/* ---------------- визард ---------------- */

const TITLES = ["Салон", "Услуга и фото", "Анкета", "Мастер и время"];

function startWizard(opts = {}) {
  wizard = {
    step: 1,
    branchId: opts.branchId || null,
    serviceId: opts.serviceId || null,
    styleId: null,
    self: null,
    refs: [],
    wishes: "",
    masterId: null,
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    time: "12:00",
    slots: [],
    mode: "booking",
    ai: null,
    aiLoading: false,
    aiError: null,
    category: "Стрижки",
    search: "",
    q: { face: "", hair: "", density: "", texture: "", length_now: "", styling_time: "15",
         lifestyle: "work", occasion: "", allergies: "", problems: "" },
  };
  if (!location.hash.startsWith("#/new")) location.hash = "#/new";
  renderWizard();
}

function selectedService() {
  return state.meta.services.find((s) => s.id === wizard.serviceId) || null;
}
function selectedStyle() {
  return state.meta.styles.find((s) => s.id === wizard.styleId) || null;
}
function needsStyle() {
  const s = selectedService();
  return !!(s && s.needs_style);
}

function stepHasQuiz() {
  return needsStyle();
}

function renderWizard() {
  const view = document.getElementById("view");
  const w = wizard;
  const steps = TITLES.map((t, i) => ({ t, n: i + 1 }));
  view.innerHTML = `
    <div class="row between" style="margin-bottom:16px">
      <a href="#/home" class="row" style="gap:6px;text-decoration:none;color:var(--muted);font-size:14px">${ICONS.back} На главную</a>
      <span class="tiny muted">Шаг ${w.step} из ${TITLES.length}</span>
    </div>
    <div class="wizard-head">
      ${steps.map((s) => {
        const cls = s.n === w.step ? "active" : s.n < w.step ? "done" : "";
        return `<div class="wstep ${cls}"><span class="n">${s.n < w.step ? "✓" : s.n}</span><span class="lbl">${s.t}</span></div>${s.n < TITLES.length ? '<span class="wstep-sep"></span>' : ""}`;
      }).join("")}
    </div>
    <div class="panel" id="step-panel"></div>
  `;
  renderStep();
}

function renderStep() {
  const panel = document.getElementById("step-panel");
  if (wizard.step === 1) panel.innerHTML = stepBranch();
  if (wizard.step === 2) panel.innerHTML = stepService();
  if (wizard.step === 3) panel.innerHTML = stepQuestionnaire();
  if (wizard.step === 4) panel.innerHTML = stepMaster();
}

function stepNav(backDisabled, nextLabel = "Далее") {
  return `
    <div class="row between" style="margin-top:24px">
      <button class="btn btn-ghost" data-action="back" ${backDisabled ? "disabled" : ""}>${ICONS.back} Назад</button>
      <button class="btn btn-primary" data-action="${wizard.step === 4 ? "submit" : "next"}">${esc(wizard.step === 4 ? "Отправить" : nextLabel)} ${ICONS.arrow}</button>
    </div>`;
}

function stepBranch() {
  const w = wizard;
  return `
    <h2>Выберите салон</h2>
    <p class="lead">Владимир, ${state.meta.branches.length} адресов. Работаем ежедневно 09:00–21:00,
      можно записаться заранее или прийти в живую очередь.</p>
    <div class="grid-2">
      ${state.meta.branches.map((b) => `
        <button class="style-card ${w.branchId === b.id ? "sel" : ""}" data-branch="${b.id}" style="text-align:left">
          <span class="nm">${esc(b.address)} <span class="tiny muted">${esc(b.hours)}</span></span>
          <span class="tl">${b.code}${b.waiting ? ` · в очереди ${b.waiting}` : " · очереди нет"}</span>
        </button>`).join("")}
    </div>
    ${stepNav(true)}
  `;
}

function stepService() {
  const w = wizard;
  const cats = state.meta.service_categories;
  const list = state.meta.services.filter((s) => s.category === w.category)
    .filter((s) => !w.search || s.name.toLowerCase().includes(w.search.toLowerCase()));
  const svc = selectedService();
  const style = selectedStyle();
  return `
    <h2>Услуга</h2>
    <p class="lead">Прайс сети. Для стрижек мастер заранее разберёт форму по фото и референсу.</p>

    <div class="row" style="margin-bottom:12px">
      <div class="row" style="gap:6px;flex-wrap:wrap">
        ${cats.map((c) => `<button class="tab ${w.category === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
      <input class="input" id="svc-search" placeholder="Поиск услуги" style="max-width:220px;margin-left:auto" value="${esc(w.search)}">
    </div>

    <div class="style-grid">
      ${list.map((s) => `
        <button class="style-card ${s.id === w.serviceId ? "sel" : ""}" data-service="${s.id}">
          <span class="nm">${esc(s.name)} <span class="tiny muted nowrap">${s.minutes} мин</span></span>
          <span class="pr">${money(s.price)}${s.price_to ? " – " + money(s.price_to) : ""}${s.note ? " · " + esc(s.note) : ""}</span>
        </button>`).join("")}
    </div>

    ${svc && svc.needs_style ? `
      <hr class="hairline">
      <h4 style="margin-bottom:4px">Форма стрижки</h4>
      <p class="tiny muted" style="margin-bottom:10px">Выберите, к чему стремитесь. Мастер подтвердит или предложит альтернативу.</p>
      <div class="row" style="gap:8px;margin-bottom:12px">
        <button class="tab ${!w.styleId ? "active" : ""}" data-style="">Не знаю</button>
        ${state.meta.styles.filter((s) => (state.client.gender === "female" ? s.gender === "female" : s.gender === "male"))
          .map((s) => `<button class="tab ${w.styleId === s.id ? "active" : ""}" data-style="${s.id}">${esc(s.name)}</button>`).join("")}
      </div>
    ` : ""}

    ${svc ? `
      <hr class="hairline">
      <h4 style="margin-bottom:8px">Фото</h4>
      <div class="grid-2" style="gap:12px;align-items:start">
        <label class="dropzone" style="min-height:140px">
          <input type="file" accept="image/*" capture="user" data-upload="self" hidden>
          <span style="color:var(--copper)">${ICONS.camera}</span>
          <strong class="small">Фото себя</strong>
          <span class="tiny">анфас, дневной свет</span>
        </label>
        <label class="dropzone" style="min-height:140px">
          <input type="file" accept="image/*" data-upload="ref" hidden>
          <span style="color:var(--copper)">${ICONS.image}</span>
          <strong class="small">Референс${svc.needs_photo ? "" : " (не обязательно)"}</strong>
          <span class="tiny">что хотите получить</span>
        </label>
      </div>
      <div class="photo-grid" style="margin-top:10px">
        ${w.self ? `<div class="photo"><img src="${w.self}" alt=""><span class="photo-tag">вы</span><button class="photo-del" data-action="remove-self">×</button></div>` : ""}
        ${w.refs.map((r, i) => `<div class="photo"><img src="${r}" alt=""><span class="photo-tag">реф</span><button class="photo-del" data-action="remove-ref" data-i="${i}">×</button></div>`).join("")}
      </div>
      ${w.aiLoading ? `<div class="card card-pad" style="margin-top:14px;background:var(--copper-soft)">
          <div class="row" style="gap:10px"><span class="pill pill-in_work">${ICONS.spark} ИИ смотрит фото…</span>
          <span class="tiny muted">локальная модель считает форму лица и тип волос</span></div></div>` : ""}
      ${w.ai ? visionBlock(w.ai) : ""}
      ${w.aiError ? `<p class="hint" style="margin-top:10px">${esc(w.aiError)}</p>` : ""}

      <label class="field" style="margin-top:16px"><span class="label">Пожелания</span>
        <textarea class="textarea" data-field="wishes" placeholder="Например: хочу короче виски, но чёлку не трогать">${esc(w.wishes)}</textarea></label>
    ` : ""}

    ${stepNav(false)}
  `;
}

function visionBlock(a) {
  const d = a.data || {};
  const chip = (label, value) => value
    ? `<span class="tag">${esc(label)}: ${esc(value)}</span>` : "";
  const map = {
    face: state.meta.face, hair: state.meta.hair, density: state.meta.density, length: state.meta.length,
  };
  const chips = [
    chip("Лицо", map.face[d.face]),
    chip("Волосы", map.hair[d.hair]),
    chip("Густота", map.density[d.density]),
    chip("Длина", map.length[d.length]),
  ].filter(Boolean).join("");
  return `
    <div class="card card-pad" style="margin-top:14px">
      <div class="row between" style="margin-bottom:8px">
        <div class="row" style="gap:8px">${ICONS.spark}<b>ИИ посмотрел фото</b>
          <span class="tiny muted">${esc(a.model || "")} · уверенность ${Math.round((a.confidence || 0) * 100)}%</span></div>
        <button class="btn btn-ghost btn-xs" data-action="dismiss-ai">Скрыть</button>
      </div>
      <div class="row" style="gap:6px">${chips || '<span class="tiny muted">модель не разобрала детали</span>'}</div>
      ${d.notes ? `<p class="tiny muted" style="margin:10px 0 0">${esc(d.notes)}</p>` : ""}
      ${chips ? `<button class="btn btn-soft btn-sm" style="margin-top:12px" data-action="apply-ai">Применить к анкете</button>` : ""}
      <p class="hint" style="margin-top:8px">Это подсказка, мастер всё равно проверит фото.</p>
    </div>`;
}

async function runVision(dataUrl) {
  if (!state.meta.vision) return;
  wizard.aiLoading = true;
  wizard.aiError = null;
  wizard.ai = null;
  renderStep();
  try {
    const res = await api("/api/vision", { method: "POST", body: { image: dataUrl } });
    if (res.ok) wizard.ai = res;
    else wizard.aiError = res.error || "ИИ недоступен";
  } catch (err) {
    wizard.aiError = "ИИ недоступен: " + err.message;
  }
  wizard.aiLoading = false;
  renderStep();
}

function stepQuestionnaire() {
  const w = wizard;
  const opts = (list, cur) => Object.entries(list).map(([k, v]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${esc(v)}</option>`).join("");
  return `
    <h2>Анкета для разбора</h2>
    <p class="lead">По этим ответам мастер соберёт разбор: что подойдёт, что нет и как стричь.</p>
    <div class="grid-2">
      <label class="field"><span class="label">Форма лица</span>
        <select class="select" data-q="face"><option value="">Не знаю</option>${opts(state.meta.face, w.q.face)}</select></label>
      <label class="field"><span class="label">Тип волос</span>
        <select class="select" data-q="hair"><option value="">Не знаю</option>${opts(state.meta.hair, w.q.hair)}</select></label>
      <label class="field"><span class="label">Густота</span>
        <select class="select" data-q="density"><option value="">Не знаю</option>${opts(state.meta.density, w.q.density)}</select></label>
      <label class="field"><span class="label">Жёсткость</span>
        <select class="select" data-q="texture"><option value="">Не знаю</option>${opts(state.meta.texture, w.q.texture)}</select></label>
      <label class="field"><span class="label">Длина сейчас</span>
        <select class="select" data-q="length_now"><option value="">Не знаю</option>${opts(state.meta.length, w.q.length_now)}</select></label>
      <label class="field"><span class="label">Время на укладку</span>
        <select class="select" data-q="styling_time">${opts(state.meta.styling, w.q.styling_time)}</select></label>
    </div>
    <label class="field"><span class="label">Ограничения</span>
      <input class="input" data-q="allergies" placeholder="Аллергии, чувствительность кожи" value="${esc(w.q.allergies)}"></label>
    <label class="field"><span class="label">Особенности волос</span>
      <input class="input" data-q="problems" placeholder="Секущиеся концы, жёсткая щетина" value="${esc(w.q.problems)}"></label>
    ${stepNav(false)}
  `;
}

async function refreshSlots() {
  if (!wizard || !wizard.masterId) { if (wizard) wizard.slots = []; return; }
  try {
    const result = await api(`/api/slots?master_id=${wizard.masterId}&date=${encodeURIComponent(wizard.date)}`);
    wizard.slots = result.slots;
  } catch (err) {
    wizard.slots = [];
    toast(err.message, true);
  }
}

function stepMaster() {
  const w = wizard;
  const svc = selectedService();
  const masters = state.meta.masters.filter((m) => !w.branchId || m.branch_id === w.branchId);
  const slots = w.slots || [];
  return `
    <h2>Мастер и время</h2>
    <p class="lead">${w.mode === "queue" ? "Возьмите талон и приходите — вас примут в порядке очереди." : "Выберите мастера и удобное время, он подтвердит запись."}</p>

    <div class="row" style="gap:6px;margin-bottom:16px">
      <button class="tab ${w.mode === "booking" ? "active" : ""}" data-mode="booking">Запись на время</button>
      <button class="tab ${w.mode === "queue" ? "active" : ""}" data-mode="queue">Живая очередь</button>
    </div>

    ${w.mode === "booking" ? `
      <div class="grid-2" style="margin-bottom:16px">
        <label class="field"><span class="label">Дата</span>
          <input class="input" type="date" data-field="date" value="${esc(w.date)}" min="${new Date().toISOString().slice(0, 10)}"></label>
      </div>
    ` : ""}

    <div class="grid-2">
      ${masters.map((m) => `
        <button class="style-card ${w.masterId === m.id ? "sel" : ""}" data-master="${m.id}" style="text-align:left">
          <span class="row" style="gap:10px">
            ${avatarImg(m)}
            <span><b>${esc(m.name)}</b><br><span class="tiny muted">${esc(m.role)}${w.mode === "queue" ? "" : " · ★ " + m.rating}</span></span>
          </span>
          <span class="tl" style="display:block;margin-top:8px">${esc(m.bio)}</span>
        </button>`).join("")}
    </div>

    ${w.mode === "booking" ? `<hr class="hairline"><h4>Свободное время</h4>
      ${w.masterId ? (slots.length
        ? `<div class="row" style="gap:8px;flex-wrap:wrap">${slots.map((t) => `<button class="tab ${w.time === t ? "active" : ""}" data-slot="${t}">${t}</button>`).join("")}</div>`
        : '<p class="hint">На эту дату свободных окон нет.</p>')
        : '<p class="hint">Выберите мастера, чтобы увидеть его расписание.</p>'}` : ""}

    ${w.mode === "booking" && !w.masterId ? '<p class="hint" style="margin-top:12px">Можно не выбирать: заявку возьмёт свободный мастер салона.</p>' : ""}

    <hr class="hairline">
    <div class="small muted">
      ${svc ? `${esc(svc.name)} · ${money(svc.price)}${svc.price_to ? "–" + money(svc.price_to) : ""} · ${svc.minutes} мин` : ""}
      ${w.mode === "queue" ? "<br>Талон действует сегодня, подходить лучше сразу." : ""}
    </div>
    ${stepNav(false)}
  `;
}

function validateStep() {
  const w = wizard;
  if (w.step === 1 && !w.branchId) return "Выберите салон";
  if (w.step === 2) {
    if (!w.serviceId) return "Выберите услугу";
    if (needsStyle() && !w.styleId) return "Выберите форму стрижки";
    if (needsStyle() && !w.self) return "Добавьте фото себя";
  }
  if (w.step === 3 && (!w.q.face || !w.q.hair || !w.q.density)) return "Заполните форму лица, тип и густоту волос";
  if (w.step === 4 && w.mode === "booking" && (!w.masterId || !w.time)) return "Выберите мастера и свободное время";
  return null;
}

async function submitWizard(btn) {
  const w = wizard;
  const svc = selectedService();
  btn.disabled = true;
  try {
    if (w.mode === "queue") {
      const ticket = await api("/api/tickets", { method: "POST", body: {
        client_id: state.client.id, branch_id: w.branchId, service_id: w.serviceId } });
      wizard = null;
      toast(`Талон №${ticket.number} · ждите ${ticket.wait_minutes || 0} мин`);
      location.hash = "#/home";
      return;
    }
    const payload = {
      client_id: state.client.id,
      master_id: w.masterId,
      branch_id: w.branchId,
      service_id: w.serviceId,
      style_id: needsStyle() ? w.styleId : null,
      wishes: w.wishes,
      appointment_at: `${w.date}T${w.time}:00`,
      questionnaire: w.q,
      ai: w.ai ? { model: w.ai.model, confidence: w.ai.confidence, data: w.ai.data, notes: (w.ai.data || {}).notes } : null,
      photos: [{ kind: "self", data: w.self }, ...w.refs.map((r) => ({ kind: "ref", data: r }))].filter((p) => p.data),
    };
    const created = await api("/api/requests", { method: "POST", body: payload });
    wizard = null;
    toast("Заявка отправлена. Мастер сделает разбор.");
    location.hash = `#/request/${created.id}`;
  } catch (e) {
    toast(e.message, true);
    btn.disabled = false;
  }
}

/* ---------------- карточка заявки ---------------- */

async function renderRequest(id) {
  const view = document.getElementById("view");
  view.innerHTML = `<div class="muted small">Загружаем заявку…</div>`;
  let r;
  try {
    r = await api(`/api/requests/${id}`);
  } catch (e) {
    view.innerHTML = `<div class="card card-pad">${esc(e.message)}. <a href="#/home">К списку</a></div>`;
    return;
  }

  const self = r.photos.find((p) => p.kind === "self");
  const refs = r.photos.filter((p) => p.kind === "ref");
  const published = r.analysis && r.analysis.published;
  const preview = state.preview[id];
  const q = r.questionnaire || {};

  view.innerHTML = `
    <a href="#/home" class="row" style="gap:6px;text-decoration:none;color:var(--muted);font-size:14px">${ICONS.back} Мои заявки</a>

    <div class="row between" style="margin:14px 0 22px;align-items:flex-end">
      <div>
        <div class="eyebrow">заявка №${r.id} · ${esc(fmtAgo(r.created_at))}</div>
        <h1 style="margin:0;font-size:34px">${esc(r.service_name)}</h1>
        <p class="muted small" style="margin:6px 0 0">${esc(r.branch ? r.branch.address : "")}${r.master ? " · " + esc(r.master.name) : ""}${r.appointment_at ? " · " + esc(fmtDateTime(r.appointment_at)) : ""}${r.price ? " · " + money(r.price) : ""}</p>
      </div>
      ${statusPill(r.status, r.status_label)}
    </div>

    <div class="detail-grid">
      <div class="stack">
        <div class="card card-pad">
          <div class="row between" style="margin-bottom:12px">
            <h3 style="margin:0">Фото</h3>
            <span class="tiny muted">нажмите, чтобы увеличить</span>
          </div>
          <div class="photo-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
            ${self ? `<div class="photo" data-zoom="${photoUrl(self.file)}"><img src="${photoUrl(self.file)}" alt="Ваше фото"><span class="photo-tag">вы</span></div>` : ""}
            ${refs.map((p) => `<div class="photo" data-zoom="${photoUrl(p.file)}"><img src="${photoUrl(p.file)}" alt="Референс"><span class="photo-tag">референс</span></div>`).join("")}
          </div>
          ${r.wishes ? `<p class="small" style="margin:16px 0 0"><span class="muted">Пожелания:</span> ${esc(r.wishes)}</p>` : ""}
        </div>

        ${published ? `
          <div class="card">
            <div class="card-head"><h3>Разбор от мастера</h3><span class="pill pill-ready" style="margin-left:auto">${ICONS.check} опубликован</span></div>
            <div class="card-body">${renderAnalysis(r.analysis)}</div>
          </div>
        ` : preview ? `
          <div class="card">
            <div class="card-head"><h3>Предварительный разбор</h3><span class="pill pill-in_work" style="margin-left:auto">не подтверждён мастером</span></div>
            <div class="card-body">
              <p class="small muted" style="margin-top:0">Это автоматическая оценка по вашей анкете. Мастер посмотрит фото и уточнит детали.</p>
              ${renderAnalysis(preview)}
            </div>
          </div>
        ` : ""}
      </div>

      <div class="detail-col">
        ${actionCard(r)}
        ${questionnaireCard(q)}
        ${timelineCard(r.events)}
      </div>
    </div>
  `;

  $$("[data-zoom]").forEach((el) => el.addEventListener("click", () => lightbox(el.dataset.zoom)));
}

function actionCard(r) {
  if (r.status === "new" || r.status === "in_work") {
    return `
      <div class="card card-pad">
        <div class="eyebrow">что дальше</div>
        <h3 style="margin-bottom:8px">Мастер готовит разбор</h3>
        <p class="small muted">Смотрит фото, сверяет с анкетой и собирает технику. Обычно 15–30 минут.</p>
        <button class="btn btn-soft btn-block" data-action="preview" data-id="${r.id}">Посмотреть предварительную оценку</button>
        <div class="row" style="margin-top:12px">${ICONS.clock}<span class="tiny muted">Статус обновится автоматически при следующем открытии</span></div>
      </div>`;
  }
  if (r.status === "ready") {
    return `
      <div class="card card-pad">
        <div class="eyebrow">всё готово</div>
        <h3 style="margin-bottom:8px">Разбор готов</h3>
        <p class="small muted">Мастер предлагает время:</p>
        <div class="meta" style="margin-bottom:16px"><div class="k">Запись</div><div class="v">${esc(fmtDateTime(r.appointment_at))}</div></div>
        <button class="btn btn-primary btn-block" data-action="confirm" data-id="${r.id}">${ICONS.check} Подтвердить запись</button>
        <div class="hint" style="margin-top:10px">Если время не подходит, позвоните: ${esc((r.master && r.master.phone) || "менеджеру салона")}</div>
      </div>`;
  }
  if (r.status === "booked") {
    return `
      <div class="card card-pad">
        <div class="eyebrow">вы записаны</div>
        <h3 style="margin-bottom:8px">${esc(fmtDateTime(r.appointment_at))}</h3>
        <p class="small muted">Мастер: ${esc(r.master ? r.master.name : "—")}. Приходите за 5 минут, возьмите фото-референс.</p>
        <div class="row" style="gap:8px">${ICONS.calendar}<span class="small">Ждём вас</span></div>
      </div>`;
  }
  if (r.status === "done") {
    return `
      <div class="card card-pad">
        <div class="eyebrow">услуга выполнена</div>
        <h3 style="margin-bottom:8px">${esc(money(r.price_final))}</h3>
        ${r.rating ? `
          <div class="row" style="margin-bottom:6px">${[1,2,3,4,5].map((i) => `<span class="star ${i <= r.rating ? "on" : ""}" style="font-size:20px;width:22px;height:22px">★</span>`).join("")}</div>
          <p class="small muted" style="margin:6px 0 0">«${esc(r.review || "")}»</p>
        ` : `
          <p class="small muted">Как всё прошло? Оценка уходит мастеру и владельцу сети.</p>
          <button class="btn btn-primary btn-block" data-action="review" data-id="${r.id}">Оценить услугу</button>
        `}
      </div>`;
  }
  return `
    <div class="card card-pad">
      <div class="eyebrow">заявка закрыта</div>
      <h3 style="margin-bottom:8px">Не получилось</h3>
      <p class="small muted">Мастер отклонил заявку. Можно собрать новую.</p>
      <a class="btn btn-ghost btn-block" href="#/new">Новая заявка</a>
    </div>`;
}

function questionnaireCard(q) {
  const rows = [
    ["Форма лица", state.meta.face[q.face]],
    ["Волосы", state.meta.hair[q.hair]],
    ["Густота", state.meta.density[q.density]],
    ["Жёсткость", state.meta.texture[q.texture]],
    ["Длина", state.meta.length[q.length_now]],
    ["Укладка", state.meta.styling[q.styling_time]],
    ["Бюджет", q.budget ? money(q.budget) : ""],
    ["Повод", q.occasion],
    ["Ограничения", q.allergies],
    ["Особенности", q.problems],
  ].filter(([, v]) => v);
  return `
    <div class="card card-pad">
      <div class="eyebrow">анкета</div>
      <dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    </div>`;
}

function timelineCard(events) {
  return `
    <div class="card card-pad">
      <div class="eyebrow">история</div>
      <div class="timeline">
        ${events.map((e) => `
          <div class="tl-item">
            <span class="tl-dot"></span>
            <div><div class="tl-text">${esc(EVENT_LABELS[e.kind] || e.text)}</div>
            <div class="tl-at">${esc(fmtDateTime(e.at))}</div></div>
          </div>`).join("")}
      </div>
    </div>`;
}

/* ---------------- действия ---------------- */

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (el) {
    const action = el.dataset.action;

    if (action === "login") {
      return doLogin($("#auth-name").value, $("#auth-phone").value, $("#auth-gender").value, $("#auth-channel").value);
    }
    if (action === "quick") {
      $("#auth-name").value = el.dataset.name;
      $("#auth-phone").value = el.dataset.phone;
      return doLogin(el.dataset.name, el.dataset.phone, el.dataset.gender, "Telegram");
    }
    if (action === "book-branch") {
      startWizard({ branchId: Number(el.dataset.id) });
      return;
    }
    if (action === "queue-branch") {
      startWizard({ branchId: Number(el.dataset.id) });
      wizard.mode = "queue";
      wizard.step = 2;
      renderWizard();
      return;
    }
    if (action === "cancel-ticket") {
      try {
        await api(`/api/tickets/${el.dataset.id}/status`, { method: "POST", body: { status: "cancelled" } });
        toast("Талон отменён");
        renderHome();
      } catch (err) { toast(err.message, true); }
      return;
    }
    if (action === "open") {
      location.hash = `#/request/${el.dataset.id}`;
      return;
    }
    if (action === "next") {
      const err = validateStep();
      if (err) return toast(err, true);
      let next = wizard.step + 1;
      if (next === 3 && !stepHasQuiz()) next = 4;
      wizard.step = Math.min(4, next);
      renderWizard();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (action === "back") {
      if (wizard.step === 1) { wizard = null; location.hash = "#/home"; return; }
      let prev = wizard.step - 1;
      if (prev === 3 && !stepHasQuiz()) prev = 2;
      wizard.step = Math.max(1, prev);
      renderWizard();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (action === "remove-self") { wizard.self = null; renderStep(); return; }
    if (action === "reupload-self") { wizard.self = null; renderStep(); setTimeout(() => $('[data-upload="self"]') && $('[data-upload="self"]').click(), 30); return; }
    if (action === "remove-ref") { wizard.refs.splice(Number(el.dataset.i), 1); renderStep(); return; }
    if (action === "dismiss-ai") { wizard.ai = null; renderStep(); return; }
    if (action === "apply-ai") {
      const d = (wizard.ai && wizard.ai.data) || {};
      ["face", "hair", "density", "length"].forEach((k) => {
        if (d[k] && state.meta[k === "length" ? "length" : k]) wizard.q[k === "length" ? "length_now" : k] = d[k];
      });
      toast("Подставил ответы ИИ, проверьте анкету");
      renderStep();
      return;
    }
    if (action === "submit") { return submitWizard(el); }
    if (action === "preview") {
      el.disabled = true;
      el.textContent = "Считаем…";
      try {
        const r = await api(`/api/requests/${el.dataset.id}`);
        const a = await api(`/api/requests/${r.id}/preview`, { method: "POST", body: { style_id: r.style_id, questionnaire: r.questionnaire } });
        state.preview[r.id] = a;
        renderRequest(r.id);
        window.scrollTo({ top: 260, behavior: "smooth" });
      } catch (err) { toast(err.message, true); el.disabled = false; }
      return;
    }
    if (action === "confirm") {
      el.disabled = true;
      try {
        await api(`/api/requests/${el.dataset.id}/action`, { method: "POST", body: { action: "confirm" } });
        toast("Запись подтверждена");
        renderRequest(Number(el.dataset.id));
      } catch (err) { toast(err.message, true); el.disabled = false; }
      return;
    }
    if (action === "review") {
      const res = await askReview();
      if (!res) return;
      try {
        await api(`/api/requests/${el.dataset.id}/review`, { method: "POST", body: res });
        toast("Спасибо за отзыв");
        renderRequest(Number(el.dataset.id));
      } catch (err) { toast(err.message, true); }
      return;
    }
  }

  const br = e.target.closest("[data-branch]");
  if (br) { wizard.branchId = Number(br.dataset.branch); wizard.masterId = null; renderStep(); return; }

  const cat = e.target.closest("[data-cat]");
  if (cat) { wizard.category = cat.dataset.cat; renderStep(); return; }

  const svc = e.target.closest("[data-service]");
  if (svc) {
    wizard.serviceId = svc.dataset.service;
    const item = state.meta.services.find((x) => x.id === wizard.serviceId);
    if (item && !item.needs_style) { wizard.styleId = null; wizard.self = null; }
    renderStep();
    return;
  }

  const mode = e.target.closest("[data-mode]");
  if (mode) { wizard.mode = mode.dataset.mode; renderStep(); return; }

  const s = e.target.closest("[data-style]");
  if (s !== null && s && s.dataset.style !== undefined) {
    wizard.styleId = s.dataset.style || null;
    renderStep();
    return;
  }

  const m = e.target.closest("[data-master]");
  if (m) { wizard.masterId = Number(m.dataset.master); wizard.time = ""; await refreshSlots(); renderStep(); return; }
  const slot = e.target.closest("[data-slot]");
  if (slot) { wizard.time = slot.dataset.slot; renderStep(); return; }
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.upload) {
    const file = t.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Нужно изображение", true);
    try {
      const data = await compressImage(file);
      if (t.dataset.upload === "self") {
        wizard.self = data;
        t.value = "";
        renderStep();
        runVision(data);
        return;
      }
      else {
        if (wizard.refs.length >= 2) { t.value = ""; return toast("Максимум 2 референса", true); }
        wizard.refs.push(data);
      }
      t.value = "";
      renderStep();
    } catch (err) { toast("Не удалось прочитать файл", true); }
    return;
  }
  if (t.dataset.q) { wizard.q[t.dataset.q] = t.value; return; }
  if (t.dataset.field) {
    wizard[t.dataset.field] = t.value;
    if (t.dataset.field === "date") { wizard.time = ""; await refreshSlots(); renderStep(); }
    return;
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "svc-search") {
    wizard.search = e.target.value;
    const cards = $$(".style-card[data-service]");
    cards.forEach((c) => {
      const txt = c.textContent.toLowerCase();
      c.style.display = txt.includes(wizard.search.toLowerCase()) ? "" : "none";
    });
  }
});

})();

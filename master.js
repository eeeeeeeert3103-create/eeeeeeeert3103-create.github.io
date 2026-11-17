(function () {
"use strict";
/* ГРАНИ — рабочее место мастера */

const { $, $$, esc, money, api, toast, lightbox, fmtDateTime, fmtDay, fmtAgo,
  statusPill, renderAnalysis, photoUrl, ICONS } = window.G;

const LS_MASTER = "grani_master_v1";
const EVENT_LABELS = {
  new: "Клиент отправил заявку", open: "Мастер открыл заявку", analysis: "Разбор опубликован",
  booking: "Клиент подтвердил запись", done: "Услуга выполнена", review: "Клиент оставил отзыв",
  declined: "Заявка отклонена", reschedule: "Время перенесено", draft: "Черновик разбора",
};
const VERDICT_TITLES = { recommended: "Подходит", conditional: "Подходит с поправками", not_recommended: "Не рекомендую в этом виде" };

const state = { meta: null, masterId: null, list: [], tickets: [], current: null, filter: "all", search: "", onlyMine: true, editing: false, draft: null };

/* ---------------- старт ---------------- */

(async function init() {
  try { state.meta = await api("/api/meta"); }
  catch (e) {
    document.getElementById("view").innerHTML = `<div class="card card-pad">Сервер не отвечает. Запустите <b>python3 app.py</b>.</div>`;
    return;
  }
  const saved = Number(localStorage.getItem(LS_MASTER) || 0);
  state.masterId = state.meta.masters.some((m) => m.id === saved) ? saved : state.meta.masters[0].id;

  const sel = document.getElementById("master-select");
  sel.innerHTML = state.meta.masters.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
  sel.value = state.masterId;
  sel.addEventListener("change", () => {
    state.masterId = Number(sel.value);
    localStorage.setItem(LS_MASTER, state.masterId);
    route();
  });

  document.getElementById("today").textContent = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });

  document.getElementById("side-nav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-route]");
    if (!b) return;
    location.hash = b.dataset.route === "report" ? "#/report" : "#/queue";
  });

  window.addEventListener("hashchange", route);
  route();
})();

function route() {
  const hash = location.hash || "#/queue";
  markNav(hash);
  if (hash.startsWith("#/request/")) {
    const parts = hash.split("/");
    if (parts[3] === "edit") state.editing = true;
    return renderDetail(Number(parts[2]));
  }
  if (hash.startsWith("#/report")) return renderReport();
  return renderQueue();
}

function markNav(hash) {
  $$("#side-nav [data-route]").forEach((b) => {
    const r = b.dataset.route;
    b.classList.toggle("active", (r === "report" && hash.startsWith("#/report")) || (r === "queue" && !hash.startsWith("#/report") && !hash.startsWith("#/request")));
  });
  if (hash.startsWith("#/request/")) $$("#side-nav [data-route]").forEach((b) => b.classList.remove("active"));
}

/* ---------------- очередь ---------------- */

async function fetchList() {
  const { requests } = await api("/api/requests");
  state.list = requests;
  return requests;
}

function masterName(id) {
  const m = state.meta.masters.find((x) => x.id === id);
  return m ? m.name.split(" ")[0] : "—";
}

async function fetchTickets(branchId) {
  const data = await api(`/api/tickets?branch_id=${branchId}`);
  state.tickets = data.tickets.filter((t) => t.status !== "cancelled" && t.status !== "done");
  return state.tickets;
}

function ticketsPanel(branch) {
  const list = state.tickets || [];
  if (!list.length) return "";
  return `
    <div class="card" style="margin-bottom:20px">
      <div class="card-head">
        <h3>Живая очередь · ${esc(branch ? branch.code : "")}</h3>
        <span class="pill pill-in_work" style="margin-left:auto"><i class="dot"></i>ждут ${list.filter(t => t.status === "waiting").length}</span>
      </div>
      <div class="card-body" style="padding:14px 22px">
        ${list.map((t) => `
          <div class="row between" style="padding:10px 0;border-bottom:1px solid var(--line)">
            <div class="row" style="gap:12px">
              <span class="pill ${t.status === "called" ? "pill-ready" : ""}">№${t.number}</span>
              <div>
                <div class="small"><b>${esc(t.client_name)}</b></div>
                <div class="tiny muted">${esc(t.service_name)} · ${esc(t.branch_code)}</div>
              </div>
            </div>
            <div class="row" style="gap:6px">
              ${t.status === "waiting"
                ? `<button class="btn btn-ghost btn-xs" data-ticket="${t.id}" data-tstatus="called">Пригласить</button>`
                : `<button class="btn btn-primary btn-xs" data-ticket="${t.id}" data-tstatus="done">Завершить</button>`}
            </div>
          </div>`).join("")}
      </div>
    </div>`;
}

async function renderQueue() {
  const view = document.getElementById("view");
  view.innerHTML = `<div class="muted small">Загружаем очередь…</div>`;
  await fetchList();
  const myBranch = (state.meta.masters.find((m) => m.id === state.masterId) || {}).branch_id;
  await fetchTickets(myBranch || 1);
  const mine = state.list.filter((r) => r.master_id === state.masterId);
  const counts = { new: 0, in_work: 0, ready: 0, booked: 0, done: 0 };
  mine.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status] += 1; });
  const master = state.meta.masters.find((m) => m.id === state.masterId);

  let list = state.onlyMine ? mine : state.list;
  if (state.filter !== "all") list = list.filter((r) => r.status === state.filter);
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter((r) => (r.client.name + " " + r.style_name).toLowerCase().includes(q));
  }

  const tabs = [["all", "Все"], ["new", "Новые"], ["in_work", "В разборе"], ["ready", "Готовые"], ["booked", "Записи"], ["done", "Выполненные"]];

  view.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">сегодня</div>
        <h1>Очередь заявок</h1>
        <div class="sub">${esc(master.name)} · ${esc(master.role.replace("·", "—"))}</div>
      </div>
      <div class="row">
        <label class="row" style="gap:8px;font-size:13px;color:var(--muted);cursor:pointer">
          <input type="checkbox" id="only-mine" ${state.onlyMine ? "checked" : ""}> только мои
        </label>
        <a class="btn btn-ghost btn-sm" href="./client.html">Кабинет клиента</a>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat ${counts.new ? "alert" : ""}"><div class="k">Новые</div><div class="v">${counts.new}</div></div>
      <div class="stat"><div class="k">В разборе</div><div class="v">${counts.in_work}</div></div>
      <div class="stat"><div class="k">Разбор готов</div><div class="v">${counts.ready}</div></div>
      <div class="stat"><div class="k">Записи</div><div class="v">${counts.booked}</div></div>
    </div>

    ${ticketsPanel(state.meta.branches.find((b) => b.id === myBranch))}

    <div class="row" style="margin-bottom:12px;gap:10px">
      <div class="tabs" style="margin:0">
        ${tabs.map(([k, l]) => `<button class="tab ${state.filter === k ? "active" : ""}" data-filter="${k}">${l}</button>`).join("")}
      </div>
      <input class="input" id="queue-search" placeholder="Поиск по клиенту или стрижке" style="max-width:280px;margin-left:auto" value="${esc(state.search)}">
    </div>

    <div class="queue">
      ${list.length ? list.map(qrow).join("") : `<div class="card card-pad center muted small">Здесь пусто. Смените фильтр или дождитесь новых заявок.</div>`}
    </div>
  `;

  document.getElementById("only-mine").addEventListener("change", (e) => {
    state.onlyMine = e.target.checked;
    renderQueue();
  });
  $$("[data-filter]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.filter; renderQueue(); }));
  const search = document.getElementById("queue-search");
  search.addEventListener("input", (e) => {
    state.search = e.target.value.toLowerCase();
    $$(".qrow").forEach((row) => {
      row.style.display = row.dataset.q.includes(state.search) ? "" : "none";
    });
  });
  $$(".qrow").forEach((row) => row.addEventListener("click", () => { location.hash = `#/request/${row.dataset.id}`; }));
  $$("[data-ticket]").forEach((b) => b.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await api(`/api/tickets/${b.dataset.ticket}/status`, { method: "POST", body: { status: b.dataset.tstatus } });
      toast(b.dataset.tstatus === "called" ? "Клиент приглашён" : "Талон закрыт");
      renderQueue();
    } catch (err) { toast(err.message, true); }
  }));

  const cnt = document.getElementById("cnt-new");
  if (cnt) cnt.textContent = mine.filter((r) => r.status === "new").length || "";
}

function qrow(r) {
  const self = r.photos.find((p) => p.kind === "self") || r.photos[0];
  const when = r.appointment_at ? fmtDateTime(r.appointment_at) : fmtAgo(r.created_at);
  return `
    <div class="qrow" data-id="${r.id}" data-q="${esc((r.client.name + " " + r.service_name).toLowerCase())}">
      <div class="ph">${self ? `<img src="${photoUrl(self.file)}" alt="">` : ""}</div>
      <div>
        <div class="who">${esc(r.client.name)} ${r.rating ? `<span class="tiny" style="color:var(--brass)">★ ${r.rating}</span>` : ""}</div>
        <div class="what">${esc(r.service_name)}${r.branch ? " · " + esc(r.branch.code) : ""}${!state.onlyMine ? " · " + esc(masterName(r.master_id)) : ""}${r.analysis_published ? " · разбор отправлен" : r.has_analysis ? " · черновик" : ""}</div>
      </div>
      <div class="qside">
        <span class="when">${esc(when)}</span>
        ${statusPill(r.status, r.status_label)}
      </div>
    </div>`;
}

/* ---------------- карточка заявки ---------------- */

async function renderDetail(id) {
  const view = document.getElementById("view");
  view.innerHTML = `<div class="muted small">Загружаем заявку…</div>`;
  let r;
  try { r = await api(`/api/requests/${id}`); }
  catch (e) { view.innerHTML = `<div class="card card-pad">${esc(e.message)}. <a href="#/queue">К очереди</a></div>`; return; }
  if (state.current && state.current.id !== r.id) { state.editing = false; state.draft = null; }
  state.current = r;
  if (state.editing && !state.draft) {
    state.draft = r.analysis ? clone(r.analysis)
      : await api(`/api/requests/${r.id}/preview`, { method: "POST", body: { style_id: r.style_id, questionnaire: r.questionnaire } });
  }

  const q = r.questionnaire || {};
  const self = r.photos.find((p) => p.kind === "self");
  const refs = r.photos.filter((p) => p.kind === "ref");
  const when = r.appointment_at ? fmtDateTime(r.appointment_at) : "не назначено";

  view.innerHTML = `
    <div class="row between" style="margin-bottom:16px">
      <a href="#/queue" class="row" style="gap:6px;text-decoration:none;color:var(--muted);font-size:14px">${ICONS.back} Очередь</a>
      <span class="tiny muted">заявка №${r.id} · ${esc(fmtAgo(r.created_at))}</span>
    </div>

    <div class="page-head" style="margin-bottom:18px">
      <div>
        <div class="eyebrow">${esc(r.status_label)} · ${esc(when)}</div>
        <h1 style="font-size:32px">${esc(r.style_name)}</h1>
        <div class="sub">${esc(r.client.name)} · ${esc(r.client.phone)} · ${esc(r.client.channel || "")}</div>
      </div>
      <div class="row">${statusPill(r.status, r.status_label)}</div>
    </div>

    <div class="detail-grid">
      <div class="detail-col">
        <div class="card card-pad">
          <div class="row between" style="margin-bottom:12px">
            <h3 style="margin:0">Фото клиента и референс</h3>
            <span class="tiny muted">нажмите, чтобы открыть</span>
          </div>
          <div class="hero-photos">
            ${self ? `<div class="photo" data-zoom="${photoUrl(self.file)}"><img src="${photoUrl(self.file)}" alt=""><span class="photo-tag">клиент</span></div>` : ""}
            ${refs.map((p) => `<div class="photo" data-zoom="${photoUrl(p.file)}"><img src="${photoUrl(p.file)}" alt=""><span class="photo-tag">референс</span></div>`).join("")}
          </div>
          ${r.wishes ? `<p class="small" style="margin:16px 0 0"><span class="muted">Пожелания:</span> ${esc(r.wishes)}</p>` : ""}
        </div>

        ${analysisSection(r)}
      </div>

      <div class="detail-col">
        ${actionPanel(r)}
        ${clientCard(r)}
        ${timelineCard(r.events)}
      </div>
    </div>
  `;

  $$("[data-zoom]").forEach((el) => el.addEventListener("click", () => lightbox(el.dataset.zoom)));
  bindDetail(r);
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function suggestTime() {
  const d = new Date(Date.now() + 86400000);
  d.setHours(12, 0, 0, 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function analysisSection(r) {
  const a = r.analysis;
  if (state.editing) return editorCard(r);
  if (a) {
    return `
      <div class="card">
        <div class="card-head">
          <h3>Разбор</h3>
          ${a.published ? `<span class="pill pill-ready" style="margin-left:auto">${ICONS.check} отправлен клиенту</span>`
            : `<span class="pill pill-in_work" style="margin-left:auto">черновик</span>`}
          <button class="btn btn-ghost btn-sm" data-act="edit-analysis">${ICONS.scissors} Редактировать</button>
        </div>
        <div class="card-body">${renderAnalysis(a)}</div>
      </div>`;
  }
  return `
    <div class="card card-pad center" style="padding:38px 24px">
      <div style="width:52px;height:52px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:var(--copper-soft);color:var(--copper)">${ICONS.spark}</div>
      <h3 style="margin-bottom:6px">Разбор ещё не собран</h3>
      <p class="small muted" style="max-width:46ch;margin:0 auto 16px">Система соберёт технику по анкете и каталогу,
        дальше вы правите под клиента и публикуете.</p>
      <button class="btn btn-primary" data-act="build">Собрать разбор</button>
    </div>`;
}

function editorCard(r) {
  const a = state.draft || {};
  const t = a.timing || {};
  const steps = (a.technique || []).map((s, i) => stepEditor(s, i)).join("");
  const list = (arr) => (arr || []).join("\n");
  return `
    <div class="card editor">
      <div class="card-head">
        <h3>Разбор: правка</h3>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" data-act="cancel-edit">Отмена</button>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <label class="field"><span class="label">Вердикт</span>
            <select class="select" id="ed-verdict">
              ${Object.entries(VERDICT_TITLES).map(([k, v]) => `<option value="${k}" ${a.verdict === k ? "selected" : ""}>${v}</option>`).join("")}
            </select></label>
          <label class="field"><span class="label">Время записи</span>
            <input class="input" type="datetime-local" id="ed-when" value="${esc(r.appointment_at ? r.appointment_at.slice(0, 16) : suggestTime())}">
            <span class="hint">Клиент увидит это время и подтвердит.</span></label>
        </div>

        <label class="field"><span class="label">Резюме разбора</span>
          <textarea class="textarea" id="ed-summary">${esc(a.summary || "")}</textarea></label>

        <label class="field"><span class="label">Комментарий клиенту</span>
          <textarea class="textarea" id="ed-note" placeholder="Пару слов от вас лично: что увидели на фото, что предлагаете">${esc(a.master_note || "")}</textarea></label>

        <div class="editor-row">
          <label class="field"><span class="label">Время, мин</span>
            <input class="input" type="number" min="10" step="5" id="ed-min" value="${t.minutes || ""}"></label>
          <label class="field"><span class="label">Цена от, ₽</span>
            <input class="input" type="number" min="0" step="50" id="ed-pmin" value="${t.price_min || ""}"></label>
          <label class="field"><span class="label">Цена до, ₽</span>
            <input class="input" type="number" min="0" step="50" id="ed-pmax" value="${t.price_max || ""}"></label>
        </div>

        <hr class="hairline">
        <div class="row between" style="margin-bottom:10px">
          <h4 style="margin:0">Техника по зонам</h4>
          <button class="btn btn-ghost btn-xs" data-act="add-step">${ICONS.plus} Шаг</button>
        </div>
        <div id="steps-editor">${steps}</div>

        <hr class="hairline">
        <div class="grid-2">
          <label class="field"><span class="label">Инструменты</span>
            <textarea class="textarea" id="ed-tools" style="min-height:76px">${esc(list(a.tools))}</textarea></label>
          <label class="field"><span class="label">Средства</span>
            <textarea class="textarea" id="ed-products" style="min-height:76px">${esc(list(a.products))}</textarea></label>
          <label class="field"><span class="label">Риски</span>
            <textarea class="textarea" id="ed-risks" style="min-height:76px">${esc(list(a.risks))}</textarea></label>
          <label class="field"><span class="label">После стрижки</span>
            <textarea class="textarea" id="ed-after" style="min-height:76px">${esc(list(a.aftercare))}</textarea></label>
        </div>
        <label class="field"><span class="label">Что уточнить на консультации</span>
          <textarea class="textarea" id="ed-questions" style="min-height:76px">${esc(list(a.questions))}</textarea></label>
      </div>
      <div class="card-foot row between">
        <button class="btn btn-ghost" data-act="save-draft">Сохранить черновик</button>
        <button class="btn btn-primary" data-act="publish">${ICONS.check} Опубликовать клиенту</button>
      </div>
    </div>`;
}

function stepEditor(s, i) {
  return `
    <div class="step-edit" data-step>
      <span class="n">${i + 1}</span>
      <div>
        <input class="input" data-zone value="${esc(s.zone || "")}" style="margin-bottom:6px;min-height:38px;font-size:13.5px">
        <textarea class="textarea" data-text>${esc(s.text || "")}</textarea>
      </div>
      <button class="btn btn-ghost btn-xs" data-act="del-step" title="Удалить шаг" style="margin-top:6px">${ICONS.trash}</button>
    </div>`;
}

function actionPanel(r) {
  const a = r.analysis;
  const canPublish = a && !a.published;
  const btns = [];
  if (r.status === "new") btns.push(`<button class="btn btn-primary btn-block" data-act="start">Взять в работу</button>`);
  if (canPublish) btns.push(`<button class="btn btn-primary btn-block" data-act="publish">${ICONS.check} Опубликовать разбор</button>`);
  if (["ready", "booked"].includes(r.status)) {
    btns.push(`<button class="btn btn-primary btn-block" data-act="done">${ICONS.check} Услуга выполнена</button>`);
    btns.push(`<button class="btn btn-ghost btn-block" data-act="reschedule">${ICONS.calendar} Перенести время</button>`);
  }
  if (!["done", "declined"].includes(r.status)) btns.push(`<button class="btn btn-danger btn-block" data-act="decline">Отклонить заявку</button>`);

  return `
    <div class="card card-pad">
      <div class="eyebrow">действия</div>
      <div class="kv" style="margin-bottom:14px">
        <dt>Запись</dt><dd>${esc(r.appointment_at ? fmtDateTime(r.appointment_at) : "не назначена")}</dd>
        <dt>Оплата</dt><dd>${esc(money(r.price_final))}</dd>
        <dt>Статус</dt><dd>${esc(r.status_label)}</dd>
      </div>
      <div class="stack">${btns.join("") || `<p class="small muted">Заявка закрыта. Оценка клиента: ${r.rating ? "★ " + r.rating : "нет"}.</p>`}</div>
      ${r.review ? `<hr class="hairline"><p class="small" style="margin:0"><span class="muted">Отзыв:</span> «${esc(r.review)}»</p>` : ""}
    </div>`;
}

function clientCard(r) {
  return `
    <div class="card card-pad">
      <div class="eyebrow">клиент</div>
      <div class="row" style="gap:10px;margin-bottom:10px">
        <span class="avatar" style="display:grid;place-items:center;color:var(--copper)">${esc(r.client.name[0])}</span>
        <div><div style="font-weight:600">${esc(r.client.name)}</div><div class="tiny muted">${esc(r.client.channel || "канал не указан")}</div></div>
      </div>
      <a class="btn btn-ghost btn-sm btn-block" href="tel:${esc(r.client.phone.replace(/[^\d+]/g, ""))}">${ICONS.phone} ${esc(r.client.phone)}</a>
      <hr class="hairline">
      <dl class="kv">
        <dt>Форма лица</dt><dd>${esc(state.meta.face[r.questionnaire.face] || "—")}</dd>
        <dt>Волосы</dt><dd>${esc(state.meta.hair[r.questionnaire.hair] || "—")}</dd>
        <dt>Густота</dt><dd>${esc(state.meta.density[r.questionnaire.density] || "—")}</dd>
        <dt>Длина</dt><dd>${esc(state.meta.length[r.questionnaire.length_now] || "—")}</dd>
        <dt>Укладка</dt><dd>${esc(state.meta.styling[r.questionnaire.styling_time] || "—")}</dd>
        ${r.questionnaire.allergies ? `<dt>Ограничения</dt><dd>${esc(r.questionnaire.allergies)}</dd>` : ""}
        ${r.questionnaire.problems ? `<dt>Особенности</dt><dd>${esc(r.questionnaire.problems)}</dd>` : ""}
      </dl>
    </div>`;
}

function timelineCard(events) {
  return `
    <div class="card card-pad">
      <div class="eyebrow">история</div>
      <div class="timeline">
        ${events.map((e) => `
          <div class="tl-item"><span class="tl-dot"></span>
            <div><div class="tl-text">${esc(EVENT_LABELS[e.kind] || e.text)}</div>
            <div class="tl-at">${esc(fmtDateTime(e.at))}</div></div></div>`).join("")}
      </div>
    </div>`;
}

/* ---------------- действия в карточке ---------------- */

function readEditor() {
  const a = clone(state.draft || {});
  a.verdict = $("#ed-verdict").value;
  a.verdict_title = VERDICT_TITLES[a.verdict];
  a.summary = $("#ed-summary").value.trim();
  a.master_note = $("#ed-note").value.trim();
  a.timing = Object.assign({}, a.timing, {
    minutes: Number($("#ed-min").value) || a.timing && a.timing.minutes || 60,
    price_min: Number($("#ed-pmin").value) || a.timing && a.timing.price_min || 0,
    price_max: Number($("#ed-pmax").value) || a.timing && a.timing.price_max || 0,
  });
  a.technique = $$("[data-step]").map((row, i) => ({
    n: i + 1,
    zone: row.querySelector("[data-zone]").value.trim(),
    text: row.querySelector("[data-text]").value.trim(),
  })).filter((s) => s.text);
  const lines = (sel) => $(sel).value.split("\n").map((x) => x.trim()).filter(Boolean);
  a.tools = lines("#ed-tools");
  a.products = lines("#ed-products");
  a.risks = lines("#ed-risks");
  a.aftercare = lines("#ed-after");
  a.questions = lines("#ed-questions");
  return a;
}

function bindDetail(r) {
  {
    $$("[data-act]").forEach((b) => {
      b.addEventListener("click", async () => {
        const act = b.dataset.act;
        if (act === "build") {
          b.disabled = true; b.textContent = "Собираем…";
          try {
            state.draft = await api(`/api/requests/${r.id}/preview`, { method: "POST", body: { style_id: r.style_id, questionnaire: r.questionnaire } });
            state.editing = true;
            renderDetail(r.id);
          } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = "Собрать разбор"; }
          return;
        }
        if (act === "edit-analysis") { state.draft = clone(r.analysis); state.editing = true; renderDetail(r.id); return; }
        if (act === "cancel-edit") { state.editing = false; state.draft = null; renderDetail(r.id); return; }
        if (act === "add-step") {
          state.draft = readEditor();
          state.draft.technique = state.draft.technique || [];
          state.draft.technique.push({ n: state.draft.technique.length + 1, zone: "", text: "" });
          renderDetail(r.id);
          return;
        }
        if (act === "del-step") {
          const idx = $$("[data-step]").indexOf(b.closest("[data-step]"));
          state.draft = readEditor();
          state.draft.technique.splice(idx, 1);
          renderDetail(r.id);
          return;
        }
        if (act === "save-draft") {
          b.disabled = true;
          try {
            const a = readEditor();
            await api(`/api/requests/${r.id}/action`, { method: "POST", body: { action: "draft", analysis: a } });
            state.editing = false; state.draft = null;
            toast("Черновик сохранён");
            renderDetail(r.id);
          } catch (e) { toast(e.message, true); b.disabled = false; }
          return;
        }
        if (act === "publish") {
          if (!confirm("Опубликовать разбор? Клиент увидит его и сможет подтвердить запись.")) return;
          b.disabled = true;
          try {
            let a = state.editing ? readEditor() : (r.analysis || null);
            if (!a) { toast("Сначала соберите разбор", true); b.disabled = false; return; }
            const when = $("#ed-when") ? $("#ed-when").value : (r.appointment_at || "").slice(0, 16);
            if (!when) { toast("Укажите время записи", true); b.disabled = false; return; }
            await api(`/api/requests/${r.id}/action`, {
              method: "POST",
              body: { action: "publish", analysis: a, appointment_at: when ? when + ":00" : null },
            });
            state.editing = false; state.draft = null;
            toast("Разбор опубликован");
            renderDetail(r.id);
          } catch (e) { toast(e.message, true); b.disabled = false; }
          return;
        }
        if (act === "start") {
          try { await api(`/api/requests/${r.id}/action`, { method: "POST", body: { action: "start" } }); toast("Заявка в работе"); renderDetail(r.id); }
          catch (e) { toast(e.message, true); }
          return;
        }
        if (act === "done") {
          const price = await window.G.askPrice(r.price_final);
          if (price === null) { if (!confirm("Отметить без суммы?")) return; }
          try {
            await api(`/api/requests/${r.id}/action`, { method: "POST", body: { action: "done", price_final: price } });
            toast("Услуга закрыта");
            renderDetail(r.id);
          } catch (e) { toast(e.message, true); }
          return;
        }
        if (act === "reschedule") {
          const value = await askDateTime(r.appointment_at);
          if (!value) return;
          try {
            await api(`/api/requests/${r.id}/action`, { method: "POST", body: { action: "reschedule", appointment_at: value + ":00" } });
            toast("Время перенесено");
            renderDetail(r.id);
          } catch (e) { toast(e.message, true); }
          return;
        }
        if (act === "decline") {
          if (!confirm("Отклонить заявку? Клиент увидит отказ.")) return;
          try { await api(`/api/requests/${r.id}/action`, { method: "POST", body: { action: "decline" } }); toast("Заявка отклонена"); renderDetail(r.id); }
          catch (e) { toast(e.message, true); }
          return;
        }
      });
    });
  }
}

function askDateTime(current) {
  return new Promise((resolve) => {
    window.G.modal(`
      <h3>Перенести время</h3>
      <p class="muted small">Клиент увидит новое время в своей заявке.</p>
      <label class="field"><span class="label">Новое время</span>
        <input class="input" type="datetime-local" id="m-when" value="${current ? esc(current.slice(0, 16)) : ""}"></label>
      <div class="row" style="margin-top:18px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" data-cancel>Отмена</button>
        <button class="btn btn-primary btn-sm" data-ok>Сохранить</button>
      </div>`, {
      onMount(back, close) {
        back.querySelector("[data-cancel]").onclick = () => { close(); resolve(null); };
        back.querySelector("[data-ok]").onclick = () => {
          const v = back.querySelector("#m-when").value;
          close(); resolve(v || null);
        };
      },
    });
  });
}

/* ---------------- отчёты ---------------- */

async function renderReport() {
  const view = document.getElementById("view");
  view.innerHTML = `<div class="muted small">Считаем…</div>`;
  const s = await api("/api/stats");
  await fetchList();
  const done = state.list.filter((r) => r.status === "done");
  const revenue = done.reduce((sum, r) => sum + (r.price_final || 0), 0);
  const avgCheck = done.length ? Math.round(revenue / done.length) : 0;
  const maxTop = Math.max(1, ...s.top_services.map((t) => t.c));

  view.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">сеть</div>
        <h1>Отчёты</h1>
        <div class="sub">Все мастера · данные из базы за всё время</div>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat"><div class="k">Выручка</div><div class="v">${money(revenue)}</div></div>
      <div class="stat"><div class="k">Средний чек</div><div class="v">${money(avgCheck)}</div></div>
      <div class="stat"><div class="k">Средняя оценка</div><div class="v">${s.rating_avg ? "★ " + s.rating_avg : "—"}</div></div>
      <div class="stat"><div class="k">В живой очереди</div><div class="v">${s.waiting}</div></div>
    </div>

    <div class="detail-grid">
      <div class="detail-col">
        <div class="card card-pad">
          <div class="eyebrow">что просят чаще</div>
          <div class="bar-list">
            ${s.top_services.map((t) => `
              <div class="bar-row"><span>${esc(t.service_name)}</span>
                <div class="bar"><i style="width:${Math.round(t.c / maxTop * 100)}%"></i></div>
                <span class="mono tiny">${t.c}</span>
              </div>`).join("") || `<p class="muted small">Пока нет данных.</p>`}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Салоны</h3></div>
          <div class="card-body" style="padding:0 22px 8px">
            <table class="table">
              <thead><tr><th>Салон</th><th>Мастеров</th><th>Заявок</th><th>Очередь</th></tr></thead>
              <tbody>
                ${s.branches.map((b) => `
                  <tr><td>${esc(b.address)}<br><span class="tiny muted">${esc(b.hours)}</span></td>
                  <td class="mono">${b.masters}</td><td class="mono">${b.requests}</td>
                  <td class="mono">${b.waiting}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Мастера</h3></div>
          <div class="card-body" style="padding:0 22px 8px">
            <table class="table">
              <thead><tr><th>Мастер</th><th>Заявок</th><th>Выполнено</th><th>Оценка</th></tr></thead>
              <tbody>
                ${s.masters.map((m) => `
                  <tr><td>${esc(m.name)}<br><span class="tiny muted">${esc(m.role)}</span></td>
                  <td class="mono">${m.requests}</td><td class="mono">${m.done}</td>
                  <td class="mono">${m.rating_avg ? "★ " + m.rating_avg.toFixed(1) : "—"}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="detail-col">
        <div class="card card-pad">
          <div class="eyebrow">воронка</div>
          ${Object.entries(s.counts).map(([k, v]) => `
            <div class="bar-row" style="grid-template-columns:96px 1fr 30px">
              <span>${esc(state.meta.statuses[k] || k)}</span>
              <div class="bar"><i style="width:${Math.max(4, Math.round(v / Math.max(1, state.list.length) * 100))}%"></i></div>
              <span class="mono tiny">${v}</span>
            </div>`).join("")}
        </div>
        <div class="card card-pad">
          <div class="eyebrow">отзывы</div>
          ${done.filter((r) => r.rating).slice(0, 4).map((r) => `
            <div style="padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid var(--line)">
              <div class="row between"><b class="small">${esc(r.client.name)}</b><span class="tiny" style="color:var(--brass)">${"★".repeat(r.rating)}</span></div>
              <p class="small muted" style="margin:4px 0 0">«${esc(r.review || "")}»</p>
            </div>`).join("") || `<p class="muted small">Отзывов пока нет.</p>`}
        </div>
      </div>
    </div>
  `;
  markNav("#/report");
}

})();

/* API поверх localStorage: приложение работает без сервера */

(function () {
  "use strict";

  const KEY = "chio_db_v2";
  const SEED = window.SEED;
  const STATUS_ORDER = { new: 0, in_work: 1, ready: 2, booked: 3, done: 4, declined: 5 };
  const LABELS = SEED.statuses;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const nowIso = () => new Date().toISOString().slice(0, 19);

  function normPhone(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
    return d ? "+" + d : "";
  }

  function seedDb() {
    const s = clone(SEED);
    const requests = s.requests.map((r) => {
      const q = s.questionnaires.find((x) => x.request_id === r.id);
      const a = s.analyses.filter((x) => x.request_id === r.id).sort((p, q2) => q2.id - p.id)[0];
      return Object.assign({}, r, {
        photos: s.photos.filter((p) => p.request_id === r.id).map((p) => ({ kind: p.kind, file: p.file })),
        questionnaire: q ? Object.fromEntries(Object.entries(q).filter(([k]) => k !== "request_id")) : {},
        analysis: a ? { payload: JSON.parse(a.payload), published: !!a.published } : null,
        events: s.events.filter((e) => e.request_id === r.id).map((e) => ({ kind: e.kind, text: e.text, at: e.at })),
      });
    });
    return {
      clients: s.clients.map((c) => Object.assign({}, c)),
      masters: s.masters.slice(),
      branches: s.branches.slice(),
      requests,
      tickets: clone(s.tickets),
      ids: {
        client: Math.max(0, ...s.clients.map((c) => c.id)),
        request: Math.max(0, ...s.requests.map((r) => r.id)),
        ticket: Math.max(0, ...s.tickets.map((t) => t.id)),
      },
    };
  }

  let db = null;
  function store() {
    if (!db) {
      try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { db = null; }
      if (!db || !db.requests) { db = seedDb(); save(); }
    }
    return db;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* переполнение не роняет */ } }

  function brief(r) {
    const client = db.clients.find((c) => c.id === r.client_id) || null;
    const master = db.masters.find((m) => m.id === r.master_id) || null;
    const branch = db.branches.find((b) => b.id === r.branch_id) || null;
    return Object.assign({}, r, {
      status_label: LABELS[r.status] || r.status,
      client, master, branch, photos: r.photos || [],
      has_analysis: !!r.analysis,
      analysis_published: !!(r.analysis && r.analysis.published),
    });
  }

  function full(r) {
    return Object.assign(brief(r), {
      questionnaire: r.questionnaire || {},
      analysis: r.analysis ? Object.assign({}, r.analysis.payload, { published: r.analysis.published }) : null,
      events: r.events || [],
    });
  }

  function findRequest(id) { return db.requests.find((r) => r.id === id) || null; }
  function event(r, kind, text) { r.events = r.events || []; r.events.push({ kind, text, at: nowIso() }); }

  function reply(status, data) {
    return { ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) };
  }
  const ok = (data, status = 200) => reply(status, data);
  const fail = (code, message) => reply(code, { error: message });

  async function handle(path, method, query, body) {
    const S = store();

    if (path === "/api/meta") {
      return ok({
        company: SEED.company, masters: S.masters,
        branches: S.branches.map((b) => Object.assign({}, b, {
          masters: S.masters.filter((m) => m.branch_id === b.id).length,
          waiting: S.tickets.filter((t) => t.branch_id === b.id && t.status === "waiting").length,
        })),
        services: SEED.services, service_categories: SEED.service_categories,
        styles: SEED.styles_catalog, face: SEED.face, hair: SEED.hair, density: SEED.density,
        texture: SEED.texture, length: SEED.length, styling: SEED.styling, statuses: LABELS,
      });
    }

    if (path === "/api/clients" && method === "GET") {
      const c = S.clients.find((x) => x.phone_norm === normPhone(query.get("phone")));
      return c ? ok(c) : fail(404, "Клиент не найден");
    }
    if (path === "/api/clients" && method === "POST") {
      const name = (body.name || "").trim();
      const phone = String(body.phone || "").trim();
      if (!name) return fail(400, "Укажите имя");
      if (normPhone(phone).length < 11) return fail(400, "Укажите телефон");
      let c = S.clients.find((x) => x.phone_norm === normPhone(phone));
      if (c) Object.assign(c, { name, gender: body.gender, channel: body.channel });
      else {
        c = { id: ++S.ids.client, name, phone, phone_norm: normPhone(phone), gender: body.gender, channel: body.channel, created_at: nowIso() };
        S.clients.push(c);
      }
      save();
      return ok(c, 201);
    }

    if (path === "/api/requests" && method === "GET") {
      let list = S.requests.slice();
      ["client_id", "master_id", "status"].forEach((k) => {
        const v = query.get(k);
        if (v) list = list.filter((r) => String(r[k]) === String(v));
      });
      list.sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || String(b.created_at).localeCompare(String(a.created_at)));
      return ok({ requests: list.map(brief), total: list.length });
    }

    if (path === "/api/requests" && method === "POST") {
      const svc = SEED.services.find((s) => s.id === body.service_id);
      if (!svc) return fail(400, "Выберите услугу из прайса");
      const styleId = body.style_id || null;
      if (svc.needs_style && !styleId) return fail(400, "Для стрижки выберите форму из каталога");
      const master = body.master_id ? S.masters.find((m) => m.id === body.master_id) : null;
      const branchId = body.branch_id || (master && master.branch_id);
      if (!branchId) return fail(400, "Выберите салон");
      const style = styleId ? (SEED.styles[styleId] || null) : null;
      const id = ++S.ids.request;
      const r = {
        id, client_id: body.client_id, master_id: body.master_id || null, branch_id: branchId,
        service_id: svc.id, service_name: svc.name, price: svc.price, kind: "booking",
        style_id: styleId, style_name: style ? style.name : null, wishes: (body.wishes || "").trim(),
        status: "new", appointment_at: body.appointment_at || null, price_final: null,
        rating: null, review: null, created_at: nowIso(), updated_at: nowIso(),
        photos: (body.photos || []).filter((p) => p.data).map((p) => ({ kind: p.kind, file: p.data })),
        questionnaire: body.questionnaire || {}, analysis: null, events: [],
      };
      event(r, "new", "Клиент отправил заявку");
      S.requests.push(r);
      save();
      return ok(full(r), 201);
    }

    let m = path.match(/^\/api\/requests\/(\d+)$/);
    if (m && method === "GET") {
      const r = findRequest(Number(m[1]));
      return r ? ok(full(r)) : fail(404, "Заявка не найдена");
    }

    m = path.match(/^\/api\/requests\/(\d+)\/preview$/);
    if (m && method === "POST") {
      const r = findRequest(Number(m[1]));
      const questionnaire = body.questionnaire || (r && r.questionnaire) || {};
      const styleId = body.style_id || (r && r.style_id);
      if (!styleId) return fail(400, "Нужна стрижка");
      return ok(window.ChioAnalysis.build(styleId, questionnaire));
    }

    m = path.match(/^\/api\/requests\/(\d+)\/action$/);
    if (m && method === "POST") {
      const r = findRequest(Number(m[1]));
      if (!r) return fail(404, "Заявка не найдена");
      const action = body.action;
      const ts = nowIso();
      if (action === "start") {
        r.status = "in_work"; event(r, "open", "Мастер открыл заявку");
      } else if (action === "draft" || action === "publish") {
        if (!body.analysis) return fail(400, "Нет разбора");
        const payload = Object.assign({}, body.analysis, { published: action === "publish" });
        r.analysis = { payload, published: action === "publish" };
        if (action === "publish") {
          if (body.appointment_at) r.appointment_at = body.appointment_at;
          r.status = "ready"; event(r, "analysis", "Мастер опубликовал разбор и предложил время записи");
        } else {
          if (r.status === "new") r.status = "in_work";
          event(r, "draft", "Мастер сохранил черновик разбора");
        }
      } else if (action === "confirm") {
        if (r.status !== "ready") return fail(409, "Разбор ещё не готов");
        r.status = "booked"; event(r, "booking", "Клиент подтвердил запись");
      } else if (action === "reschedule") {
        if (!body.appointment_at) return fail(400, "Нужна дата");
        r.appointment_at = body.appointment_at; event(r, "reschedule", "Менеджер перенёс время записи");
      } else if (action === "done") {
        r.price_final = body.price_final || r.price_final;
        r.status = "done"; event(r, "done", "Услуга выполнена, оплата принята");
      } else if (action === "decline") {
        r.status = "declined"; event(r, "declined", "Заявка отклонена менеджером");
      } else return fail(400, "Неизвестное действие");
      r.updated_at = ts;
      save();
      return ok(full(r));
    }

    m = path.match(/^\/api\/requests\/(\d+)\/review$/);
    if (m && method === "POST") {
      const r = findRequest(Number(m[1]));
      if (!r) return fail(404, "Заявка не найдена");
      const rating = Number(body.rating);
      if (!(rating >= 1 && rating <= 5)) return fail(400, "Оценка от 1 до 5");
      if (r.status !== "done") return fail(409, "Оценить можно только выполненную услугу");
      r.rating = rating; r.review = (body.text || "").trim(); r.review_at = nowIso();
      event(r, "review", "Клиент оставил отзыв");
      save();
      return ok(full(r));
    }

    if (path === "/api/tickets" && method === "GET") {
      const bid = Number(query.get("branch_id") || 0);
      let list = S.tickets.slice();
      if (bid) list = list.filter((t) => t.branch_id === bid);
      list.sort((a, b) => (a.status === "called" ? -1 : b.status === "called" ? 1 : 0) || a.number - b.number);
      return ok({ tickets: list.map((t) => Object.assign({}, t, {
        client_name: (S.clients.find((c) => c.id === t.client_id) || {}).name || "",
        branch_code: (S.branches.find((b) => b.id === t.branch_id) || {}).code || "",
        service_name: (SEED.services.find((s) => s.id === t.service_id) || {}).name || t.service_id,
      })) });
    }

    if (path === "/api/tickets" && method === "POST") {
      const svc = SEED.services.find((s) => s.id === body.service_id);
      if (!svc) return fail(400, "Выберите услугу");
      if (!body.branch_id) return fail(400, "Выберите салон");
      const today = nowIso().slice(0, 10);
      const number = Math.max(0, ...S.tickets.filter((t) => t.branch_id === body.branch_id && String(t.created_at).slice(0, 10) === today).map((t) => t.number)) + 1;
      const t = { id: ++S.ids.ticket, branch_id: body.branch_id, client_id: body.client_id, service_id: svc.id,
        number, status: "waiting", created_at: nowIso(), called_at: null };
      S.tickets.push(t);
      save();
      const ahead = S.tickets.filter((x) => x.branch_id === t.branch_id && x.status === "waiting" && x.id < t.id).length;
      return ok(Object.assign({}, t, { service_name: svc.name, wait_minutes: ahead * 15, ahead }), 201);
    }

    m = path.match(/^\/api\/tickets\/(\d+)\/status$/);
    if (m && method === "POST") {
      const t = S.tickets.find((x) => x.id === Number(m[1]));
      if (!t) return fail(404, "Талон не найден");
      if (!["waiting", "called", "done", "cancelled"].includes(body.status)) return fail(400, "Недопустимый статус талона");
      t.status = body.status;
      t.called_at = body.status === "called" ? nowIso() : null;
      save();
      return ok(t);
    }

    if (path === "/api/stats") {
      const counts = { new: 0, in_work: 0, ready: 0, booked: 0, done: 0, declined: 0 };
      S.requests.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
      const done = S.requests.filter((r) => r.status === "done");
      const rated = S.requests.filter((r) => r.rating);
      const today = nowIso().slice(0, 10);
      const topMap = {};
      S.requests.forEach((r) => { topMap[r.service_name] = (topMap[r.service_name] || 0) + 1; });
      return ok({
        counts,
        revenue: done.reduce((s, r) => s + (r.price_final || 0), 0),
        rating_avg: rated.length ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10 : null,
        rating_count: rated.length,
        today_booked: S.requests.filter((r) => r.appointment_at && String(r.appointment_at).slice(0, 10) === today && ["ready", "booked"].includes(r.status)).length,
        waiting: S.tickets.filter((t) => t.status === "waiting").length,
        top_services: Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([service_name, c]) => ({ service_name, c })),
        masters: S.masters.map((m2) => {
          const own = S.requests.filter((r) => r.master_id === m2.id);
          const rr = own.filter((r) => r.rating);
          return Object.assign({}, m2, {
            requests: own.length, done: own.filter((r) => r.status === "done").length,
            rating_avg: rr.length ? rr.reduce((s, r) => s + r.rating, 0) / rr.length : null,
          });
        }),
        branches: S.branches.map((b) => Object.assign({}, b, {
          requests: S.requests.filter((r) => r.branch_id === b.id).length,
          waiting: S.tickets.filter((t) => t.branch_id === b.id && t.status === "waiting").length,
          masters: S.masters.filter((m2) => m2.branch_id === b.id).length,
        })),
      });
    }

    return fail(404, "Неизвестный метод API");
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith("/api/")) return realFetch(input, init);
    const u = new URL(url, location.href);
    let body = null;
    if (init && init.body) { try { body = JSON.parse(init.body); } catch (e) { body = null; } }
    await new Promise((r) => setTimeout(r, 60));
    try {
      return await handle(u.pathname, (init && init.method) || "GET", u.searchParams, body);
    } catch (err) {
      return fail(500, "Внутренняя ошибка: " + err.message);
    }
  };

  window.ChioReset = function () { localStorage.removeItem(KEY); db = null; location.reload(); };
})();

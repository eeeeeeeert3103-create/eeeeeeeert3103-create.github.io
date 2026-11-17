/* Разбор стрижки на клиенте: порт правил из engine.py */

(function () {
  "use strict";

  const FACE_ACC = { oval: "овальное", round: "круглое", square: "квадратное", long: "вытянутое", heart: "сердце", triangle: "треугольное" };
  const FACE = { oval: "Овальная", round: "Круглая", square: "Квадратная", long: "Вытянутая", heart: "Сердце", triangle: "Треугольная" };
  const HAIR = { straight: "Прямые", wavy: "Волнистые", curly: "Кудрявые", coily: "Мелкий завиток" };
  const DENSITY = { thin: "Редкие", medium: "Средние", thick: "Густые" };
  const TEXTURE = { soft: "Мягкие", normal: "Обычные", coarse: "Жёсткие" };
  const LENGTH = { short: "Короткие", medium: "Средние", long: "Длинные" };
  const STYLING = { "5": "до 5 минут", "15": "10–15 минут", "30": "20–30 минут", "0": "без укладки" };
  const STYLES = () => (window.SEED && window.SEED.styles) || {};
  const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  function days(n) {
    n = Number(n);
    if (n % 10 === 1 && n % 100 !== 11) return n + " день";
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return n + " дня";
    return n + " дней";
  }

  function weekday(d) {
    if (d <= 14) return "каждые две недели";
    if (d <= 21) return "раз в 3 недели";
    if (d <= 30) return "раз в 4 недели";
    if (d <= 40) return "раз в 5 недель";
    return "раз в 6–8 недель";
  }

  function mm(lo, hi) { return `${String(lo).replace(".", ",")}–${String(hi).replace(".", ",")} мм`; }
  function cm(lo, hi) { return `${lo}–${hi} см`; }

  function score(s, q) {
    const fs = (s.face || {})[q.face || "oval"] ?? 0;
    const hs = (s.hair || {})[q.hair || "straight"] ?? 0;
    const ds = (s.density || {})[q.density || "medium"] ?? 0;
    return { total: fs * 3 + hs * 2 + ds, fs, hs, ds };
  }

  function checks(s, q, fs, hs) {
    const out = [];
    const add = (status, title, text) => out.push({ status, title, text });
    const face = FACE[q.face] || "не указана";
    const hair = HAIR[q.hair] || "не указан";
    const tex = TEXTURE[q.texture] || "не указана";
    const now = LENGTH[q.length_now] || "не указана";

    if (fs === 2) add("ok", "Форма лица", `${face} — стрижка поддерживает пропорции, силуэт читается.`);
    else if (fs === 1) add("warn", "Форма лица", `${face} — форма подходит, но нужна коррекция: добавьте объём сверху и уберите массу по бокам.`);
    else add("bad", "Форма лица", `${face} — эта геометрия работает против пропорций лица. Предложите альтернативу из разбора.`);

    if (hs === 2) add("ok", "Тип волос", `${hair}, ${tex.toLowerCase()} — держат форму, текстура раскрывается.`);
    else if (hs === 1) add("warn", "Тип волос", `${hair}, ${tex.toLowerCase()} — форма получится, но потребуется укладка и текстурирование.`);
    else add("bad", "Тип волос", `${hair} — в этой стрижке волосы не дадут нужный силуэт без ежедневной укладки.`);

    if (q.density === "thick") add("ok", "Густота", "Густые волосы — есть из чего строить форму, следите за массой и филировкой.");
    else if (q.density === "thin") add("warn", "Густота", "Редкие волосы — работаем плотно у лица, не расслаиваем массу и не уходим в высокий фейд.");
    else add("ok", "Густота", "Средняя густота — универсальный вариант, форма держится предсказуемо.");

    if (q.length_now === "short" && s.length === "long") add("bad", "Текущая длина", "Сейчас короткие волосы: до нужной длины отращивать 6–9 месяцев. Предложите промежуточный вариант.");
    else if (q.length_now === "short" && s.top[1] >= 6) add("warn", "Текущая длина", `Верх сейчас короткий, а для формы нужно ${s.top[0]}–${s.top[1]} см: это 2–3 месяца отращивания. На переходный период предложите текстурированный верх.`);
    else if (q.length_now === "long" && s.length === "short") add("ok", "Текущая длина", "Длинные волосы позволяют сделать короткую стрижку сразу, без отращивания.");
    else add("ok", "Текущая длина", `Сейчас ${now.toLowerCase()} — длины достаточно, можно стричь сразу.`);

    const st = q.styling_time || "15";
    if (["0", "5"].includes(st) && s.styling >= 3) add("warn", "Укладка", `Стрижка требует ${STYLING[st] || "укладки"} каждый день, а вы рассчитываете на минимум. Обсудите упрощённый вариант.`);
    else add("ok", "Укладка", `Укладка займёт ${STYLING[st] || "до 5 минут"} — совпадает с вашим режимом.`);

    const budget = Number(q.budget) || 0;
    const [lo, hi] = s.price;
    if (budget && budget < lo) add("warn", "Бюджет", `Ориентир ${num(lo)} ₽, а бюджет до ${num(budget)} ₽. Предложите более простую услугу или сокращённый формат.`);
    else if (budget && budget < hi) add("warn", "Бюджет", `Ориентир ${num(lo)}–${num(hi)} ₽, бюджет ${num(budget)} ₽: верхняя граница может не войти. Обсудите объём работ до начала.`);
    else if (budget) add("ok", "Бюджет", `Ориентир ${num(lo)}–${num(hi)} ₽ укладывается в бюджет ${num(budget)} ₽.`);
    else add("ok", "Бюджет", `Ориентир ${num(lo)}–${num(hi)} ₽, бюджет не указан — уточните на консультации.`);

    if ((q.allergies || "").trim()) add("warn", "Ограничения", `Клиент указал: ${q.allergies}. Исключите эти средства и предупредите мастера-коллегу.`);
    if ((q.problems || "").trim()) add("warn", "Кожа и рост", `Особенности: ${q.problems}. Проверьте зоны перед машинкой, работайте аккуратно.`);
    return out;
  }

  function params(s, q) {
    let sides = (s.sides || [0, 0]).slice();
    let top = (s.top || [0, 0]).slice();
    if (s.gender === "male") {
      if (q.face === "round") sides = [Math.max(0, sides[0] - 0.5), Math.max(0, sides[1] - 0.5)];
      if (q.density === "thin") sides = [sides[0], Math.max(sides[0], sides[1] - 0.5)];
      if (q.density === "thick") sides = [sides[0], Math.min(sides[1] + 0.5, 6)];
      if (top[1] > 0) {
        if (q.face === "long") top = [Math.max(0, top[0] - 1), Math.max(0, top[1] - 1)];
        if (q.density === "thin") top = [Math.max(0, top[0] - 1), Math.max(0, top[1] - 1)];
        if (q.face === "round") top = [top[0], top[1] + 1];
      }
    }
    let fade = "";
    if (s.gender === "male" && s.top && s.top[1]) {
      fade = "низкий";
      if (["classic-fade", "curly-fade"].includes(s.id)) fade = q.face === "round" ? "высокий" : "средний";
    }
    return { sides_mm: sides[1] ? mm(sides[0], sides[1]) : "", top_cm: top[1] ? cm(top[0], top[1]) : "", fade };
  }

  function summary(s, q, verdict) {
    const face = FACE_ACC[q.face] || "не указанное";
    const hair = (HAIR[q.hair] || "не указанный").toLowerCase();
    const styling = STYLING[q.styling_time || "15"] || "стандартная";
    if (verdict === "recommended") {
      return `«${s.name}» подходит под ${face} лицо и ${hair} волосы. Густоты хватает: переход и масса читаются. Форма держится ${days(s.upkeep)}, укладка — ${styling}.`;
    }
    if (verdict === "conditional") {
      return `«${s.name}» возможна с поправками под ${face} лицо и ${hair} волосы: часть объёма уйдёт, переходы нужно адаптировать. Конкретные правки — в технике ниже.`;
    }
    return `«${s.name}» в текущем виде не рекомендую: ${face} лицо и ${hair} волосы конфликтуют с геометрией стрижки. Ниже — альтернатива и аргументы.`;
  }

  function alternative(s, q) {
    let best = null, bestScore = -1;
    Object.values(STYLES()).forEach((cand) => {
      if (cand.id === s.id || cand.gender !== s.gender) return;
      let sc = score(cand, q).total;
      if (q.length_now === "short" && cand.length === "long") sc -= 4;
      if (sc > bestScore) { best = cand; bestScore = sc; }
    });
    return best;
  }

  function build(styleId, q) {
    const styles = STYLES();
    const s = styles[styleId] || styles[Object.keys(styles)[0]];
    q = q || {};
    const sc = score(s, q);
    const list = checks(s, q, sc.fs, sc.hs);
    let verdict = list.some((c) => c.status === "bad") ? "not_recommended" : sc.total >= 8 ? "recommended" : sc.total >= 5 ? "conditional" : "not_recommended";
    const titles = { recommended: "Подходит", conditional: "Подходит с поправками", not_recommended: "Не рекомендую в этом виде" };
    const p = params(s, q);

    const steps = (s.steps || []).map(([zone, text], i) => ({
      n: i + 1, zone, text: text.replaceAll("{sides_mm}", p.sides_mm).replaceAll("{top_cm}", p.top_cm).replaceAll("{fade}", p.fade),
    }));

    const extra = [];
    if (q.face === "round") extra.push("Круглое лицо: держите объём сверху и не оставляйте массу на висках — визуально вытягиваем овал.");
    if (q.face === "long") extra.push("Вытянутое лицо: не поднимайте объём высоко, добавьте ширину по бокам.");
    if (q.face === "square") extra.push("Квадратное лицо: смягчите углы, избегайте жёстких горизонтальных линий.");
    if (["curly", "coily"].includes(q.hair)) extra.push("Кудри: стрижка по сухому, усадка 20–30%, не тяните завиток.");
    if (q.density === "thin") extra.push("Редкие волосы: длина сверху не больше 5 см, текстурирующая пудра вместо пасты.");
    if (q.texture === "coarse") extra.push("Жёсткие волосы: работайте клиппер-овер-комб, снимайте массу поэтапно.");
    if (extra.length) steps.push({ n: steps.length + 1, zone: "Поправки под клиента", text: extra.join(" ") });

    const curly = ["curly", "coily"].includes(q.hair);
    const minutes = s.minutes + (q.density === "thick" || curly ? 10 : 0);
    const k = curly ? 1.1 : 1;
    const alt = alternative(s, q);
    const altPayload = alt && !(verdict === "recommended" && sc.total >= 11)
      ? { id: alt.id, name: alt.name, why: alt.tagline, price_min: alt.price[0], price_max: alt.price[1] }
      : null;

    return {
      style_id: s.id, style_name: s.name, verdict, verdict_title: titles[verdict],
      score: sc.total, score_max: 12, summary: summary(s, q, verdict), checks: list,
      params: p, technique: steps, tools: s.tools, products: s.products, risks: s.risks,
      questions: s.questions, aftercare: s.aftercare,
      timing: {
        minutes, price_min: Math.round(s.price[0] * k), price_max: Math.round(s.price[1] * k),
        upkeep_days: s.upkeep, upkeep_text: weekday(s.upkeep),
      },
      alternative: altPayload, master_note: "", published: false,
    };
  }

  window.ChioAnalysis = { build, FACE, HAIR, DENSITY, TEXTURE, LENGTH, STYLING };
})();

/* Настройка ИИ для публичной версии: ключ хранится только в браузере */

(function () {
  "use strict";
  const KEY = "chio_ai";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch (e) { return {}; }
  }

  function button() {
    const b = document.createElement("button");
    b.id = "ai-settings-btn";
    b.textContent = "ИИ";
    b.title = "Подключить ИИ-анализ фото";
    b.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:50;width:46px;height:46px;border-radius:50%;" +
      "border:1px solid #cfc0a9;background:#fffcf7;color:#a3271e;font:600 13px Inter,sans-serif;cursor:pointer;" +
      "box-shadow:0 4px 16px rgba(25,21,16,.18)";
    b.onclick = open;
    document.body.appendChild(b);
  }

  function open() {
    const cfg = read();
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 style="margin-bottom:6px">ИИ-анализ фото</h3>
        <p class="small muted" style="margin-bottom:14px">Публичная версия работает без сервера, поэтому модель зрения
          вызывается прямо из браузера. Ключ хранится только у вас в браузере и никуда не отправляется, кроме
          выбранного провайдера.</p>
        <label class="field"><span class="label">Адрес API</span>
          <input class="input" id="ai-url" value="${(cfg.url || "https://api.openai.com/v1").replace(/"/g, "&quot;")}" placeholder="https://api.openai.com/v1"></label>
        <label class="field"><span class="label">Модель</span>
          <input class="input" id="ai-model" value="${(cfg.model || "gpt-4o-mini").replace(/"/g, "&quot;")}" placeholder="gpt-4o-mini"></label>
        <label class="field"><span class="label">Ключ</span>
          <input class="input" id="ai-key" type="password" value="${(cfg.key || "").replace(/"/g, "&quot;")}" placeholder="sk-..."></label>
        <p class="hint">Подходит любой OpenAI-совместимый провайдер. Если он блокирует запросы из браузера,
          анализ не сработает: тогда нужен сервер.</p>
        <div class="row" style="margin-top:16px;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" data-ai-clear>Убрать ключ</button>
          <button class="btn btn-primary btn-sm" data-ai-save>Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    back.querySelector("[data-ai-save]").onclick = () => {
      const url = back.querySelector("#ai-url").value.trim();
      const model = back.querySelector("#ai-model").value.trim();
      const key = back.querySelector("#ai-key").value.trim();
      if (key) localStorage.setItem(KEY, JSON.stringify({ url, model, key }));
      else localStorage.removeItem(KEY);
      close();
      location.reload();
    };
    back.querySelector("[data-ai-clear]").onclick = () => {
      localStorage.removeItem(KEY);
      close();
      location.reload();
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", button);
  else button();
})();

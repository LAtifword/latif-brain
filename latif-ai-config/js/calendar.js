/* ════════════════════════════════════════════════════════════════
   LATIF AI — CALENDAR & SCHEDULED PROMPTS (LATIF GX V3)
   Two things, both scoped to what a web app can honestly deliver:
     1) A month-grid view of conversation activity — click a day to
        filter the chat history list to that date.
     2) Scheduled/recurring prompts ("reminders") — once/daily/weekly.
        While this tab/PWA is OPEN, a lightweight interval checks for
        due reminders, shows a Notification (if permitted), and sends
        the prompt into a chat automatically.

   Honest limitation (documented, not silently dropped): a web page
   cannot wake itself up once fully closed. Reminders only fire while
   LATIF is open in the foreground or background tab. Real "fires even
   if closed" scheduling needs a native AlarmManager/WorkManager hook
   on the WebToApp side — see ARCHITECTURE.md.

   Independent module — reads app.js's shared `State`/`saveChats` from
   ai-core.js (same global scope) for chat data, but owns its own
   localStorage-backed reminder list so it doesn't require app.js edits.
   ════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

const $ = (id) => document.getElementById(id);
const LS_REMINDERS = "latif_reminders";
const CHECK_INTERVAL_MS = 30000;

function loadReminders() {
  try { return JSON.parse(localStorage.getItem(LS_REMINDERS) || "[]"); } catch (_) { return []; }
}
function saveReminders(list) {
  localStorage.setItem(LS_REMINDERS, JSON.stringify(list));
}

function toast(msg, ms = 2200) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), ms);
}

/* ───────── month grid ───────── */
let viewYear, viewMonth; // 0-indexed month
let selectedDateKey = null;

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function activityByDay() {
  const map = {};
  const chats = (typeof State !== "undefined" && State.chats) || {};
  Object.values(chats).forEach((c) => {
    if (!c.messages || !c.messages.length) return;
    const d = new Date(c.createdAt);
    const key = dateKey(d);
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

function renderMonthGrid() {
  const grid = $("calMonthGrid");
  const label = $("calMonthLabel");
  if (!grid || !label) return;

  const first = new Date(viewYear, viewMonth, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const activity = activityByDay();
  const todayKey = dateKey(new Date());

  label.textContent = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  let html = "";
  for (let i = 0; i < startDow; i++) html += `<div class="cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(viewYear, viewMonth, day);
    const key = dateKey(d);
    const count = activity[key] || 0;
    const isToday = key === todayKey;
    const isSelected = key === selectedDateKey;
    html += `<button class="cal-cell${isToday ? " today" : ""}${isSelected ? " selected" : ""}" data-key="${key}">
      <span class="cal-daynum">${day}</span>
      ${count ? `<span class="cal-dot" title="${count} conversation(s)"></span>` : ""}
    </button>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll(".cal-cell:not(.empty)").forEach((cell) => {
    cell.addEventListener("click", () => {
      selectedDateKey = cell.dataset.key === selectedDateKey ? null : cell.dataset.key;
      renderMonthGrid();
      renderFilteredHistory();
    });
  });
}

function renderFilteredHistory() {
  const list = $("calHistoryList");
  if (!list) return;
  const chats = (typeof State !== "undefined" && State.chats) || {};
  const entries = Object.values(chats).filter((c) => c.messages && c.messages.length);

  const filtered = selectedDateKey
    ? entries.filter((c) => dateKey(new Date(c.createdAt)) === selectedDateKey)
    : entries.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  $("calHistoryTitle").textContent = selectedDateKey
    ? `Conversations on ${selectedDateKey}`
    : "Recent conversations";

  if (!filtered.length) {
    list.innerHTML = `<div class="gxd-memory-empty">${selectedDateKey ? "No conversations on this day." : "No conversations yet."}</div>`;
    return;
  }
  list.innerHTML = filtered.map((c) =>
    `<button class="history-item cal-history-item" data-id="${c.id}">${(c.title || "Untitled").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]))}</button>`
  ).join("");
  list.querySelectorAll(".cal-history-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.renderChat) window.renderChat(btn.dataset.id);
      closeCalendar();
    });
  });
}

/* ───────── scheduled prompts (reminders) ───────── */
function renderReminders() {
  const list = $("calReminderList");
  if (!list) return;
  const reminders = loadReminders();
  if (!reminders.length) {
    list.innerHTML = `<div class="gxd-memory-empty">No scheduled prompts yet.</div>`;
    return;
  }
  list.innerHTML = reminders.map((r, i) => `
    <div class="gxd-memory-item cal-reminder-item">
      <span>
        <strong>${r.time}</strong> · ${r.repeat === "once" ? new Date(r.nextFire).toLocaleDateString() : r.repeat}
        <br/><span style="opacity:.8">${escapeHtmlLocal(r.prompt)}</span>
      </span>
      <button data-idx="${i}">✕</button>
    </div>`).join("");
  list.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reminders2 = loadReminders();
      reminders2.splice(parseInt(btn.dataset.idx, 10), 1);
      saveReminders(reminders2);
      renderReminders();
    });
  });
}

function escapeHtmlLocal(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nextFireFor(timeStr, repeat, fromDate) {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(fromDate || Date.now());
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now()) {
    if (repeat === "daily") d.setDate(d.getDate() + 1);
    else if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1); // "once" scheduled for a past time today -> tomorrow
  }
  return d.getTime();
}

function addReminder() {
  const promptEl = $("calReminderPrompt");
  const timeEl = $("calReminderTime");
  const repeatEl = $("calReminderRepeat");
  const prompt = promptEl.value.trim();
  const time = timeEl.value;
  if (!prompt || !time) { toast("Enter both a prompt and a time"); return; }
  const repeat = repeatEl.value;
  const reminders = loadReminders();
  reminders.push({ prompt, time, repeat, nextFire: nextFireFor(time, repeat) });
  saveReminders(reminders);
  promptEl.value = "";
  renderReminders();
  toast("Scheduled");
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function checkDueReminders() {
  const reminders = loadReminders();
  if (!reminders.length) return;
  const now = Date.now();
  let changed = false;
  reminders.forEach((r) => {
    if (r.nextFire <= now) {
      fireReminder(r);
      if (r.repeat === "once") {
        r._done = true;
      } else {
        r.nextFire = nextFireFor(r.time, r.repeat, now + 60000);
      }
      changed = true;
    }
  });
  const remaining = reminders.filter((r) => !r._done);
  if (changed) saveReminders(remaining);
}

function fireReminder(r) {
  toast(`⏰ Scheduled prompt: ${r.prompt.slice(0, 60)}`, 3500);
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification("LATIF AI", { body: r.prompt, tag: "latif-reminder" }); } catch (_) {}
  }
  if (window.sendMessageFromReminder) {
    window.sendMessageFromReminder(r.prompt);
  }
}

/* ───────── modal open/close ───────── */
function openCalendar() {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  selectedDateKey = null;
  renderMonthGrid();
  renderFilteredHistory();
  renderReminders();
  $("calendarModal").classList.add("open");
  $("calendarBackdrop").classList.add("open");
  if (window.closeDrawerGlobal) window.closeDrawerGlobal();
  else { const d = $("drawer"); if (d) d.classList.remove("open"); }
}
function closeCalendar() {
  $("calendarModal").classList.remove("open");
  $("calendarBackdrop").classList.remove("open");
}

function wire() {
  const openBtn = $("drawerCalendar");
  if (openBtn) openBtn.addEventListener("click", openCalendar);
  const closeBtn = $("btnCloseCalendar");
  if (closeBtn) closeBtn.addEventListener("click", closeCalendar);
  const backdrop = $("calendarBackdrop");
  if (backdrop) backdrop.addEventListener("click", closeCalendar);

  const prevBtn = $("calPrevMonth"), nextBtn = $("calNextMonth");
  if (prevBtn) prevBtn.addEventListener("click", () => {
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderMonthGrid();
  });
  if (nextBtn) nextBtn.addEventListener("click", () => {
    viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderMonthGrid();
  });

  const addBtn = $("btnAddReminder");
  if (addBtn) addBtn.addEventListener("click", addReminder);

  setInterval(checkDueReminders, CHECK_INTERVAL_MS);
  checkDueReminders();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
else wire();

})();

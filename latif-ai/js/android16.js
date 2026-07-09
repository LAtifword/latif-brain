/* ════════════════════════════════════════════════════════════════
   LATIF AI — ANDROID 16 SHELL ALIGNMENT
   1) Predictive back: while any overlay (drawer, settings, attach
      sheet, voice mode, dropdowns) is open, the system/gesture back
      button closes it instead of exiting the app. Modeled as ONE
      coalesced history entry for "an overlay layer is open" rather
      than a strict per-overlay stack — several of this app's own
      transitions close one overlay as a side effect of opening
      another in the same tick (e.g. opening Settings from the drawer
      closes the drawer first), which would desync a naive 1:1 model
      and risk over-firing history.back() past the app's own root.
      Coalescing on "is anything open at all" is immune to that and
      still delivers the real user-facing win: back never exits the
      app while an overlay is showing.
      The actual swipe-preview animation is an Activity-level surface
      — see ARCHITECTURE.md for the native OnBackPressedCallback
      needed to complete it (Android 16 / API 36 enables predictive
      back by default for apps targeting it).
   2) Large-screen / foldable layout: a persistent two-pane shell above
      ~840px (tablets, unfolded foldables, Chromebooks / desktop) —
      Android 16 pushes large-screen support hard.
   3) Material You dynamic color bridge: the native shell can call
      window.LATIF_ANDROID.setDynamicColor(hex) with the OS's
      wallpaper-derived accent (Android 12+ dynamic color); persists
      and re-applies across reloads.

   Pure DOM/MutationObserver driven — app.js is untouched.
   ════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

/* ───────── 1) Predictive back gesture (coalesced single-depth model) ───────── */
const OVERLAY_IDS = ["drawer", "settingsModal", "attachSheet", "voiceOverlay", "modelDropdown", "msgMenu", "calendarModal"];
let anyOpenBefore = false;
let activeOverlayId = null;   // most recently opened overlay still open — the one back() targets
let pushedForOverlay = false; // true once we've pushed the single "overlay open" history entry
let popping = false;          // true while we trigger history.back() ourselves for a manual close
let popStateInProgress = false;

function currentOpenIds() {
  return OVERLAY_IDS.filter((id) => {
    const el = document.getElementById(id);
    return el && el.classList.contains("open");
  });
}

function reconcile() {
  const openIds = currentOpenIds();
  const anyOpenNow = openIds.length > 0;
  if (openIds.length) activeOverlayId = openIds[openIds.length - 1];

  if (anyOpenNow && !anyOpenBefore) {
    history.pushState({ gxOverlay: true }, "");
    pushedForOverlay = true;
  } else if (!anyOpenNow && anyOpenBefore) {
    if (!popStateInProgress && pushedForOverlay && history.state && history.state.gxOverlay) {
      popping = true;
      pushedForOverlay = false;
      history.back();
    } else {
      pushedForOverlay = false;
    }
  }
  anyOpenBefore = anyOpenNow;
}

function wireOverlays() {
  // Each observer's callback fires at the same microtask checkpoint, after ALL
  // synchronous class changes in the current tick have already landed — so
  // reconcile() always sees the final DOM state and is safe to call more than
  // once per tick (idempotent). Do NOT add an extra queueMicrotask hop here:
  // that delays reconcile() past the popstate handler's own cleanup microtask
  // below and causes a spurious extra history.back() call.
  OVERLAY_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    new MutationObserver(reconcile).observe(el, { attributes: true, attributeFilter: ["class"] });
  });
}

window.addEventListener("popstate", () => {
  if (popping) { popping = false; anyOpenBefore = currentOpenIds().length > 0; return; }
  popStateInProgress = true;
  const openIds = currentOpenIds();
  const target = (activeOverlayId && openIds.includes(activeOverlayId)) ? activeOverlayId : openIds[openIds.length - 1];
  if (target) {
    const el = document.getElementById(target);
    if (el) el.classList.remove("open");
  }
  queueMicrotask(() => {
    popStateInProgress = false;
    pushedForOverlay = false;
    anyOpenBefore = currentOpenIds().length > 0;
  });
});

document.addEventListener("DOMContentLoaded", wireOverlays);

/* ───────── 2) Large-screen / foldable layout toggle ───────── */
const LARGE_BREAKPOINT = 840;
function applyLayoutClass() {
  document.documentElement.classList.toggle("gxd-large-screen", window.innerWidth >= LARGE_BREAKPOINT);
}
applyLayoutClass();
window.addEventListener("resize", applyLayoutClass);

/* ───────── 3) Material You dynamic color bridge ───────── */
const LS_DYN_ON = "latif_dynamic_color_on";
const LS_DYN_HEX = "latif_dynamic_color_hex";
const LS_DYN_HEX2 = "latif_dynamic_color_hex2";

function applyDynamicColor(hex, hex2) {
  const root = document.documentElement;
  if (hex) root.style.setProperty("--gold", hex);
  if (hex2) root.style.setProperty("--gold2", hex2);
}
function clearDynamicColor() {
  const root = document.documentElement;
  root.style.removeProperty("--gold");
  root.style.removeProperty("--gold2");
}

window.LATIF_ANDROID = {
  setDynamicColor(hex, hex2) {
    localStorage.setItem(LS_DYN_HEX, hex || "");
    localStorage.setItem(LS_DYN_HEX2, hex2 || hex || "");
    if (localStorage.getItem(LS_DYN_ON) === "true") applyDynamicColor(hex, hex2 || hex);
  },
  enableDynamicColor(on) {
    localStorage.setItem(LS_DYN_ON, String(!!on));
    if (on) {
      const hex = localStorage.getItem(LS_DYN_HEX);
      const hex2 = localStorage.getItem(LS_DYN_HEX2);
      if (hex) applyDynamicColor(hex, hex2);
    } else {
      clearDynamicColor();
    }
  },
  isDynamicColorOn: () => localStorage.getItem(LS_DYN_ON) === "true",
};

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem(LS_DYN_ON) === "true") {
    const hex = localStorage.getItem(LS_DYN_HEX);
    const hex2 = localStorage.getItem(LS_DYN_HEX2);
    if (hex) applyDynamicColor(hex, hex2);
  }
});

})();

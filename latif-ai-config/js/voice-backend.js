/* ════════════════════════════════════════════════════════════════
   LATIF AI — VOICE BACKEND SWITCH
   Settings → Voice Backend: choose the browser's built-in Web Speech
   API (default; works out of the box) or offline whisper.cpp running
   in Termux via backend/transcribe.py.

   Implemented as an INDEPENDENT record button rather than hijacking
   app.js's existing mic/voice-mode buttons (which are wired directly
   to SpeechRecognition) — this keeps app.js untouched and avoids any
   event-order fragility. When whisper mode is selected, a dedicated
   "Record & Transcribe" control appears in Settings; MediaRecorder
   captures audio, uploads it to the whisper backend, and the returned
   text is inserted into the composer.
   ════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

const $ = (id) => document.getElementById(id);
const LS_BACKEND = "latif_voice_backend";   // "web" | "whisper"
const LS_WHISPER_URL = "latif_whisper_url";

let mediaRecorder = null;
let chunks = [];
let recording = false;

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function ensureRecordButton() {
  const row = $("whisperUrlRow");
  if (!row || $("btnWhisperRecord")) return;
  const btn = document.createElement("button");
  btn.id = "btnWhisperRecord";
  btn.className = "field-btn";
  btn.style.marginTop = "10px";
  btn.textContent = "🎙️ Record & Transcribe";
  btn.addEventListener("click", toggleRecord);
  row.insertAdjacentElement("afterend", btn);
}

async function toggleRecord() {
  const btn = $("btnWhisperRecord");
  if (!recording) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast("Microphone not available in this context"); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); sendToWhisper(); };
      mediaRecorder.start();
      recording = true;
      btn.textContent = "⏹ Stop & Transcribe";
      toast("Recording…");
    } catch (e) {
      toast("Microphone permission denied");
    }
  } else {
    mediaRecorder.stop();
    recording = false;
    btn.textContent = "🎙️ Record & Transcribe";
  }
}

async function sendToWhisper() {
  const urlInput = $("whisperUrl");
  const base = (urlInput ? urlInput.value.trim() : "") || localStorage.getItem(LS_WHISPER_URL) || "http://127.0.0.1:8001";
  const blob = new Blob(chunks, { type: "audio/webm" });
  const form = new FormData();
  form.append("audio", blob, "voice.webm");
  toast("Transcribing…");
  try {
    const res = await fetch(base.replace(/\/$/, "") + "/transcribe", { method: "POST", body: form });
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    const text = (data.text || "").trim();
    if (!text) { toast("No speech detected"); return; }
    const input = $("promptInput");
    if (input) {
      input.value = (input.value ? input.value + " " : "") + text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    toast("Transcribed");
  } catch (e) {
    toast("whisper backend unreachable — is backend/transcribe.py running?");
  }
}

function wire() {
  const seg = $("voiceBackendSeg");
  const row = $("whisperUrlRow");
  const whisperUrl = $("whisperUrl");
  if (!seg) return;

  const saved = localStorage.getItem(LS_BACKEND) || "web";
  seg.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.backend === saved));
  if (row) row.style.display = saved === "whisper" ? "flex" : "none";
  if (saved === "whisper") ensureRecordButton();

  const savedUrl = localStorage.getItem(LS_WHISPER_URL);
  if (whisperUrl && savedUrl) whisperUrl.value = savedUrl;
  if (whisperUrl) whisperUrl.addEventListener("change", () => localStorage.setItem(LS_WHISPER_URL, whisperUrl.value.trim()));

  seg.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      seg.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
      localStorage.setItem(LS_BACKEND, btn.dataset.backend);
      if (row) row.style.display = btn.dataset.backend === "whisper" ? "flex" : "none";
      if (btn.dataset.backend === "whisper") ensureRecordButton();
      toast(btn.dataset.backend === "whisper" ? "Voice backend: whisper.cpp" : "Voice backend: browser");
    });
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
else wire();

})();

"use strict";

const imageext = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;
const videoext = /\.(mp4|webm|mov|mkv)$/i;
const audioext = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;

const svg = {
    folder: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#FBE6A3"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>',
    image: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#df9d9b"><path d="M200-120q-33 0-56-23t-24-57v-560q0-33 24-56t56-24h560q33 0 57 24t23 56v560q0 33-23 57t-57 23zm0-80h560v-560H200zm40-80h480L570-480 450-320l-90-120zm-40 80v-560z"/></svg>',
    video: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#aac1f0"><path d="m160-800 80 160h120l-80-160h80l80 160h120l-80-160h80l80 160h120l-80-160h120q33 0 57 24t23 56v480q0 33-23 57t-57 23H160q-33 0-56-23t-24-57v-480q0-33 24-56t56-24m0 240v320h640v-320zm0 0v320z"/></svg>',
    audio: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#9dc384"><path d="M127-167q-47-47-47-113t47-113 113-47q23 0 43 6t37 16v-342l480-80v480q0 66-47 113t-113 47-113-47-47-113 47-113 113-47q23 0 43 6t37 16v-165l-320 63v320q0 66-47 113t-113 47-113-47"/></svg>',
    generic: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#9aa0a6"><path d="M320-240h320v-80H320zm0-160h320v-80H320zm0-160h160v-80H320zm-80 400q-33 0-56.5-23.5T160-240v-480q0-33 23.5-56.5T240-800h320l240 240v320q0 33-23.5 56.5T720-160zm280-360v-200H240v480h480v-280z"/></svg>'
};

function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function norm(p) {return (p || "").replace(/\/+$/, "")}
function basename(p) {
  const s = String(p || "");
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}
function extname(name) {
  const b = basename(name);
  const i = b.lastIndexOf(".");
  return i >= 0 ? b.slice(i + 1).toLowerCase() : "";
}
function formatbytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let idx = 0;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx++;
  }
  return `${v.toFixed(v >= 10 ? 1 : 2)} ${units[idx]}`;
}
function formattimecompact(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  const s = Math.floor(n % 60);
  const m = Math.floor((n / 60) % 60);
  const h = Math.floor(n / 3600);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function rawurl(path) {
  const p = String(path || "").replace(/\\/g, "/");
  const name = basename(p);
  if (!name) return "https://mirror.guweh.com/";
  const isvid = videoext.test(name) || p.startsWith("vids/") || p.includes("/vids/");
  return isvid
    ? `https://mirror.guweh.com/vids/${encodeURIComponent(name)}`
    : `https://mirror.guweh.com/${encodeURIComponent(name)}`;
}
function thumburl(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const b = basename(path);
  const noext = b.replace(/\.[^.]+$/, "");
  const invds = normalized.startsWith("vids/") || normalized.includes("/vids/");
  const base = invds ? "https://mirror.guweh.com/webp/vids" : "https://mirror.guweh.com/webp";
  return `${base}/${encodeURIComponent(noext)}.webp`;
}
function iconfor(name) {
  if (imageext.test(name)) return svg.image;
  if (videoext.test(name)) return svg.video;
  if (audioext.test(name)) return svg.audio;
  return svg.generic;
}

export const siteutils = {
  audioext,
  basename,
  esc,
  extname,
  formatbytes,
  formattimecompact,
  iconfor,
  imageext,
  norm,
  rawurl,
  svg,
  thumburl,
  videoext
};

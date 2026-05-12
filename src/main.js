"use strict";

import {drive} from "./utils.js";
import {mdhelper} from "./markdown.js";
import {drivetree} from "./filetree.js";
import {drivediscord} from "./login.js";
import {drivemedia} from "./media.js";
import {ctxmenu} from "./contextmenu.js";

const rootprefix = "soggy cat";
const cachekey = "sogtree";
const ttlms = 24 * 60 * 60 * 1000;

const {
  audioext, basename, esc, extname, formatbytes, formattimecompact,
  iconfor, imageext, norm, rawurl, svg, thumburl, videoext
} = drive;

const drivegrid = document.querySelector(".drivegrid"),
  searchinput = document.querySelector(".searchinput"),
  refreshbutton = document.querySelector(".refreshbutton"),
  refreshtime = document.querySelector(".refreshtime"),
  viewlist = document.querySelector(".viewlist"),
  viewsquare = document.querySelector(".viewsquare"),
  goog = document.querySelector(".goog"),
  backbutton = document.querySelector(".backbutton"),
  readmebutton = document.querySelector(".readmebutton"),
  commentsbutton = document.querySelector(".commentsbutton"),
  readmeclose = document.querySelector(".readmeclose"),
  loginhint = document.querySelector(".loginhint"),
  discordavatarbutton = document.querySelector(".discordavatarbutton"),
  discordmenu = document.querySelector(".discordmenu"),
  discordmenuavatar = document.querySelector(".discordmenuavatar"),
  discordmenuname = document.querySelector(".discordmenuname"),
  discordmenulogout = document.querySelector(".discordmenulogout"),
  medialightbox = document.querySelector(".medialightbox"),
  mediabackdrop = document.querySelector(".mediabackdrop"),
  mediaclose = document.querySelector(".mediaclose"),
  mediacontent = document.querySelector(".mediacontent"),
  medianavleft = document.querySelector(".medianavleft"),
  medianavright = document.querySelector(".medianavright"),
  mediaregionlayer = document.querySelector(".mediaregionlayer"),
  medicomments = document.querySelector(".mediacomments"),
  medicommentslist = document.querySelector(".mediacommentslist"),
  mediainfo = document.querySelector(".mediainfo"),
  mqnarrow = window.matchMedia("(max-aspect-ratio: 3/4)");

const readrivemediaoc = document.querySelector(".readmecontent");
const readmenavbtns = document.querySelectorAll(".readmenavbtn");
const pfphtml = discordavatarbutton ? discordavatarbutton.innerHTML : "";

const commentsarchiveurl = "assets/static/drivearchive.json";
const commentsindexapi = "https://api.soggy.cat/v1/comments";
const commentslivebase = "https://api.soggy.cat";

let pathhistory = [];

const state = {
  tree: [], branch: "main",
  cwd: "", filter: "",
  listmode: false, truncated: false,
  commentsopen: false
};

/*//////////////////////////////////////////////////////////////////////*/

const devtools = {
  isopen: false,
  orientation: undefined
};
const threshold = 170;

function hello() {
  try {new Audio("assets/audio/hello.mp3").play()}
  catch {}
}
const emitevent = (isopen, orientation) => {
  globalThis.dispatchEvent(new globalThis.CustomEvent("devtoolschange", {detail: {isopen, orientation}}));
  if (isopen) {hello()}
};
const main = ({emitevents = true} = {}) => {
  const widththresh = globalThis.outerWidth - globalThis.innerWidth > threshold;
  const heightthresh = globalThis.outerHeight - globalThis.innerHeight > threshold;
  const orientation = widththresh ? "vertical" : "horizontal";
  if (!(heightthresh && widththresh) && ((
    globalThis.Firebug && globalThis.Firebug.chrome && 
    globalThis.Firebug.chrome.isInitialized) || widththresh || heightthresh)
  ) {
    if ((!devtools.isopen || devtools.orientation !== orientation) && emitevents) {emitevent(true, orientation)}
    devtools.isopen = true;
    devtools.orientation = orientation;
  } else {
    if (devtools.isopen && emitevents) {emitevent(false, undefined)}
    devtools.isopen = false;
    devtools.orientation = undefined;
  }
};
main({emitevents: false});
setInterval(main, 500);

/*//////////////////////////////////////////////////////////////////////*/

function loadsettings() {
  try {
    const s = JSON.parse(localStorage.getItem("settings") || "{}");
    return s && typeof s === "object" ? s : {};
  } catch {return {}}
}
function savesettings(next) {
  try {localStorage.setItem("settings", JSON.stringify(next))} catch (_) {}
}
function setsetting(key, value) {
  const s = loadsettings();
  s[key] = value;
  savesettings(s);
}
function getsetting(key, fallback) {
  const s = loadsettings();
  return s[key] === undefined ? fallback : s[key];
}

function hidehint() {
  if (!loginhint) return;
  loginhint.hidden = true;
  loginhint.classList.remove("fade");
}

const discord = drivediscord({
  esc, setsetting, getsetting,
  commentslivebase, loginhint,
  discordavatarbutton, discordmenu,
  discordmenuavatar, discordmenuname,
  discordmenulogout, pfpdefault: pfphtml,
  hidehint
});

function syncback() {
  if (!backbutton) return;
  backbutton.disabled = pathhistory.length === 0;
  backbutton.setAttribute("aria-disabled", pathhistory.length > 0 ? "false" : "true");
}

function resetpath() {
  pathhistory = [];
  syncback();
}

function hashpath() {
  const h = String(location.hash || "");
  if (!h || h === "#") return "";
  const m = h.match(/^#file=(.+)$/);
  const raw = m ? m[1] : h.startsWith("#") ? h.slice(1) : h;
  try {return decodeURIComponent(raw)} catch {return ""}
}
function sethashpath(path) {
  const p = String(path || "");
  const nh = p ? `#${encodeURI(p)}` : "";
  if (location.hash !== nh) history.replaceState({}, "", `${location.pathname}${location.search}${nh}`);
}

let media;

function openfromhash() {
  const p = hashpath();
  if (!p) return;
  const normp = String(p).replace(/^\/+/, "");
  const folderonly = state.tree.some(x => x.type === "tree" && x.path === normp);
  if (folderonly) {
    if (state.cwd !== normp) {
      pathhistory = [""];
      state.cwd = normp;
      syncback();
      rendergrid();
    }
    return;
  }
  const item = state.tree.find(x => x.type === "blob" && x.path === normp);
  if (!item) return;
  const folder = normp.includes("/") ? normp.slice(0, normp.lastIndexOf("/")) : "";
  if (state.cwd !== folder) {
    pathhistory = [""];
    state.cwd = folder;
    syncback();
    rendergrid();
  }
  media.openlightbox(rawurl(normp), normp, videoext.test(normp));
}

function rendergrid() {
  const all = tree.listchildren(state.cwd).filter(x => x.name.toLowerCase().includes(state.filter.toLowerCase()));
  const folders = all.filter(x => x.kind === "folder");
  const files = all.filter(x => x.kind === "file");
  drivegrid.innerHTML = "";
  if (!all.length) {
    drivegrid.innerHTML = `<div class="emptystate">${state.filter ? "No files match your search." : "This folder is empty."}</div>`;
    return;
  }
  if (folders.length) {
    const row = document.createElement("div");
    row.className = "folderrow";
    for (const f of folders) {
      const card = document.createElement("div");
      card.className = "foldercard";
      card.innerHTML = `${svg.folder}<span class="name"></span>`;
      card.querySelector(".name").textContent = f.name;
      card.addEventListener("click", () => navigate(f.path, {stack: true}));
      row.appendChild(card);
    }
    drivegrid.appendChild(row);
  }
  if (files.length) {
    const grid = document.createElement("div");
    grid.className = `filegrid${state.listmode ? " listmode" : ""}`;
    for (const f of files) {
      const card = document.createElement("div");
      card.className = "filecard";
      card.setAttribute("data-filepath", f.path);
      card.setAttribute("data-filename", f.name);
      const isimg = imageext.test(f.name);
      const isvid = videoext.test(f.name);
      const thumb = (isimg || isvid)
        ? `<img class="thumbimg thumbimgpending" data-src="${thumburl(f.path)}" alt="" loading="lazy">`
        : "";

      // card template
      card.innerHTML =
        `<div class="filehead">${iconfor(f.name)}<span class="name"></span>` +
        `<button type="button" class="filemore" aria-label="file options" title="options">` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960">` +
        `<path d="M480-160q-33 0-56-23t-24-57 24-56 56-24 57 24 23 56-23 57-57 23m0-240q-33 0-56-23t-24-57 24-56 56-24 57 24 23 56-23 57-57 23m0-240q-33 0-56-23t-24-57 24-56 56-24 57 24 23 56-23 57-57 23"/>` +
        `</svg>` +
        `</button>` +
        `</div>` +
        `<div class="thumb">` +
        `<div class="thumbicon">${iconfor(f.name)}</div>` +
        `${thumb || '<div class="thumbfallback">click to open</div>'}` +
        `</div>`;

      card.querySelector(".name").textContent = f.name;
      const more = card.querySelector(".filemore");
      if (more) {
        more.addEventListener("click", e => {
          e.stopPropagation();
          globalThis.dispatchEvent(new globalThis.CustomEvent("drivecontext:open", {
            detail: {source: "button", x: e.clientX, y: e.clientY, filepath: f.path}
          }));
        });
      }
      card.addEventListener("click", e => {
        if (isimg || isvid) {
          media.openlightbox(rawurl(f.path), f.path, !!isvid);
          return;
        }
        window.open(rawurl(f.path), "_blank", "noopener,noreferrer");
      });
      grid.appendChild(card);
    }
    drivegrid.appendChild(grid);
  }

  const imgs = drivegrid.querySelectorAll("img.thumbimg[data-src]");
  if (imgs.length) {
    const root = document.querySelector(".drivecontent") || null;
    const io = new IntersectionObserver((entries, obs) => {
      for (const ent of entries) {
        if (!ent.isIntersecting) continue;
        const img = ent.target;
        const src = img.getAttribute("data-src");
        if (src) {
          img.addEventListener("load", () => img.classList.remove("thumbimgpending"), {once: true});
          img.src = src;
          img.removeAttribute("data-src");
          img.addEventListener("error", () => img.remove(), {once: true});
        }
        obs.unobserve(img);
      }
    }, {root, rootMargin: "50% 0px 50% 0px", threshold: 0.01});
    for (const img of imgs) io.observe(img);
  }
}

const tree = drivetree({
  state, rootprefix, cachekey, ttlms,
  drivegrid, refreshtime, esc, norm,
  resetpath, rendergrid,
  openfromhash
});

media = drivemedia({
  state, getsetting, setsetting,
  esc, basename, extname,
  formatbytes, formattimecompact,
  imageext, videoext, audioext,
  rawurl, listchildren: tree.listchildren,
  sethash: sethashpath, hidehint,
  commentsarchiveurl, commentsindexapi, commentslivebase,
  medialightbox, mediabackdrop, mediaclose,
  mediacontent, medianavleft, medianavright, mediaregionlayer,
  medicomments, medicommentslist, mediainfo
});

function navigate(path, opts) {
  const next = norm(path);
  if (opts?.crumb) pathhistory = [];
  else if (opts?.stack && next !== state.cwd) pathhistory.push(state.cwd);
  state.cwd = next;
  syncback();
  rendergrid();
}

function gobackfolder() {
  if (!pathhistory.length) return;
  state.cwd = pathhistory.pop() || "";
  syncback();
  rendergrid();
}

function setcomments(show) {
  state.commentsopen = show;
  if (commentsbutton)
    commentsbutton.classList.toggle("commentsmuted", !show);
  setsetting("commentson", show ? 1 : 0);
  hidehint();
}

const {showmddoc} = mdhelper({
  readrivemediaoc, readmenavbtns,
  setsetting, esc
});

function readmepref(open) {
  setsetting(mqnarrow.matches ? "readmenarrow" : "readmewide", open ? 1 : 0);
}
function readmeinit() {
  return mqnarrow.matches ? getsetting("readmenarrow", 0) === 1 : getsetting("readmewide", 1) !== 0;
}
function togglereadme() {
  if (!goog) return;
  const open = !goog.classList.contains("readmeopen");
  goog.classList.toggle("readmeopen", open);
  if (readmebutton) readmebutton.classList.toggle("readmeclosed", !open);
  readmepref(open);
}
function updatenarrowclass() {
  if (goog) goog.classList.toggle("narrowaspect", mqnarrow.matches);
}
(mqnarrow.addEventListener
  ? mqnarrow.addEventListener("change", updatenarrowclass)
  : mqnarrow.addListener(updatenarrowclass));
updatenarrowclass();

if (goog) {
  goog.classList.toggle("readmeopen", readmeinit());
  if (readmebutton)
    readmebutton.classList.toggle("readmeclosed", !goog.classList.contains("readmeopen"));
  goog.classList.add("initialized");
}

function setview(listmode) {
  state.listmode = listmode;
  viewlist.classList.toggle("active", listmode);
  viewsquare.classList.toggle("active", !listmode);
  setsetting("viewmode", listmode ? "list" : "grid");
  rendergrid();
}
function readmebtn() {
  if (!readmebutton || !goog) return;
  readmebutton.classList.toggle("readmeclosed", !goog.classList.contains("readmeopen"));
}

discord.wireui({
  medialightbox,
  oncomments: () => media.refreshcomments()
});

searchinput.addEventListener("input", () => {
  state.filter = searchinput.value.trim();
  rendergrid();
});
refreshbutton.addEventListener("click", () => {
  tree.clearcache();
  pathhistory = [];
  syncback();
  tree.setrefreshtime();
  tree.loadtree(true);
});
viewlist.addEventListener("click", () => setview(true));
viewsquare.addEventListener("click", () => setview(false));
if (backbutton) backbutton.addEventListener("click", gobackfolder);
if (readmebutton) readmebutton.addEventListener("click", togglereadme);
if (readmeclose) readmeclose.addEventListener("click", togglereadme);
for (const b of readmenavbtns) {
  b.addEventListener("click", () => showmddoc(b.getAttribute("data-doc") || "README.md"));
}
if (commentsbutton)
  commentsbutton.addEventListener("click", () => {
    setcomments(!state.commentsopen);
    if (medialightbox && !medialightbox.hidden) {
      media.refreshcomments();
    }
  });

window.addEventListener("resize", () => {
  media.relayout();
});
if (mediaclose) mediaclose.addEventListener("click", media.closelightbox);
if (mediabackdrop) mediabackdrop.addEventListener("click", () => {
  if (media.hasfocus()) media.clearcommentfocus();
  else media.closelightbox();
});
{
  const box = document.querySelector(".mediabox");
  if (box) box.addEventListener("click", e => {
    if (!medialightbox || medialightbox.hidden) return;
    const t = e.target;
    const inregionlayer = !!mediaregionlayer?.contains(t);
    if (mediacontent?.contains(t)) return;
    if (medicomments?.contains(t)) return;
    if (inregionlayer) return;
    if (mediaclose?.contains?.(t)) return;
    if (medianavleft?.contains?.(t) || medianavright?.contains?.(t)) return;
    media.clearcommentfocus();
  });
}
if (medianavleft) medianavleft.addEventListener("click", () => media.steplightboximage(-1));
if (medianavright) medianavright.addEventListener("click", () => media.steplightboximage(1));
if (medicommentslist) {
  medicommentslist.addEventListener("wheel", e => {
    e.stopPropagation();
  }, {passive: true});
  medicommentslist.addEventListener("touchmove", e => e.stopPropagation(), {passive: true});
}

function trapscroll(e) {
  if (!medialightbox || medialightbox.hidden) return;
  const t = e.target;
  if ((medicomments && medicomments.contains(t)) || (medicommentslist && medicommentslist.contains(t))) return;
  e.preventDefault();
}
document.addEventListener("wheel", trapscroll, {passive: false, capture: false});
document.addEventListener("touchmove", trapscroll, {passive: false, capture: false});

window.addEventListener("hashchange", () => {
  if (medialightbox && !medialightbox.hidden) media.closelightbox();
  openfromhash();
});
document.addEventListener("keydown", e => {
  if (medialightbox && !medialightbox.hidden) {
    if (e.key === "Escape") {media.closelightbox(); return}
    if (e.key === "ArrowLeft") {media.steplightboximage(-1); return}
    if (e.key === "ArrowRight") {media.steplightboximage(1); return}
    return;
  }
  if (e.key !== "Escape") return;
  if (goog && mqnarrow.matches && goog.classList.contains("readmeopen")) {
    goog.classList.remove("readmeopen");
    readmepref(false);
    readmebtn();
  }
});

/*//////////////////////////////////////////////////////////////////////*/

const pub = {
  rawurl, thumburl,
  openlightbox: (...a) => media.openlightbox(...a),
  imageext, videoext
};
globalThis.meow = pub;
ctxmenu(() => pub);

syncback();
readmebtn();
setcomments(getsetting("commentson", 0) === 1);
setview(getsetting("viewmode", "grid") === "list");
discord.updatediscordavatar();
discord.handlediscordoauthcallbackifpresent();
if (!(window.opener && window.opener !== window)) discord.resolvediscorduser();
showmddoc(getsetting("readrivemediaoc", "README.md"));
tree.loadtree(false);
window.setTimeout(openfromhash, 0);

"use strict";

export function ctxmenu(get) {
  function api() {
    return get() || null;
  }

  const drivecontent = document.querySelector(".drivecontent");
  const mediacontent = document.querySelector(".mediacontent");

  const icons = {
    preview: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M200-800v241-1 400zv200zm0 720q-33 0-56-23t-24-57v-640q0-33 24-56t56-24h320l240 240v100q-19-8-39-12t-41-7v-41H480v-200H200v640h241q16 24 36 45t44 35zm531-149q29-29 29-71t-29-71-71-29-71 29-29 71 29 71 71 29 71-29M864-40 756-148q-21 14-45 21t-51 7q-75 0-127-52t-53-128 53-127 127-53 128 53 52 127q0 26-7 51t-21 45L920-96z"/></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58zM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160z"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M760-200H320q-33 0-56-23t-24-57v-560q0-33 24-56t56-24h280l240 240v400q0 33-23 57t-57 23M560-640v-200H320v560h440v-360zM160-40q-33 0-56-23t-24-57v-560h80v560h440v80zm160-800v200zv560z"/></svg>`,
    thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M539-577.4a183 183 0 0 0-171 115.5c2.6 19.1 16.5 37.1 28.2 52.8A184 184 0 0 0 544-341.5c65-.7 127.6-38.9 157.7-96.5 14.2-16.5 7-35-4.4-51A183 183 0 0 0 539-577.3m1 62.3c40.6-.5 81.4 20.6 102.5 55.6-27.2 45.9-87.2 65.6-137.5 51.2a117 117 0 0 1-68.8-51.2A119 119 0 0 1 540-515m-1 4.4c-32.7-1.4-59.4 34.9-49 65.8 8.2 30.6 47.5 46.7 74.6 30.3 26.6-14.5 34.8-54 14.7-77a51 51 0 0 0-40.3-19"/><path d="M760-200c-149.4-.2-298.8.5-448.1-.4-45.8-3.1-78-49.5-71.9-93.6.2-184.7-.5-369.4.4-554.1 3.1-45.8 49.5-78 93.6-71.9h266l240 240c-.2 136 .5 272-.4 408.1-3 39.6-39.8 73-79.6 71.9M560-640v-200H320v560h440v-360zM160-40c-49 1.8-86.8-47-80-94v-546h80v560h440v80zm160-800v200zv560z"/></svg>`
  };

  function hashpath() {
    const h = String(location.hash || "");
    if (!h || h === "#") return "";
    const raw = h.startsWith("#") ? h.slice(1) : h;
    try {return decodeURIComponent(raw)} catch {return ""}
  }

  function closestcard(el) {
    if (!(el instanceof Element)) return null;
    return el.closest?.(".filecard") || null;
  }

  function pathfromcard(card) {
    const filepath = card?.getAttribute?.("data-filepath") || "";
    const filename = card?.getAttribute?.("data-filename") || (filepath ? filepath.split("/").pop() : "");
    return {filepath, filename};
  }

  function kindflags(filename) {
    const a = api();
    const name = String(filename || "");
    return {
      isimg: !!a?.imageext?.test?.(name),
      isvid: !!a?.videoext?.test?.(name)
    };
  }

  function labels(filename) {
    const {isimg, isvid} = kindflags(filename);
    return {
      preview: isvid ? "Preview video" : "Preview image",
      download: isvid ? "Download video" : "Download image",
      copy: isvid ? "Copy video" : "Copy image"
    };
  }

  function ensurewrap() {
    let wrap = document.querySelector(".contextmenuwrap");
    if (wrap) return wrap;
    wrap = document.createElement("div");
    wrap.className = "contextmenuwrap";
    wrap.hidden = true;
    wrap.innerHTML = `<div class="contextmenubackdrop"></div><div class="contextmenu" role="menu" aria-label="options"></div>`;
    document.body.appendChild(wrap);
    wrap.querySelector(".contextmenubackdrop")?.addEventListener("click", hidewrap);
    document.addEventListener("keydown", e => {if (e.key === "Escape") hidewrap()});
    window.addEventListener("resize", () => hidewrap());
    window.addEventListener("scroll", () => hidewrap(), {passive: true, capture: false});
    return wrap;
  }

  function hidewrap() {
    const wrap = document.querySelector(".contextmenuwrap");
    if (!wrap) return;
    wrap.hidden = true;
    const m = wrap.querySelector(".contextmenu");
    if (m) m.innerHTML = "";
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function placeat(menu, x, y) {
    const pad = 8;
    const mw = menu.offsetWidth || 260;
    const mh = menu.offsetHeight || 260;
    const vw = document.documentElement.clientWidth || window.innerWidth || 1;
    const vh = document.documentElement.clientHeight || window.innerHeight || 1;
    menu.style.left = `${clamp(x, pad, vw - mw - pad)}px`;
    menu.style.top = `${clamp(y, pad, vh - mh - pad)}px`;
  }

  const blobcache = new Map();
  async function fetchblob(url) {
    if (blobcache.has(url)) return blobcache.get(url);
    const res = await fetch(url, {cache: "force-cache"});
    if (!res.ok) throw new Error(`fetch failed (${res.status})`);
    const b = await res.blob();
    blobcache.set(url, b);
    return b;
  }

  async function dlblob(url, filename) {
    const blob = await fetchblob(url);
    const objurl = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = objurl;
      a.rel = "noopener noreferrer";
      a.download = String(filename || "");
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(objurl), 30_000);
    }
  }

  async function clipblob(url, filename, kindlabel, {allowurlfallback} = {allowurlfallback: true}) {
    try {
      const blob = await fetchblob(url);
      const type = blob.type || "application/octet-stream";
      if (navigator.clipboard && globalThis.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({[type]: blob})]);
        return;
      }
      if (allowurlfallback && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return;
      }
    } catch {
      try {
        if (allowurlfallback && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          return;
        }
      } catch {}
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return;
      }
    } catch {}
    alert(`${kindlabel} couldn't be copied.`);
  }

  function showpop({x, y, filepath, inpreview}) {
    const a = api();
    if (!a || !filepath) return;
    const filename = filepath.split("/").pop() || filepath;
    const lb = labels(filename);
    const wrap = ensurewrap();
    const menu = wrap.querySelector(".contextmenu");
    if (!menu) return;
    menu.innerHTML = "";

    const items = [];
    if (!inpreview) {
      items.push({
        icon: icons.preview,
        label: lb.preview,
        action: () => a.openlightbox(a.rawurl(filepath), filepath, !!a.videoext?.test?.(filename))
      });
    }
    items.push(
      {
        icon: icons.download,
        label: lb.download,
        action: () => dlblob(a.rawurl(filepath), filename).catch(() => {
          window.open(a.rawurl(filepath), "_blank", "noopener,noreferrer");
        })
      },
      {
        icon: icons.copy,
        label: lb.copy,
        action: () => clipblob(a.rawurl(filepath), filename, lb.copy, {allowurlfallback: true})
      },
      {
        icon: icons.thumbnail,
        label: "Copy thumbnail",
        action: () => clipblob(
          a.thumburl(filepath),
          `${filename.replace(/\.[^.]+$/, "")}.webp`,
          "Thumbnail", {allowurlfallback: true}
        )
      }
    );

    for (const it of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "contextmenuitem";
      btn.setAttribute("role", "menuitem");
      btn.innerHTML = `<span class="contextmenuicon">${it.icon}</span><span class="contextmenutext"></span>`;
      btn.querySelector(".contextmenutext").textContent = it.label;
      btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        hidewrap();
        it.action();
      });
      menu.appendChild(btn);
    }

    wrap.hidden = false;
    requestAnimationFrame(() => placeat(menu, x, y));
  }

  function showfromev(e, opts = {}) {
    const card = closestcard(e.target);
    const filepath = opts.filepath || pathfromcard(card).filepath;
    if (!filepath) return;
    e.preventDefault();
    e.stopPropagation();
    showpop({x: e.clientX, y: e.clientY, filepath, inpreview: !!opts.inpreview});
  }

  if (drivecontent) {
    drivecontent.addEventListener("contextmenu", e => {
      if (!closestcard(e.target)) return;
      showfromev(e, {inpreview: false});
    }, {capture: false});

    let holdtimer = 0;
    let holdstart = null;
    function clearhold() {
      if (holdtimer) window.clearTimeout(holdtimer);
      holdtimer = 0;
      holdstart = null;
    }

    drivecontent.addEventListener("pointerdown", e => {
      if (e.button && e.button !== 0) return;
      if (!closestcard(e.target)) return;
      if (e.pointerType === "mouse") return;
      clearhold();
      holdstart = {x: e.clientX, y: e.clientY, target: e.target};
      holdtimer = window.setTimeout(() => {
        holdtimer = 0;
        const c = closestcard(holdstart?.target);
        const filepath = pathfromcard(c).filepath;
        if (!filepath) return;
        showpop({x: holdstart.x, y: holdstart.y, filepath,inpreview: false});
      }, 520);
    }, {passive: false});

    drivecontent.addEventListener("pointerup", clearhold, {passive: false});
    drivecontent.addEventListener("pointercancel", clearhold, {passive: false});
    drivecontent.addEventListener("pointermove", e => {
      if (!holdstart || !holdtimer) return;
      if (Math.abs(e.clientX - holdstart.x) > 12 || Math.abs(e.clientY - holdstart.y) > 12) clearhold();
    }, {passive: false});
    drivecontent.addEventListener("scroll", clearhold, {passive: true, capture: false});
  }

  if (mediacontent) {
    mediacontent.addEventListener("contextmenu", e => {
      const regionlayer = document.querySelector(".mediaregionlayer");
      if (regionlayer?.classList.contains("selecting")) return;
      const filepath = hashpath();
      if (!filepath) return;
      e.preventDefault();
      e.stopPropagation();
      showpop({x: e.clientX, y: e.clientY, filepath, inpreview: true});
    }, {capture: false});
  }

  window.addEventListener("drivecontext:open", e => {
    const d = e?.detail || {};
    const filepath = String(d.filepath || "");
    if (!filepath) return;
    showpop({x: Number(d.x || 0), y: Number(d.y || 0), filepath,inpreview: false});
  });
}

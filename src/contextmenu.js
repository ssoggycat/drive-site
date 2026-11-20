"use strict";

export function ctxmenu(get) {
  function api() {
    return get() || null;
  }

  const drivecontent = document.querySelector(".drivecontent");
  const mediacontent = document.querySelector(".mediacontent");

  const icons = {
    newtab: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120zm188-212-56-56 372-372H560v-80h280v280h-80v-144z"/></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58zM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160z"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M760-200H320q-33 0-56-23t-24-57v-560q0-33 24-56t56-24h280l240 240v400q0 33-23 57t-57 23M560-640v-200H320v560h440v-360zM160-40q-33 0-56-23t-24-57v-560h80v560h440v80zm160-800v200zv560z"/></svg>`,
    link: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M440-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h160v80H280q-50 0-85 35t-35 85q0 50 35 85t85 35h160zM320-440v-80h320v80zm200 160v-80h160q50 0 85-35t35-85q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280z"/></svg>`,
    media: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120zm0-80h560v-560H200zm40-80h480L570-480 450-320l-90-120zm-40 80v-560z"/></svg>`,
    folder: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#9aa0a6" viewBox="0 -960 960 960"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160zm0-80h640v-400H447l-80-80H160zm0 0v-480z"/></svg>`
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

  function labels(isvid) {
    return {
      newtab: isvid ? "Preview video in new tab" : "Preview image in new tab",
      download: isvid ? "Download video" : "Download image",
      copy: isvid ? "Copy video" : "Copy image",
      copylink: "Copy link",
      copymedialink: isvid ? "Copy video link" : "Copy image link"
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

  /*//////////////////////////////////////////////////////////////////////*/

  async function imagepng(url) {
    const blob = await fetchblob(url);
    if (blob.type === "image/png") return blob;

    const objurl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objurl;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return await new Promise((resolve, reject) => {
        canvas.toBlob(png => {
          if (png) resolve(png);
          else reject(new Error("Image conversion failed"));
        }, "image/png");
      });
    } finally {
      URL.revokeObjectURL(objurl);
    }
  }

  async function clipimage(url) {
    const clipboard = navigator.clipboard;
    if (!clipboard?.write || !globalThis.ClipboardItem) {
      window.alert("This browser does not support copying images here.");
      return;
    }

    const png = imagepng(url);
    try {
      await Promise.all([png, clipboard.write([new ClipboardItem({"image/png": png})])]);
    } catch (error) {
      png.catch(() => {});
      const message = error?.name === "NotAllowedError"
        ? "Could not copy the image. Check clipboard permissions for this site and try again."
        : "Could not copy the image. Try again or use Download image.";
      window.alert(message);
    }
  }

  async function clipvideo(url) {
    try {
      const blob = await fetchblob(url);
      const type = blob.type || "application/octet-stream";
      await navigator.clipboard.write([new ClipboardItem({[type]: blob})]);
    } catch {
      cliptext(url);
    }
  }

  function cliptext(text) {
    try {navigator.clipboard?.writeText?.(text)?.catch?.(() => {})} catch {}
  }

  /*//////////////////////////////////////////////////////////////////////*/

  function openmenu(x, y, items) {
    const wrap = ensurewrap();
    const menu = wrap.querySelector(".contextmenu");
    if (!menu) return;
    menu.innerHTML = "";

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

  function showfolderpop({x, y, folderpath}) {
    const a = api();
    if (!a || !folderpath) return;
    openmenu(x, y, [
      {
        icon: icons.folder,
        label: "Open folder",
        action: () => a.openfolder?.(folderpath)
      },
      {
        icon: icons.link,
        label: "Copy link",
        action: () => cliptext(a.sharelink(folderpath))
      }
    ]);
  }

  function showpop({x, y, filepath}) {
    const a = api();
    if (!a || !filepath) return;
    const filename = filepath.split("/").pop() || filepath;
    const isvid = a.videoext?.test?.(filename);
    const lb = labels(isvid);

    const items = [
      {
        icon: icons.newtab,
        label: lb.newtab,
        action: () => window.open(a.rawurl(filepath), "_blank", "noopener,noreferrer")
      },
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
        action: () => isvid ? clipvideo(a.rawurl(filepath)) : clipimage(a.rawurl(filepath))
      },
      {
        icon: icons.link,
        label: lb.copylink,
        action: () => cliptext(a.sharelink(filepath))
      },
      {
        icon: icons.media,
        label: lb.copymedialink,
        action: () => cliptext(a.rawurl(filepath))
      }
    ];

    openmenu(x, y, items);
  }

  function showfromev(e, opts = {}) {
    const card = closestcard(e.target);
    const folderpath = card?.getAttribute?.("data-folderpath") || "";
    if (folderpath) {
      e.preventDefault();
      e.stopPropagation();
      showfolderpop({x: e.clientX, y: e.clientY, folderpath});
      return;
    }
    const filepath = opts.filepath || pathfromcard(card).filepath;
    if (!filepath) return;
    e.preventDefault();
    e.stopPropagation();
    showpop({x: e.clientX, y: e.clientY, filepath});
  }

  if (drivecontent) {
    drivecontent.addEventListener("contextmenu", e => {
      if (!closestcard(e.target)) return;
      showfromev(e);
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
        const folderpath = c?.getAttribute?.("data-folderpath") || "";
        if (folderpath) {showfolderpop({x: holdstart.x, y: holdstart.y, folderpath}); return}
        const filepath = pathfromcard(c).filepath;
        if (!filepath) return;
        showpop({x: holdstart.x, y: holdstart.y, filepath});
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
      showpop({x: e.clientX, y: e.clientY, filepath});
    }, {capture: false});
  }

  window.addEventListener("drivecontext:open", e => {
    const d = e?.detail || {};
    const filepath = String(d.filepath || "");
    if (!filepath) return;
    showpop({x: Number(d.x || 0), y: Number(d.y || 0), filepath});
  });
}

"use strict";

export function mdhelper(deps) {
    const readrivemediaoc = deps.readrivemediaoc;
    const readmenavbtns = deps.readmenavbtns;
    const setsetting = deps.setsetting;
    const esc = deps.esc;
    const mdcache = new Map();

    function mdtohtml(md) {
      const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
      let out = "";
      let incode = false;
      for (const line of lines) {
        if (line.startsWith("```")) {
          incode = !incode;
          out += incode ? "<pre><code>" : "</code></pre>";
          continue;
        }
        if (incode) {out += `${esc(line)}\n`; continue}
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
          const lvl = h[1].length;
          out += `<h${lvl}>${h[2]}</h${lvl}>`;
          continue;
        }
        if (!line.trim()) {out += ""; continue}
        if (line.trim().startsWith("<")) out += line;
        else if (line.includes("<")) out += `<p>${line}</p>`;
        else out += `<p>${esc(line)}</p>`;
      }
      return out;
    }

    async function loadmddoc(name) {
      if (!readrivemediaoc) return;
      const key = String(name || "README.md");
      if (mdcache.has(key)) return mdcache.get(key);
      const islocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
      const bust = islocal ? `?t=${Date.now()}` : "";
      const res = await fetch(`${key}${bust}`, {cache: islocal ? "no-store" : "force-cache"});
      const txt = res.ok ? await res.text() : `# missing\ncould not load ${key}`;
      mdcache.set(key, txt);
      return txt;
    }

    async function showmddoc(name) {
      if (!readrivemediaoc) return;
      const key = String(name || "README.md");
      const txt = await loadmddoc(key);
      readrivemediaoc.innerHTML = mdtohtml(txt);
      for (const b of readmenavbtns)
        b.classList.toggle("active", b.getAttribute("data-doc") === key);
      setsetting("readrivemediaoc", key);
    }

  return {showmddoc};
}

"use strict";

// requests & caches the guweh.com file tree, and folder list helpers
export function drivetree(deps) {
    const state = deps.state;
    const rootprefix = deps.rootprefix;
    const cachekey = deps.cachekey;
    const ttlms = deps.ttlms;
    const drivegrid = deps.drivegrid;
    const refreshtime = deps.refreshtime;
    const esc = deps.esc;
    const norm = deps.norm;

    function setrefreshtime(h) {
      refreshtime.textContent = Number.isFinite(h) && h >= 0 ? `${h}h` : "--";
    }
    function loadcache() {
      try {
        const d = JSON.parse(localStorage.getItem(cachekey) || "null");
        if (!d || !Array.isArray(d.tree) || typeof d.savedat !== "number") return null;
        if (Date.now() - d.savedat > ttlms) return null;
        return d;
      } catch {return null}
    }
    function savecache(data) {
      try {localStorage.setItem(cachekey, JSON.stringify({...data, savedat: Date.now()}))} catch (_) {}
    }
    function clearcache() {
      try {localStorage.removeItem(cachekey)} catch (_) {}
    }

    async function mirrorfetchjson(path) {
      const res = await fetch(`https://mirror.guweh.com/${path}`, {cache: "force-cache"});
      if (!res.ok) throw new Error(`mirror fetch failed (${res.status})`);
      return await res.json();
    }

    async function fetchtreemirror() {
      const [images, videos] = await Promise.all([
        mirrorfetchjson("images.json"),
        mirrorfetchjson("videos.json")
      ]);
      const imgrows = Array.isArray(images) ? images : [];
      const vidrows = Array.isArray(videos) ? videos : [];
      const blobs = [];
      for (const name of imgrows) {
        if (typeof name !== "string" || !name.trim()) continue;
        const p = name.replace(/^\/+/, "");
        if (!p || p.includes("..")) continue;
        blobs.push({type: "blob", path: p });
      }
      for (const name of vidrows) {
        if (typeof name !== "string" || !name.trim()) continue;
        const p = name.replace(/^\/+/, "");
        if (!p || p.includes("..")) continue;
        blobs.push({type: "blob", path: p});
      }
      return {tree: blobs, branch: "mirror", truncated: false};
    }

    async function githubfetch(path) {
      return (await fetch(`https://api.github.com${path}`,
        {headers: {Accept: "application/vnd.github+json"}})).json();
    }
    async function fetchtreefresh() {
      const meta = await githubfetch(`/repos/ssoggycat/drive-3`);
      state.branch = meta.default_branch || "main";
      const branch = await githubfetch(`/repos/ssoggycat/drive-3/branches/${state.branch}`);
      const gitcommit = await githubfetch(`/repos/ssoggycat/drive-3/git/commits/${branch.commit.sha}`);
      const tree = await githubfetch(`/repos/ssoggycat/drive-3/git/trees/${gitcommit.tree.sha}?recursive=1`);
      const filtered = (Array.isArray(tree.tree) ? tree.tree : [])
        .filter((x) => x.path === rootprefix || x.path.startsWith(`${rootprefix}/`))
        .map((x) => ({...x, path: x.path.slice(`${rootprefix}/`.length)}))
        .filter((x) => x.path && !x.path.split("/").some((seg) => seg.startsWith(".")));
      return {tree: filtered, branch: state.branch, truncated: !!tree.truncated};
    }

    function listchildren(prefix) {
      const p = norm(prefix);
      const out = new Map();
      for (const item of state.tree) {
        if (item.type !== "blob" && item.type !== "tree") continue;
        const rel = !p ? item.path : item.path.startsWith(`${p}/`) ? item.path.slice(p.length + 1) : null;
        if (!rel) continue;
        const parts = rel.split("/").filter(Boolean);
        const name = parts[0];
        if (!name || name.startsWith(".")) continue;
        if (parts.length === 1) out.set(name, {kind: item.type === "tree" ? "folder" : "file", name, path: item.path});
        else if (!out.has(name)) out.set(name, {kind: "folder", name, path: p ? `${p}/${name}` : name});
      }
      return [...out.values()].sort((a, b) => a.kind !== b.kind ? (a.kind === "folder" ? -1 : 1) : a.name.localeCompare(b.name));
    }

    function startloading() {
      let dots = 0;
      const icon = '<img class="sogdot" alt="" src="assets/svg/sog.svg">';
      const wrap = document.createElement("div");
      wrap.className = "loadingstate sogloading";
      drivegrid.innerHTML = "";
      drivegrid.appendChild(wrap);
      function tick() {
        dots = (dots % 3) + 1;
        wrap.innerHTML = icon.repeat(dots);
      }
      tick();
      const t = window.setInterval(tick, 450);
      return () => window.clearInterval(t);
    }

    async function loadtree(forcerefresh) {
      if (!forcerefresh) {
        const cached = loadcache();
        if (cached) {
          state.tree = cached.tree;
          state.branch = cached.branch || "main";
          state.truncated = !!cached.truncated;
          setrefreshtime(Math.floor((Date.now() - cached.savedat) / 3600000));
          deps.resetpath();
          deps.rendergrid();
          deps.openfromhash();
          return;
        }
      }
      const stoploading = startloading();
      try {
        let fresh = null;
        try {fresh = await fetchtreemirror()} catch (_) {}
        if (!fresh) fresh = await fetchtreefresh();
        stoploading();
        state.tree = fresh.tree;
        state.branch = fresh.branch;
        state.truncated = fresh.truncated;
        savecache({tree: state.tree, branch: state.branch, truncated: state.truncated});
        setrefreshtime(0);
        deps.resetpath();
        deps.rendergrid();
        deps.openfromhash();
      } catch (e) {
        stoploading();
        drivegrid.innerHTML = `<div class="errorstate">couldnt load repo :( ${esc(e.message || String(e))}</div>`;
      }
    }

  return {
    clearcache, listchildren,
    loadcache, loadtree,
    savecache, setrefreshtime
  };
}

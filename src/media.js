"use strict";

// preview, comment threads and image region selection/overlays
export function drivemedia(deps) {

    const state = deps.state;
    const getsetting = deps.getsetting;
    const setsetting = deps.setsetting;
    const esc = deps.esc;
    const basename = deps.basename;
    const extname = deps.extname;
    const formatbytes = deps.formatbytes;
    const formattimecompact = deps.formattimecompact;
    const imageext = deps.imageext;
    const videoext = deps.videoext;
    const rawurl = deps.rawurl;
    const listchildren = deps.listchildren;
    const sethash = deps.sethash;
    const hidehint = deps.hidehint;

    const commentsarchiveurl = deps.commentsarchiveurl;
    const commentsindexapi = deps.commentsindexapi;
    const commentslivebase = deps.commentslivebase;

    const medialightbox = deps.medialightbox;
    const mediabackdrop = deps.mediabackdrop;
    const mediaclose = deps.mediaclose;
    const mediacontent = deps.mediacontent;
    const medianavleft = deps.medianavleft;
    const medianavright = deps.medianavright;
    const mediaregionlayer = deps.mediaregionlayer;
    const medicomments = deps.medicomments;
    const medicommentslist = deps.medicommentslist;
    const mediainfo = deps.mediainfo;

    const commentscache = new Map();
    let commentsindexpromise = null;
    let commentsindexbyfile = null;
    let lightboxfilename = "";
    let lightboxcomments = [];
    let lightboximg = null;
    let lightboxnavitems = [];
    let lightboxnavindex = -1;
    let activereplyto = null;
    let activefocuskey = null;
    let activeregion = null;
    let regionselectstart = null;
    let regionpointerdown = null;
    let regioncycle = null;

    /*//////////////////////////////////////////////////////////////////////*/

    function updatemediainfo(pathname, extra = {}) {
      if (!mediainfo) return;
      const file = basename(pathname) || pathname;
      const item = state.tree.find(x => x.type === "blob" && x.path === pathname);
      const ext = extname(file);
      const kind = imageext.test(file)
        ? "image"
        : videoext.test(file)
        ? "video"
        : deps.audioext.test(file)
        ? "audio"
        : "file";
      const meta = [];
      const sz = formatbytes(item?.size);
      if (sz) meta.push(sz);
      if (extra.width && extra.height) meta.push(`${extra.width} x ${extra.height}px`);
      const dur = formattimecompact(extra.duration);
      if (dur) meta.push(dur);
      meta.push(ext ? `${kind}/${ext}` : kind);
      mediainfo.innerHTML =
        `<div class="mediainfofilename">${esc(file)}</div>` +
        meta.map(x => `<div class="mediainfometa">${esc(x)}</div>`).join("");
    }

    async function loadcommentsindex() {
      if (commentsindexbyfile) return commentsindexbyfile;
      if (!commentsindexpromise) {
        commentsindexpromise = (async () => {
          let j = null;
          try {
            const res = await fetch(commentsarchiveurl, {cache: "force-cache"});
            if (res.ok) j = await res.json();
          } catch (_) {}
          if (!j) {
            const res = await fetch(commentsindexapi, {cache: "force-cache"});
            if (!res.ok) return new Map();
            j = await res.json();
          }
          const files = Array.isArray(j?.files) ? j.files : [];
          const map = new Map();
          for (const f of files) {
            if (typeof f?.basename === "string")
              map.set(f.basename, Array.isArray(f?.comments) ? f.comments : []);
          }
          return map;
        })().catch(() => new Map());
      }
      commentsindexbyfile = await commentsindexpromise;
      return commentsindexbyfile;
    }

    /*//////////////////////////////////////////////////////////////////////*/

    async function fetchlivecomments(filename) {
      if (!commentslivebase || !filename) return [];
      try {
        const res = await fetch(`${commentslivebase}/comments?file=${encodeURIComponent(filename)}`, {cache: "no-store"});
        if (!res.ok) return [];
        const j = await res.json();
        return Array.isArray(j?.comments) ? j.comments : [];
      } catch {return []}
    }
    async function fetchcomments(filename) {
      if (!filename) return [];
      if (commentscache.has(filename)) return commentscache.get(filename);
      try {
        const idx = await loadcommentsindex();
        const archived = idx.get(filename) || [];
        const live = await fetchlivecomments(filename);
        const rows = [...archived, ...live]
          .map(c => {
            const replyingto = (typeof c?.replyingto === "string" && c.replyingto) ? c.replyingto : null;
            const region = Array.isArray(c?.region) && c.region.length === 4 ? c.region.map(Number) : null;
            const replyid = typeof c?.replyid === "string" && c.replyid ? c.replyid : null;
            return {...c, replyingto, region, replyid};
          })
          .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
        commentscache.set(filename, rows);
        return rows;
      } catch {return []}
    }

    function formattime(ms) {
      const n = Number(ms);
      if (!Number.isFinite(n)) return "";
      try {
        return new Date(n).toLocaleDateString(undefined, {year: "numeric", month: "long", day: "numeric"});
      } catch {return ""}
    }

    function regionequals(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 4 || b.length !== 4) return false;
      const eps = 1e-6;
      return Math.abs(Number(a[0]) - Number(b[0])) <= eps &&
        Math.abs(Number(a[1]) - Number(b[1])) <= eps &&
        Math.abs(Number(a[2]) - Number(b[2])) <= eps &&
        Math.abs(Number(a[3]) - Number(b[3])) <= eps;
    }

    function rendercommentpanel(comments) {
      if (!medicomments || !medicommentslist) return;
      if (!state.commentsopen) {
        medicomments.hidden = true;
        medicommentslist.innerHTML = "";
        activereplyto = null; activefocuskey = null;
        activeregion = null; hidehint();
        return;
      }
      medicomments.hidden = false;
      medicommentslist.innerHTML = "";
      hidehint();

      const loggedin = !!getsetting("discord_token", "");
      comments = (Array.isArray(comments) ? comments : []).filter(c => (c?.plain || "").trim().length > 0);
      if (!comments.length) return;
      const byid = new Map();
      for (const c of comments) {
        const key = c?.replyid ? String(c.replyid) : String(c?.id || "");
        if (key) byid.set(key, c);
      }

      const byparent = new Map();
      for (const c of comments) {
        const parentkey = c?.replyingto ? String(c.replyingto) : "__root__";
        if (!byparent.has(parentkey)) byparent.set(parentkey, []);
        byparent.get(parentkey).push(c);
      }

      for (const arr of byparent.values())
        arr.sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
      const roots = comments
        .filter(c => !c?.replyingto || !byid.has(String(c.replyingto)))
        .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));

      let focusedchainroot = null;
      if (activefocuskey) {
        for (const root of roots) {
          const stack = [root];
          while (stack.length) {
            const cur = stack.pop();
            const curkey = String(cur?.replyid || (cur?.id ? `id:${cur.id}` : ""));
            if (curkey && curkey === activefocuskey) {
              focusedchainroot = root;
              break;
            }
            const childkey = cur?.replyid ? String(cur.replyid) : String(cur?.id || "");
            const kids = childkey ? (byparent.get(childkey) || []) : [];
            for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
          }
          if (focusedchainroot) break;
        }
      }
      if (!focusedchainroot && activeregion) {
        for (const root of roots) {
          const stack = [root];
          let matched = false;
          while (stack.length) {
            const cur = stack.pop();
            if (regionequals(cur?.region, activeregion)) {matched = true; break}
            const childkey = cur?.replyid ? String(cur.replyid) : String(cur?.id || "");
            const kids = childkey ? (byparent.get(childkey) || []) : [];
            for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
          }
          if (matched) {focusedchainroot = root; break}
        }
      }
      for (const root of roots) {
        const chain = [];
        const stack = [{node: root, depth: 0}];
        while (stack.length) {
          const cur = stack.pop();
          chain.push(cur);
          const childkey = cur.node?.replyid ? String(cur.node.replyid) : String(cur.node?.id || "");
          const kids = childkey ? (byparent.get(childkey) || []) : [];
          for (let i = kids.length - 1; i >= 0; i--) stack.push({node: kids[i], depth: cur.depth + 1});
        }

        const chainwrap = document.createElement("div");
        chainwrap.className = "mediacommentchain";
        const chainisfocused = !focusedchainroot || focusedchainroot === root;
        chainwrap.classList.toggle("dimmed", !chainisfocused);
        chainwrap.hidden = false;
        for (const item of chain) {
          const c = item.node;
          const cid = String(c.replyid || (c.id ? `id:${c.id}` : ""));
          const card = document.createElement("div");
          card.className = `mediacomment clickable${item.depth > 0 ? " isreply" : ""}`;
          const author = esc(c.author || "unknown");
          const txt = esc(c.plain || "");
          const when = esc(formattime(c.id));
          const pfp = typeof c.authorpfp === "string" ? c.authorpfp : "";
          const src = String(pfp);
          const isgoogle = src.includes("googleusercontent.com");
          const isdiscord = src.includes("discordapp.com") || src.includes("discord.com");
          const badge = isgoogle ? "assets/svg/drive.svg" : isdiscord ? "assets/svg/discord.svg" : "";

          // comment template
          card.innerHTML =
            `<div class="mediacommentrow">` +
            `<div class="mediacommentpfpwrap">` +
            `<img class="mediacommentpfp" alt="" referrerpolicy="no-referrer" src="${esc(pfp)}">` +
            (badge ? `<img class="mediacommentsource" alt="" src="${badge}">` : ``) +
            `</div>` +
            `<div>` +
            `<div class="mediacommentmeta">` +
            `<div class="mediacommentauthor">${author}</div>` +
            `<div class="mediacommenttime">${when}</div>` +
            `</div>` +
            `<div class="mediacommentbody"><div class="mediacommenttext">${txt}</div></div>` +
            `</div>` +
            `</div>`;

          card.addEventListener("click", e => {
            if (!state.commentsopen) return;
            if (!cid) return;
            e.stopPropagation();
            activereplyto = c.replyid ? String(c.replyid) : null;
            activefocuskey = cid;
            activeregion = Array.isArray(c.region) ? c.region : null;
            renderregions(comments);
            rendercommentpanel(comments);
          });

          chainwrap.appendChild(card);
          if (loggedin && activefocuskey && activefocuskey === cid) {
            const composer = document.createElement("div");
            composer.className = "mediacomment commentcomposerwrap";

            // reply prompt template
            composer.innerHTML =
              `<textarea class="commentcompose" rows="3" placeholder="reply to a comment.."></textarea>` +
              `<div class="commentcomposeactions">` +
              `<button type="button" class="commentpost">post</button>` +
              `</div>`;

            const postbtn = composer.querySelector(".commentpost");
            const textarea = composer.querySelector(".commentcompose");
            if (postbtn && textarea) postbtn.addEventListener("click", async () => {
              const text = textarea.value.trim();
              if (!text) return;
              const token = getsetting("discord_token", "");
              if (!commentslivebase || !token) return;
              postbtn.disabled = true;
              try {

                const body = {
                  file: lightboxfilename,
                  text, token,
                  replyingto: activereplyto || null,
                  region: activeregion || null
                };

                const res = await fetch(`${commentslivebase}/comments`, {
                  method: "POST", headers: {"content-type": "application/json"},
                  body: JSON.stringify(body)
                });

                if (res.ok) {
                  activereplyto = null;
                  activefocuskey = null;
                  activeregion = null;
                  commentscache.delete(lightboxfilename);
                  const refreshed = await fetchcomments(lightboxfilename);
                  lightboxcomments = refreshed;
                  rendercommentpanel(refreshed);
                  renderregions(refreshed);
                }

              } catch (_) {}
              postbtn.disabled = false;
            }); chainwrap.appendChild(composer);
          }
        }; medicommentslist.appendChild(chainwrap);
      }
      if (loggedin && activeregion && !activereplyto && !activefocuskey) {
        const composer = document.createElement("div");
        composer.className = "mediacomment commentcomposerwrap regioncomposer";

        // region comment prompt template
        composer.innerHTML =
          `<textarea class="commentcompose" rows="3" placeholder="write a comment for this region.."></textarea>` +
          `<div class="commentcomposeactions">` +
          `<button type="button" class="commentpost">post</button>` +
          `</div>`;

        medicommentslist.appendChild(composer);
        const postbtn = composer.querySelector(".commentpost");
        const textarea = composer.querySelector(".commentcompose");
        if (postbtn && textarea) postbtn.addEventListener("click", async () => {
          const text = textarea.value.trim();
          if (!text) return;
          const token = getsetting("discord_token", "");
          if (!commentslivebase || !token) return;
          postbtn.disabled = true;
          try {
            const body = {
              file: lightboxfilename,
              text, token,
              replyingto: activereplyto || null,
              region: activeregion || null
            };
            const res = await fetch(`${commentslivebase}/comments`, {
              method: "POST", headers: {"content-type": "application/json"},
              body: JSON.stringify(body)
            });
            if (res.ok) {
              activereplyto = null; activefocuskey = null;
              activeregion = null;
              commentscache.delete(lightboxfilename);
              const refreshed = await fetchcomments(lightboxfilename);
              lightboxcomments = refreshed;
              rendercommentpanel(refreshed);
              renderregions(refreshed);
            }
          } catch (_) {}
          postbtn.disabled = false;
        });
      }
    }

    function layoutregionlayer() {
      if (!mediaregionlayer || !lightboximg) return;
      const img = lightboximg;
      const stage = img.closest(".mediastage");
      if (!stage) return;
      const ib = img.getBoundingClientRect();
      const sb = stage.getBoundingClientRect();
      mediaregionlayer.style.left = `${Math.max(0, ib.left - sb.left)}px`;
      mediaregionlayer.style.top = `${Math.max(0, ib.top - sb.top)}px`;
      mediaregionlayer.style.width = `${Math.max(0, Math.min(sb.width, ib.width))}px`;
      mediaregionlayer.style.height = `${Math.max(0, Math.min(sb.height, ib.height))}px`;
    }

    function renderregions(comments) {
      if (!mediaregionlayer) return;
      mediaregionlayer.innerHTML = "";
      if (!state.commentsopen) {
        const stage = lightboximg?.closest(".mediastage");
        if (stage) stage.classList.remove("commentfocus");
        mediaregionlayer.classList.remove("selecting");
        return;
      }
      const stage = lightboximg?.closest(".mediastage");
      if (stage) stage.classList.toggle("commentfocus", !!activeregion || !!activefocuskey || !!activereplyto);
      layoutregionlayer();
      let matchedactive = false;
      for (const c of comments) {
        if (!Array.isArray(c.region) || c.region.length !== 4) continue;
        const [x1, y1, x2, y2] = c.region.map(Number);
        if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
        const focuskey = String(c.replyid || (c.id ? `id:${c.id}` : ""));
        const box = document.createElement("div");
        box.className = "mediaregion";
        box.style.left = `${Math.max(0, Math.min(1, x1)) * 100}%`;
        box.style.top = `${Math.max(0, Math.min(1, y1)) * 100}%`;
        box.style.width = `${Math.max(0, Math.min(1, x2 - x1)) * 100}%`;
        box.style.height = `${Math.max(0, Math.min(1, y2 - y1)) * 100}%`;
        box.setAttribute("data-focuskey", focuskey);
        if (c.replyid) box.setAttribute("data-replyto", String(c.replyid));
        box.setAttribute("data-region", `${x1},${y1},${x2},${y2}`);
        const isactive =
          activeregion &&
          Number(activeregion[0]) === Number(x1) &&
          Number(activeregion[1]) === Number(y1) &&
          Number(activeregion[2]) === Number(x2) &&
          Number(activeregion[3]) === Number(y2);
        if (isactive) matchedactive = true;
        box.classList.toggle("active", !!isactive);
        mediaregionlayer.appendChild(box);
      }
      if (activeregion && !matchedactive) drawdraftregion(activeregion);
      const canselect = !!getsetting("discord_token", "");
      mediaregionlayer.classList.toggle("selecting", canselect);
      mediaregionlayer.classList.toggle("crosshair", canselect);
    }

    function normalizedregionfrompoints(x1, y1, x2, y2) {
      if (!mediaregionlayer) return null;
      const w = mediaregionlayer.clientWidth || 1;
      const h = mediaregionlayer.clientHeight || 1;
      const nx1 = Math.max(0, Math.min(1, Math.min(x1, x2) / w));
      const ny1 = Math.max(0, Math.min(1, Math.min(y1, y2) / h));
      const nx2 = Math.max(0, Math.min(1, Math.max(x1, x2) / w));
      const ny2 = Math.max(0, Math.min(1, Math.max(y1, y2) / h));
      if (Math.abs(nx2 - nx1) < 0.004 || Math.abs(ny2 - ny1) < 0.004) return null;
      return [nx1, ny1, nx2, ny2];
    }

    function drawdraftregion(region) {
      if (!mediaregionlayer) return;
      const old = mediaregionlayer.querySelector(".mediaregiondraft");
      if (old) old.remove();
      if (!Array.isArray(region)) return;
      const [x1, y1, x2, y2] = region;
      const box = document.createElement("div");
      box.className = "mediaregiondraft";
      box.style.left = `${Math.max(0, Math.min(1, x1)) * 100}%`;
      box.style.top = `${Math.max(0, Math.min(1, y1)) * 100}%`;
      box.style.width = `${Math.max(0, Math.min(1, x2 - x1)) * 100}%`;
      box.style.height = `${Math.max(0, Math.min(1, y2 - y1)) * 100}%`;
      mediaregionlayer.appendChild(box);
    }

    async function openlightbox(url, pathname, video) {
      if (!mediacontent || !medialightbox || !mediainfo) return;
      mediacontent.innerHTML = "";
      if (mediaregionlayer) mediaregionlayer.innerHTML = "";
      updatemediainfo(pathname);
      const filename = pathname.split("/").pop() || "";
      lightboxfilename = filename;
      sethash(pathname);
      activereplyto = null;
      activefocuskey = null;
      activeregion = null;
      const siblings = listchildren(state.cwd)
        .filter(x => x.kind === "file" && imageext.test(x.name))
        .map(x => ({url: rawurl(x.path), path: x.path, name: x.name}));
      lightboxnavitems = siblings;
      lightboxnavindex = siblings.findIndex(x => x.path === pathname);
      const shownav = !video && siblings.length > 1 && lightboxnavindex !== -1;

      if (medianavleft) {
        medianavleft.hidden = !shownav;
        medianavleft.disabled = !shownav;
      }
      if (medianavright) {
        medianavright.hidden = !shownav;
        medianavright.disabled = !shownav;
      }

      if (video) {
        const v = document.createElement("video");
        v.controls = true;
        v.addEventListener("loadedmetadata", () => {
          updatemediainfo(pathname, {
            width: v.videoWidth || 0,
            height: v.videoHeight || 0,
            duration: v.duration || 0
          });
        }, {once: true});
        v.src = url;
        v.autoplay = true;
        if (v.readyState >= 1) {
          updatemediainfo(pathname, {
            width: v.videoWidth || 0,
            height: v.videoHeight || 0,
            duration: v.duration || 0
          });
        }
        mediacontent.appendChild(v);
        if (medicomments) {medicomments.hidden = true; medicommentslist.innerHTML = ""}
      } else {
        const img = document.createElement("img");
        img.addEventListener("load", () => {
          updatemediainfo(pathname, {
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0
          });
          renderregions(lightboxcomments);
        }, {once: true});

        img.src = url;
        img.alt = "";
        mediacontent.appendChild(img);
        lightboximg = img;
        const comments = await fetchcomments(filename);
        lightboxcomments = comments;
        if (medicomments) medicomments.hidden = !state.commentsopen;
        rendercommentpanel(comments);
        if (img.complete && (img.naturalWidth || img.naturalHeight)) {
          updatemediainfo(pathname, {
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0
          });
        }
        renderregions(comments);
      }

      medialightbox.hidden = false;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => medialightbox.classList.add("medialightboxvisible"));
    }

    function steplightboximage(delta) {
      if (!medialightbox || medialightbox.hidden) return;
      if (!lightboxnavitems.length || lightboxnavindex === -1) return;
      const next = (lightboxnavindex + delta + lightboxnavitems.length) % lightboxnavitems.length;
      const item = lightboxnavitems[next];
      if (!item) return;
      lightboxnavindex = next;
      openlightbox(item.url, item.path, false);
    }
    function clearcommentfocus() {
      if (!medialightbox || medialightbox.hidden) return;
      if (!activefocuskey && !activereplyto && !activeregion) return;
      activereplyto = null;
      activefocuskey = null;
      activeregion = null;
      renderregions(lightboxcomments);
      rendercommentpanel(lightboxcomments);
    }

    function hasfocus() {
      return !!(activefocuskey || activereplyto || activeregion);
    }

    function closelightbox() {
      if (!mediacontent || !medialightbox) return;
      medialightbox.classList.remove("medialightboxvisible");
      window.setTimeout(() => {

        medialightbox.hidden = true;
        mediacontent.innerHTML = "";
        if (mediaregionlayer) mediaregionlayer.innerHTML = "";
        if (medicommentslist) medicommentslist.innerHTML = "";
        if (medicomments) medicomments.hidden = true;

        lightboxfilename = "";
        lightboxcomments = [];
        lightboximg = null;
        lightboxnavitems = [];
        lightboxnavindex = -1;
        activereplyto = null;
        activefocuskey = null;
        activeregion = null;
        regionselectstart = null;

        sethash("");
        document.body.style.overflow = "";

      }, 220);
    }

    function refreshcomments() {
      if (!medialightbox || medialightbox.hidden) return;
      rendercommentpanel(lightboxcomments);
      renderregions(lightboxcomments);
    }

    function relayout() {
      if (!medialightbox || medialightbox.hidden) return;
      renderregions(lightboxcomments);
    }

    if (mediaregionlayer) {
      function focusregionbox(box, comments) {
        if (!box || !state.commentsopen) return;
        const rk = String(box.getAttribute("data-region") || "");
        const parts = rk.split(",").map(Number);
        const region = parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
        const fk = String(box.getAttribute("data-focuskey") || "") || null;
        const rt = String(box.getAttribute("data-replyto") || "") || null;
        activefocuskey = fk;
        activereplyto = rt;
        activeregion = region;
        renderregions(comments);
        rendercommentpanel(comments);
      }
      function cyclefocusat(clientX, clientY, comments) {
        if (!mediaregionlayer || !state.commentsopen) return false;
        const all = document.elementsFromPoint(clientX, clientY) || [];
        const boxes = all
          .filter(el => el instanceof Element && el.classList && el.classList.contains("mediaregion"))
          .filter(el => mediaregionlayer.contains(el));
        if (!boxes.length) return false;
        const keys = boxes.map(b => String(b.getAttribute("data-focuskey") || b.getAttribute("data-region") || ""));

        const eps = 4;
        const sameSpot =
          regioncycle &&
          Math.abs(regioncycle.x - clientX) <= eps &&
          Math.abs(regioncycle.y - clientY) <= eps &&
          Array.isArray(regioncycle.keys) &&
          regioncycle.keys.length === keys.length &&
          regioncycle.keys.every((k, i) => k === keys[i]);

        const nextindex = sameSpot ? ((regioncycle.idx + 1) % boxes.length) : 0;
        regioncycle = {x: clientX, y: clientY, keys, idx: nextindex};
        focusregionbox(boxes[nextindex], comments);
        return true;
      }

      const regionpointereventz = "PointerEvent" in window;
      if (regionpointereventz) {
        mediaregionlayer.addEventListener("pointerdown", e => {
          if (!state.commentsopen || !getsetting("discord_token", "")) return;
          if (!e.isPrimary) return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const r = mediaregionlayer.getBoundingClientRect();
          const start = [e.clientX - r.left, e.clientY - r.top];
          regionpointerdown = {clientX: e.clientX, clientY: e.clientY, start, pointerId: e.pointerId};
          try {mediaregionlayer.setPointerCapture(e.pointerId)} catch (_) {}
          e.preventDefault();
        }, {passive: false});
        mediaregionlayer.addEventListener("pointermove", e => {
          if (!e.isPrimary) return;
          if (!regionpointerdown && !regionselectstart) return;
          if (regionpointerdown && e.pointerId !== regionpointerdown.pointerId) return;
          const r = mediaregionlayer.getBoundingClientRect();
          const current = [e.clientX - r.left, e.clientY - r.top];
          if (!regionselectstart && regionpointerdown) {
            const dx = e.clientX - regionpointerdown.clientX;
            const dy = e.clientY - regionpointerdown.clientY;
            if (Math.hypot(dx, dy) < 3) return;
            regionselectstart = regionpointerdown.start;
            regionpointerdown = null;
            activereplyto = null;
            activeregion = null;
            activefocuskey = null;
            drawdraftregion(null);
          }

          if (!regionselectstart) return;
          const nr = normalizedregionfrompoints(regionselectstart[0], regionselectstart[1], current[0], current[1]);
          drawdraftregion(nr);
          e.preventDefault();
        }, {passive: false});
        function endpointer(e) {
          if (regionpointerdown && e.pointerId !== regionpointerdown.pointerId) return;
          if (regionpointerdown) {
            const handled = cyclefocusat(e.clientX, e.clientY, lightboxcomments);
            regionpointerdown = null;
            try {mediaregionlayer.releasePointerCapture(e.pointerId)} catch (_) {}
            if (handled) {e.preventDefault(); return}
          }
          if (!regionselectstart) return;
          const r = mediaregionlayer.getBoundingClientRect();
          const current = [e.clientX - r.left, e.clientY - r.top];
          const nr = normalizedregionfrompoints(regionselectstart[0], regionselectstart[1], current[0], current[1]);
          regionselectstart = null;
          drawdraftregion(null);
          if (!nr) return;
          activeregion = nr;
          renderregions(lightboxcomments);
          rendercommentpanel(lightboxcomments);
          e.preventDefault();
        }
        mediaregionlayer.addEventListener("pointerup", endpointer, {passive: false});
        mediaregionlayer.addEventListener("pointercancel", () => {
          regionpointerdown = null;
          if (!regionselectstart) return;
          regionselectstart = null;
          drawdraftregion(null);
        }, {passive: true});
        mediaregionlayer.addEventListener("lostpointercapture", () => {
          regionpointerdown = null;
          if (!regionselectstart) return;
          regionselectstart = null;
          drawdraftregion(null);
        }, {passive: true});
      } else {
        mediaregionlayer.addEventListener("mousedown", e => {
          if (!state.commentsopen || !getsetting("discord_token", "")) return;
          if (e.button !== 0) return;
          const r = mediaregionlayer.getBoundingClientRect();
          const start = [e.clientX - r.left, e.clientY - r.top];
          regionpointerdown = {clientX: e.clientX, clientY: e.clientY, start};
          e.preventDefault();
        });
        mediaregionlayer.addEventListener("mousemove", e => {
          if (!regionpointerdown && !regionselectstart) return;
          const r = mediaregionlayer.getBoundingClientRect();
          const current = [e.clientX - r.left, e.clientY - r.top];
          if (!regionselectstart && regionpointerdown) {

            const dx = e.clientX - regionpointerdown.clientX;
            const dy = e.clientY - regionpointerdown.clientY;
            if (Math.hypot(dx, dy) < 3) return;

            regionselectstart = regionpointerdown.start;
            regionpointerdown = null;
            activereplyto = null;
            activeregion = null;
            activefocuskey = null;
            drawdraftregion(null);

          }
          if (!regionselectstart) return;
          const nr = normalizedregionfrompoints(regionselectstart[0], regionselectstart[1], current[0], current[1]);
          drawdraftregion(nr);
        });
        mediaregionlayer.addEventListener("mouseup", e => {
          if (regionpointerdown) {
            const handled = cyclefocusat(e.clientX, e.clientY, lightboxcomments);
            regionpointerdown = null;
            if (handled) {e.preventDefault(); return}
          }
          if (!regionselectstart) return;
          const r = mediaregionlayer.getBoundingClientRect();
          const current = [e.clientX - r.left, e.clientY - r.top];
          const nr = normalizedregionfrompoints(regionselectstart[0], regionselectstart[1], current[0], current[1]);
          regionselectstart = null;
          drawdraftregion(null);
          if (!nr) return;
          activeregion = nr;
          renderregions(lightboxcomments);
          rendercommentpanel(lightboxcomments);
        });
        mediaregionlayer.addEventListener("mouseleave", () => {
          if (!regionselectstart) return;
          regionselectstart = null;
          drawdraftregion(null);
        });
      }
    }

  return {
    clearcommentfocus, closelightbox,
    hasfocus, openlightbox,
    refreshcomments, relayout,
    rendercommentpanel, renderregions,
    steplightboximage
  };

}

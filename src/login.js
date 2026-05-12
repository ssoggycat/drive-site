"use strict";

// discord oauth
export function drivediscord(deps) {
    const esc = deps.esc;
    const setsetting = deps.setsetting;
    const getsetting = deps.getsetting;
    const commentslivebase = deps.commentslivebase;
    const loginhint = deps.loginhint;
    const discordavatarbutton = deps.discordavatarbutton;
    const discordmenu = deps.discordmenu;
    const discordmenuavatar = deps.discordmenuavatar;
    const discordmenuname = deps.discordmenuname;
    const discordmenulogout = deps.discordmenulogout;
    const pfpdefault = deps.pfpdefault;
    const hidehint = deps.hidehint;

    function discordloggedin() {
      return !!getsetting("discord_user", null) || !!getsetting("discord_token", "") || !!getsetting("discord_code", "");
    }
    function getdiscorduser() {
      const u = getsetting("discord_user", null);
      return u && typeof u === "object" ? u : null;
    }
    function setdiscordavatarurl(url) {
      if (!discordavatarbutton) return;
      const safe = (typeof url === "string" && url) ? url : "";
      if (!safe) return;
      discordavatarbutton.innerHTML = `<img class="discordavatarimg" alt="" referrerpolicy="no-referrer" src="${esc(safe)}">`;
    }
    function updatediscordmenu() {
      const u = getdiscorduser();
      if (discordmenuname)
        discordmenuname.textContent = u?.username || (getsetting("discord_code", "") ? "signed in (pending)" : "not signed in");
      if (discordmenulogout)
        discordmenulogout.hidden = !u;
      if (discordmenuavatar) {
        if (u?.avatar)
          discordmenuavatar.innerHTML = `<img class="discordavatarimg" alt="" referrerpolicy="no-referrer" src="${esc(u.avatar)}">`;
        else
          discordmenuavatar.innerHTML = `<div style="width:100%;height:100%;opacity:.6;display:grid;place-items:center">?</div>`;
      }
    }
    function updatediscordavatar() {
      const u = getdiscorduser();
      if (u?.avatar) setdiscordavatarurl(u.avatar);
      else if (discordavatarbutton) discordavatarbutton.innerHTML = pfpdefault;
      if (discordavatarbutton) {
        const t = discordloggedin() ? "view your profile" : "log in with discord";
        discordavatarbutton.title = t;
        discordavatarbutton.setAttribute("aria-label", t);
      }
      updatediscordmenu();
      hidehint();
    }
    function discordauthurl() {
      const base = "https://discord.com/oauth2/authorize";
      const redirect = `${location.origin}/index.html`;
      const st = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
      setsetting("discord_oauth_state", st);
      setsetting("discord_oauth_redirect", redirect);
      const qs = new URLSearchParams({
        client_id: "1501279291848003744",
        response_type: "code",
        redirect_uri: redirect,
        scope: "identify",
        state: st
      });
      return `${base}?${qs.toString()}`;
    }
    function opendiscordpopup() {
      const url = discordauthurl();
      const w = 480, h = 720;
      const left = Math.max(0, Math.floor((window.screen.width - w) / 2));
      const top = Math.max(0, Math.floor((window.screen.height - h) / 2));
      const feat = `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const win = window.open(url, "discord_oauth", feat);
      if (win) win.focus();
    }
    function handlediscordoauthcallbackifpresent() {
      const sp = new URLSearchParams(location.search || "");
      const code = sp.get("code");
      const incomingstate = sp.get("state");
      if (!code) return;
      const expected = getsetting("discord_oauth_state", "");
      if (expected && incomingstate && incomingstate !== expected) {
        sp.delete("code"); sp.delete("state");
        history.replaceState({}, "", `${location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}${location.hash || ""}`);
        return;
      }
      const frompopup = !!(window.opener && window.opener !== window);
      if (!frompopup) {
        try {setsetting("discord_code", code);} catch (_) {}
        updatediscordmenu();
      }
      if (frompopup) {
        try {window.opener.postMessage({type: "discord_oauth_code", code}, location.origin)} catch (_) {}
        window.setTimeout(() => {try {window.close()} catch (_) {}}, 60);
      }
      sp.delete("code"); sp.delete("state");
      history.replaceState({}, "", `${location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}${location.hash || ""}`);
    }
    async function resolvediscorduser() {
      if (!commentslivebase) return;
      if (getsetting("discord_token", "") && getdiscorduser()) return;
      const code = getsetting("discord_code", "");
      if (!code) return;
      const redirect = getsetting("discord_oauth_redirect", `${location.origin}/index.html`);
      try {
        const qp = new URLSearchParams({
          code: String(code),
          redirect_uri: String(redirect || "")
        });
        const res = await fetch(`${commentslivebase}/me?${qp.toString()}`, {cache: "no-store"});
        if (!res.ok) return;
        const j = await res.json();
        if (!j || typeof j !== "object") return;
        if (typeof j.username === "string" && typeof j.avatar === "string") {
          setsetting("discord_user", {username: j.username, avatar: j.avatar});
          if (typeof j.token === "string" && j.token) setsetting("discord_token", j.token);
          setsetting("discord_code", "");
          updatediscordavatar();
        }
      } catch (_) {}
    }

    function closediscordmenu() {
      if (discordmenu) discordmenu.hidden = true;
    }
    function togglediscordmenu() {
      if (!discordmenu) return;
      discordmenu.hidden = !discordmenu.hidden;
    }

    function wireui(extra) {
      const medialightbox = extra.medialightbox;
      const oncomments = extra.oncomments;

      if (discordavatarbutton)
        discordavatarbutton.addEventListener("click", e => {
          e.stopPropagation();
          if (getdiscorduser()) togglediscordmenu();
          else opendiscordpopup();
        });
      if (loginhint) {
        loginhint.addEventListener("mouseenter", () => window.setTimeout(() => loginhint.classList.add("fade"), 500));
        loginhint.addEventListener("click", () => {
          loginhint.classList.add("fade");
          opendiscordpopup();
        });
      }
      if (discordavatarbutton) {
        discordavatarbutton.addEventListener("mouseenter", () => {
          if (!loginhint) return;
          if (discordloggedin()) return;
          loginhint.hidden = false;
          loginhint.classList.remove("fade");
        });
        discordavatarbutton.addEventListener("mouseleave", () => {if (loginhint) loginhint.hidden = true});
      }
      if (discordmenulogout)
        discordmenulogout.addEventListener("click", () => {
          setsetting("discord_code", "");
          setsetting("discord_token", "");
          setsetting("discord_user", null);
          updatediscordavatar();
          closediscordmenu();
          if (medialightbox && !medialightbox.hidden) oncomments();
        });
      document.addEventListener("click", () => closediscordmenu());
      if (discordmenu) discordmenu.addEventListener("click", e => e.stopPropagation());
      window.addEventListener("message", e => {
        if (e.origin !== location.origin) return;
        const msg = e.data || {};
        if (msg.type === "discord_oauth_code" && typeof msg.code === "string" && msg.code) {
          setsetting("discord_code", msg.code);
          updatediscordmenu();
          resolvediscorduser();
          if (medialightbox && !medialightbox.hidden) oncomments();
        }
      });
    }

  return {
    discordauthurl, closediscordmenu,
    discordloggedin, getdiscorduser,
    handlediscordoauthcallbackifpresent,
    opendiscordpopup, resolvediscorduser,
    togglediscordmenu, updatediscordavatar,
    updatediscordmenu, wireui
  };

}

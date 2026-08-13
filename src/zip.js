"use strict";

export function zipdl(deps) {
  const state = deps.state;
  const rawurl = deps.rawurl;
  const formatbytes = deps.formatbytes;

  const zipwrap = document.querySelector(".zipwrap"),
    zipbutton = document.querySelector(".zipbutton"),
    zippanel = document.querySelector(".zippanel"),
    zipname = document.querySelector(".zipname"),
    zipbarfill = document.querySelector(".zipbarfill"),
    zipstats = document.querySelector(".zipstats");
  if (!zipbutton) return;

  const textenc = new TextEncoder();
  const crctable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32chunk(crc, bytes) {
    let c = crc;
    for (let i = 0; i < bytes.length; i++) c = crctable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return c >>> 0;
  }

  function dosdatetime() {
    const d = new Date();
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  // realistically all of this junk can be removed with a single import buuuuuuutttttttttttttttt
  // i don't have a good excuse actually sorry. it's just there
  function localheader(namebytes, dt) {
    const b = new Uint8Array(30 + namebytes.length);
    const v = new DataView(b.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0808, true);
    v.setUint16(10, dt.time, true);
    v.setUint16(12, dt.date, true);
    v.setUint16(26, namebytes.length, true);
    b.set(namebytes, 30);
    return b;
  }
  function descriptor(crc, size) {
    const b = new Uint8Array(16);
    const v = new DataView(b.buffer);
    v.setUint32(0, 0x08074b50, true);
    v.setUint32(4, crc, true);
    v.setUint32(8, size, true);
    v.setUint32(12, size, true);
    return b;
  }
  function centralheader(e, dt) {
    const zip64 = e.offset >= 0xffffffff;
    const extralen = zip64 ? 12 : 0;
    const b = new Uint8Array(46 + e.name.length + extralen);
    const v = new DataView(b.buffer);
    v.setUint32(0, 0x02014b50, true);
    v.setUint16(4, 45, true);
    v.setUint16(6, zip64 ? 45 : 20, true);
    v.setUint16(8, 0x0808, true);
    v.setUint16(12, dt.time, true);
    v.setUint16(14, dt.date, true);
    v.setUint32(16, e.crc, true);
    v.setUint32(20, e.size, true);
    v.setUint32(24, e.size, true);
    v.setUint16(28, e.name.length, true);
    v.setUint16(30, extralen, true);
    v.setUint32(42, zip64 ? 0xffffffff : e.offset, true);
    b.set(e.name, 46);
    if (zip64) {
      const x = new DataView(b.buffer, 46 + e.name.length);
      x.setUint16(0, 1, true);
      x.setUint16(2, 8, true);
      x.setBigUint64(4, BigInt(e.offset), true);
    }
    return b;
  }
  function endrecords(count, cdsize, cdoffset) {
    const zip64 = count >= 0xffff || cdsize >= 0xffffffff || cdoffset >= 0xffffffff;
    if (!zip64) {
      const b = new Uint8Array(22);
      const v = new DataView(b.buffer);
      v.setUint32(0, 0x06054b50, true);
      v.setUint16(8, count, true);
      v.setUint16(10, count, true);
      v.setUint32(12, cdsize, true);
      v.setUint32(16, cdoffset, true);
      return b;
    }
    const b = new Uint8Array(98);
    const v = new DataView(b.buffer);
    v.setUint32(0, 0x06064b50, true);
    v.setBigUint64(4, 44n, true);
    v.setUint16(12, 45, true);
    v.setUint16(14, 45, true);
    v.setBigUint64(24, BigInt(count), true);
    v.setBigUint64(32, BigInt(count), true);
    v.setBigUint64(40, BigInt(cdsize), true);
    v.setBigUint64(48, BigInt(cdoffset), true);
    v.setUint32(56, 0x07064b50, true);
    v.setBigUint64(64, BigInt(cdoffset + cdsize), true);
    v.setUint32(72, 1, true);
    v.setUint32(76, 0x06054b50, true);
    v.setUint16(84, 0xffff, true);
    v.setUint16(86, 0xffff, true);
    v.setUint32(88, 0xffffffff, true);
    v.setUint32(92, 0xffffffff, true);
    return b;
  }

  async function makesink(filename) {
    if (typeof window.showSaveFilePicker === "function") {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{description: "zip archive", accept: {"application/zip": [".zip"]}}]
      });
      const writable = await handle.createWritable();
      return {
        write: chunk => writable.write(chunk),
        close: () => writable.close(),
        abort: () => writable.abort().catch(() => {})
      };
    }
    const parts = [];
    return {
      write: chunk => {parts.push(chunk)},
      close: () => {
        const url = URL.createObjectURL(new Blob(parts, {type: "application/zip"}));
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      },
      abort: () => {parts.length = 0}
    };
  }

  /*//////////////////////////////////////////////////////////////////////*/

  let ctrl = null, hidetimer = 0;

  function showpanel() {
    window.clearTimeout(hidetimer);
    zippanel.hidden = false;
    zipwrap.classList.add("zipping");
  }
  function hidepanel(delay) {
    window.clearTimeout(hidetimer);
    const hide = () => {
      zippanel.hidden = true;
      zipwrap.classList.remove("zipping");
    };
    if (!delay) {hide(); return}
    hidetimer = window.setTimeout(hide, delay);
  }
  function setrunning(on) {
    zippanel.classList.toggle("zipactive", on);
    zippanel.title = on ? "click to cancel" : "";
  }
  function paint(name, done, total, bytes, failed) {
    if (name !== null) zipname.textContent = name;
    const pct = total ? Math.floor((done / total) * 100) : 0;
    zipbarfill.style.width = `${pct}%`;
    zipstats.textContent =
      `${done}/${total} - ${formatbytes(bytes) || "0 B"} - ${pct}%${failed ? ` (${failed} failed)` : ""}`;
  }

  async function run(files, signal) {
    const sink = await makesink("soggy cat.zip");
    const dt = dosdatetime();
    const entries = [];
    const lookahead = 4;
    const pending = new Array(files.length);
    const startfetch = i => {
      if (i < files.length && !pending[i])
        pending[i] = fetch(rawurl(files[i].path), {signal}).catch(() => null);
    };
    let offset = 0, totalbytes = 0, done = 0, failed = 0, lastpaint = 0;
    for (let i = 0; i < lookahead; i++) startfetch(i);
    try {
      for (let i = 0; i < files.length; i++) {
        startfetch(i + lookahead);
        paint(files[i].path, done, files.length, totalbytes, failed);
        const res = await pending[i];
        pending[i] = null;
        if (signal.aborted) throw new DOMException("aborted", "AbortError");
        if (!res || !res.ok || !res.body) {
          res?.body?.cancel?.();
          failed++; done++;
          continue;
        }
        const namebytes = textenc.encode(files[i].path);
        const lh = localheader(namebytes, dt);
        await sink.write(lh);
        let crc = 0xffffffff, size = 0;
        const reader = res.body.getReader();
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          crc = crc32chunk(crc, chunk.value);
          size += chunk.value.length;
          totalbytes += chunk.value.length;
          await sink.write(chunk.value);
          const now = performance.now();
          if (now - lastpaint > 150) {
            lastpaint = now;
            paint(null, done, files.length, totalbytes, failed);
          }
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        await sink.write(descriptor(crc, size));
        entries.push({name: namebytes, crc, size, offset});
        offset += lh.length + size + 16;
        done++;
        paint(null, done, files.length, totalbytes, failed);
      }
      const cdstart = offset;
      let cdsize = 0;
      for (const e of entries) {
        const c = centralheader(e, dt);
        await sink.write(c);
        cdsize += c.length;
      }
      await sink.write(endrecords(entries.length, cdsize, cdstart));
      await sink.close();
      return {done, failed, totalbytes};
    } catch (e) {
      sink.abort();
      throw e;
    }
  }

  zippanel.addEventListener("click", () => {
    if (ctrl) ctrl.abort();
  });
  zipbutton.addEventListener("click", async () => {
    if (ctrl) return;
    const files = (state.tree || []).filter(x => x.type === "blob");
    if (!files.length) {
      showpanel();
      zipname.textContent = "nothing to download yet!";
      zipbarfill.style.width = "0%";
      zipstats.textContent = "wait for the tree to load";
      hidepanel(2500);
      return;
    }
    ctrl = new AbortController();
    setrunning(true);
    showpanel();
    paint("starting..", 0, files.length, 0, 0);
    try {
      const result = await run(files, ctrl.signal);
      zipname.textContent = "done! check the zip file.";
      zipbarfill.style.width = "100%";
      zipstats.textContent =
        `${result.done - result.failed}/${result.done} files - ${formatbytes(result.totalbytes) || "0 B"}` +
        `${result.failed ? ` (${result.failed} failed)` : ""}`;
      hidepanel(6000);
    } catch (e) {
      if (e && e.name === "AbortError") hidepanel(0);
      else {
        zipname.textContent = "zip failed :(";
        zipstats.textContent = String(e && e.message || e);
        hidepanel(6000);
      }
    } finally {
      ctrl = null;
      setrunning(false);
    }
  });
}

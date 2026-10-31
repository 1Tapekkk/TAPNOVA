// Local preferences and cancellation for TAPNOVA. No game or account data is stored here.
(() => {
  'use strict';
  let diagnosticAt = 0, diagnosticCount = 0;
  function diagnostic(kind, error, extra = {}) {
    if (Date.now()-diagnosticAt > 60000) { diagnosticAt=Date.now();diagnosticCount=0; }
    if (diagnosticCount++ >= 20) return;
    try { window.postMessage({type:'tapnova:diagnostic',kind,name:String(error?.name || 'Error').slice(0,30),...extra},'*'); } catch {}
  }
  window.addEventListener?.('error',event=>diagnostic('game-error',event.error,{line:event.lineno,column:event.colno}));
  window.addEventListener?.('unhandledrejection',event=>diagnostic('game-rejection',event.reason));
  const choices = values => ({ values });
  const number = (min, max) => ({ min, max });
  const schema = {
    th: choices(['nova','yellow','amber','orange','coral','red','rose','pink','fuchsia','purple','violet','indigo','blue','sky','cyan','teal','emerald','green','lime','white','silver','neonpink','neoncyan','neonlime','neongold','neonpurple','neonorange','aurora','magma','ice','void']),
    pfn: choices(['system','outfit','playfair','bebas','jetbrains','caveat','rubik','cinzel','pacifico']),
    pop: number(.12, 1), uis: choices(['0','1']), uic: choices(['0','1']),
    dsm: choices(['normal','agresif','max']), dsl: number(1, 30), dsw: number(4, 300),
    dsb: number(25, 5000), dsf: number(3, 500), dsq: number(5, 120), dsbc: number(20, 5000),
    ...Object.fromEntries(['sc','sm','sa','sr','sdl','sdv','sal'].map(key => [key, choices(['very_slow','slow','normal','fast','very_fast'])]))
  };
  function cleanSettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('settings');
    const result = {};
    for (const [key, raw] of Object.entries(value)) {
      if (!Object.hasOwn(schema, key)) throw Error('settings');
      const rule = schema[key];
      if (typeof raw !== 'string' && typeof raw !== 'number') throw Error('settings');
      const v = String(raw);
      if (rule.values ? !rule.values.includes(v) : !v.trim() || !Number.isFinite(Number(v)) || Number(v) < rule.min || Number(v) > rule.max || (key !== 'pop' && !Number.isInteger(Number(v)))) throw Error('settings');
      result[key] = rule.values ? v : String(Number(v));
    }
    if (!Object.keys(result).length) throw Error('settings');
    return result;
  }
  function cleanName(value) {
    if (typeof value !== 'string') throw Error('name');
    const name = value.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) throw Error('name');
    return name;
  }
  function createStore(storage) {
    const key = '_tn_presets_v1';
    const parse = raw => {
      if (typeof raw !== 'string' || raw.length > 65536) throw Error('file');
      let doc;
      try { doc = JSON.parse(raw); } catch { throw Error('file'); }
      if (doc?.format !== 'tapnova-settings' || doc.version !== 1 || !Array.isArray(doc.presets) || doc.presets.length > 20) throw Error('file');
      const names = new Set();
      return doc.presets.map(item => {
        const name = cleanName(item?.name), normalized = name.toLocaleLowerCase();
        if (names.has(normalized)) throw Error('duplicate');
        names.add(normalized);
        return { name, settings: cleanSettings(item.settings) };
      });
    };
    const read = () => {
      const raw = storage.getItem(key);
      return raw ? parse(raw) : [];
    };
    const serialize = presets => JSON.stringify({ format: 'tapnova-settings', version: 1, presets }, null, 2);
    const write = presets => {
      const json = serialize(presets);
      parse(json);
      storage.setItem(key, json); // A failed write leaves the previous collection intact.
      return presets;
    };
    return {
      read, parse, serialize,
      save(name, settings) {
        name = cleanName(name);
        const items = read();
        if (items.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error('duplicate');
        if (items.length >= 20) throw Error('limit');
        return write([...items, { name, settings: cleanSettings(settings) }]);
      },
      remove(name) { return write(read().filter(item => item.name !== name)); },
      rename(name, nextName) {
        nextName = cleanName(nextName);
        const items = read();
        if (items.some(item => item.name !== name && item.name.toLocaleLowerCase() === nextName.toLocaleLowerCase())) throw Error('duplicate');
        return write(items.map(item => item.name === name ? { ...item, name: nextName } : item));
      },
      previewImport(raw) {
        const incoming = parse(raw);
        if (!incoming.length) throw Error('empty');
        const existing = read(), names = new Set(existing.map(item => item.name.toLocaleLowerCase()));
        if (existing.length + incoming.length > 20) throw Error('limit');
        if (incoming.some(item => names.has(item.name.toLocaleLowerCase()))) throw Error('duplicate');
        return incoming;
      },
      import(raw) { const incoming = this.previewImport(raw); return write([...read(), ...incoming]); }
    };
  }
  function createGate(request, initiallyPaused = false, limits = {}) {
    let paused = initiallyPaused, epoch = 0;
    const requests = new Set(), delays = new Set(), jobs = new Set();
    const queue = [];
    const concurrency = Math.max(1, Math.min(12, limits.concurrency || 6));
    const maxQueued = Math.max(1, Math.min(256, limits.maxQueued || 128));
    const timeout = Math.max(10, Math.min(120000, limits.timeout || 30000));
    let active = 0;
    const aborted = () => new DOMException('TAPNOVA: zatrzymano zadanie', 'AbortError');
    const drain = () => {
      while (!paused && active < concurrency && queue.length) queue.shift().start();
    };
    return {
      get paused() { return paused; }, get epoch() { return epoch; },
      get pending() { return jobs.size + requests.size; },
      get metrics() { return { active, queued: queue.length, jobs: jobs.size, concurrency }; },
      valid(version) { return !paused && version === epoch; },
      async run(name, action) {
        if (paused) throw aborted();
        const job = { name }; jobs.add(job);
        const history = window.__tapnovaExtras?.begin(name);
        try { const result=await action(); history?.finish(paused?'stopped':'finished'); return result; }
        catch(error) { history?.finish(error?.name==='AbortError'?'stopped':'failed'); if(error?.name!=='AbortError')diagnostic('job-error',error); throw error; }
        finally { jobs.delete(job); }
      },
      async request(url, options = {}) {
        if (paused) throw aborted();
        if (options.signal?.aborted) throw aborted();
        if (active >= concurrency && queue.length >= maxQueued) throw new DOMException('TAPNOVA: kolejka żądań jest pełna', 'QuotaExceededError');
        const controller = new AbortController();
        const relay = () => controller.abort(aborted());
        options.signal?.addEventListener('abort', relay, { once: true });
        requests.add(controller);
        return new Promise((resolve, reject) => {
          let started = false, done = false, reader, streamController;
          const complete = () => {
            if (done) return;
            done = true; clearTimeout(timer);
            requests.delete(controller);
            options.signal?.removeEventListener('abort', relay);
            controller.signal.removeEventListener('abort', onAbort);
            const index = queue.indexOf(entry);
            if (index !== -1) queue.splice(index, 1);
            if (started) active--;
            drain();
          };
          const onAbort = () => {
            const error = controller.signal.reason || aborted();
            if(error.name!=='AbortError')diagnostic('request-error',error,{active,queued:queue.length});
            try { streamController?.error(error); } catch {}
            if (reader) reader.cancel(error).catch(() => {});
            reject(error); complete();
          };
          const entry = { async start() {
            if (done) return;
            started = true; active++;
            try {
              const response = await request(url, { ...options, signal: controller.signal });
              if (done) { response.body?.cancel().catch(() => {}); return; }
              if (!response.body || typeof response.body.getReader !== 'function') { complete(); resolve(response); return; }
              reader = response.body.getReader();
              // Pull one stream only. Cloning and draining a second branch used to
              // buffer entire unread responses and duplicate network processing.
              const body = new ReadableStream({
                start(value) { streamController = value; },
                async pull(value) {
                  try {
                    const chunk = await reader.read();
                    if (done) return;
                    if (chunk.done) { value.close(); reader.releaseLock(); complete(); }
                    else value.enqueue(chunk.value);
                  } catch (error) { try { value.error(error); } catch {} complete(); }
                },
                cancel(reason) { const result = reader.cancel(reason); complete(); return result; }
              }, { highWaterMark: 0 });
              const wrapped = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
              for (const key of ['url', 'redirected', 'type']) Object.defineProperty(wrapped, key, { value: response[key] });
              resolve(wrapped);
            } catch (error) { if(error?.name!=='AbortError')diagnostic('request-error',error,{active,queued:queue.length});reject(error); complete(); }
          } };
          const timer = setTimeout(() => controller.abort(new DOMException('TAPNOVA: przekroczono czas żądania', 'TimeoutError')), timeout);
          controller.signal.addEventListener('abort', onAbort, { once: true });
          queue.push(entry); drain();
        });
      },
      sleep(ms) {
        if (paused) return Promise.resolve();
        return new Promise(resolve => {
          const finish = () => { clearTimeout(timer); delays.delete(finish); resolve(); };
          const timer = setTimeout(finish, ms); delays.add(finish);
        });
      },
      stop() {
        paused = true; epoch++;
        for (const controller of [...requests]) controller.abort(aborted());
        for (const finish of [...delays]) finish();
      },
      resume() {
        if (this.pending) return false;
        paused = false; return true;
      }
    };
  }
  window.__tapnovaControl = { schema, cleanSettings, createStore, createGate };
})();

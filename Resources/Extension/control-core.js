// Local preferences and cancellation for TAPNOVA. No game or account data is stored here.
(() => {
  'use strict';
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
  function createGate(request, initiallyPaused = false) {
    let paused = initiallyPaused, epoch = 0;
    const requests = new Set(), delays = new Set(), jobs = new Set();
    const aborted = () => new DOMException('TAPNOVA: zatrzymano zadanie', 'AbortError');
    return {
      get paused() { return paused; }, get epoch() { return epoch; },
      get pending() { return jobs.size + requests.size; },
      valid(version) { return !paused && version === epoch; },
      async run(name, action) {
        if (paused) throw aborted();
        const job = { name }; jobs.add(job);
        const history = window.__tapnovaExtras?.begin(name);
        try { const result=await action(); history?.finish(paused?'stopped':'finished'); return result; }
        catch(error) { history?.finish(error?.name==='AbortError'?'stopped':'failed'); throw error; }
        finally { jobs.delete(job); }
      },
      async request(url, options = {}) {
        if (paused) throw aborted();
        const controller = new AbortController();
        const relay = () => controller.abort();
        if (options.signal?.aborted) controller.abort();
        else options.signal?.addEventListener('abort', relay, { once: true });
        requests.add(controller);
        let readingBody = false;
        const complete = () => { requests.delete(controller); options.signal?.removeEventListener('abort', relay); };
        try {
          const response = await request(url, { ...options, signal: controller.signal });
          // Fetch resolves at headers. Keep cancellation alive until the response
          // body finishes too, without changing the caller's Response or its API.
          if (response.body && typeof response.clone === 'function') {
            const reader = response.clone().body.getReader();
            readingBody = true;
            (async () => {
              try { while (!(await reader.read()).done) { /* Discard observation chunks. */ } }
              catch { /* Abort/errors are also delivered through the caller's body. */ }
              finally { reader.releaseLock(); complete(); }
            })();
          }
          return response;
        } finally { if (!readingBody) complete(); }
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
        for (const controller of requests) controller.abort();
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

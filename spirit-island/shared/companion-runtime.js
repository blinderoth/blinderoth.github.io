/*
  Spirit Island companions: runtime for a normal website.
  The companion pages were first built as claude.ai artifacts, which reach
  storage and downloads through window.claude.use(name). This file provides
  the same interface on any static host (GitHub Pages and so on):
    - "downloads": saves a file through the browser.
    - "db": live shared saving through Supabase, only when configured in
            companion-config.js. Otherwise null, and the pages fall back to
            saving in this browser (localStorage).
    - everything else ("assets", "user", ...): null, which the pages handle.
*/
(function () {
  var cfg = window.COMPANION_CONFIG || {};
  var shared = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && cfg.campaignCode);
  window.COMPANION_SHARED = shared;
  var SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js";
  var dbPromise = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  function makeDb() {
    if (!shared) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = loadScript(SUPABASE_JS).then(function () {
      var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      var TABLE = "companion_state";
      function keyFor(path) { return cfg.campaignCode + ":" + path; }
      function snapshot(row) {
        return { exists: !!row, data: function () { return row ? JSON.parse(row.state) : undefined; } };
      }
      function doc(path) {
        var key = keyFor(path);
        return {
          get: function () {
            return client.from(TABLE).select("state").eq("key", key).maybeSingle().then(function (r) {
              if (r.error) throw r.error; return snapshot(r.data);
            });
          },
          set: function (obj) {
            return client.from(TABLE).upsert({ key: key, state: JSON.stringify(obj), updated_at: new Date().toISOString() }).then(function (r) {
              if (r.error) throw r.error;
            });
          },
          onSnapshot: function (cb, onErr) {
            var ch = client.channel("doc-" + key)
              .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: "key=eq." + key }, function (p) {
                if (p.new && p.new.state) cb(snapshot(p.new));
              })
              .subscribe(function (status) { if (status === "CHANNEL_ERROR" && onErr) onErr(new Error("realtime unavailable")); });
            return function () { client.removeChannel(ch); };
          }
        };
      }
      return { doc: doc };
    }).catch(function (e) { console.error("Shared saving unavailable:", e); return null; });
    return dbPromise;
  }

  var downloads = {
    save: function (req) {
      return new Promise(function (resolve, reject) {
        try {
          var blob = req.data instanceof Blob ? req.data : new Blob([req.data], { type: "application/octet-stream" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a"); a.href = url; a.download = req.filename || "download";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          resolve({ filename: a.download });
        } catch (e) { reject({ code: "unavailable", message: String(e) }); }
      });
    }
  };

  window.claude = {
    use: function (name) {
      if (name === "downloads") return Promise.resolve(downloads);
      if (name === "db") return makeDb();
      return Promise.resolve(null);
    }
  };
})();

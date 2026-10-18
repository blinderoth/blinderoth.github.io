(function () {
  var page = document.body.getAttribute('data-page') || '';
  var desktop = window.matchMedia('(min-width: 801px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- Split headings into letters so each one can react to the cursor ---------- */
  var counter = 0;
  document.querySelectorAll('[data-split] .line').forEach(function (line) {
    var text = line.textContent;
    line.textContent = '';
    line.setAttribute('aria-hidden', 'true');
    Array.from(text).forEach(function (c) {
      if (c === ' ') { line.appendChild(document.createTextNode(' ')); return; }
      var s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', counter++);
      s.textContent = c;
      line.appendChild(s);
    });
  });

  /* ---------- Dates ---------- */
  var now = new Date();
  var nowM = now.getFullYear() * 12 + now.getMonth();
  function monthOf(str) {
    if (str === 'present') return nowM;
    var p = str.split('-');
    return (+p[0]) * 12 + (+p[1]) - 1;
  }
  function monthLabel(m) { return MONTHS[m % 12] + ' ' + Math.floor(m / 12); }
  function durationText(months) {
    var y = Math.floor(months / 12), m = months % 12, out = [];
    if (y) out.push(y + (y === 1 ? ' year' : ' years'));
    if (m) out.push(m + (m === 1 ? ' month' : ' months'));
    return out.join(', ');
  }
  function slugify(text) {
    return text.toLowerCase().replace(/&/g, 'and').replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /* ---------- Timelines with duration lines (Projects, Experience) ----------
     Titles sit under the year they ended. Each title carries
       data-start="YYYY-MM"  data-end="YYYY-MM" or "present".
     Selecting a title reveals any years its duration needs, then draws
     a slim line from the end date down to the start date. */
  var REVEAL_MS = reduceMotion ? 0 : 520;

  function Timeline(wrap) {
    var tl = wrap.querySelector('.tl');
    var info = {};
    var minY = Infinity, maxY = -Infinity;

    tl.querySelectorAll('.item[data-start]').forEach(function (b) {
      var endRaw = b.getAttribute('data-end');
      var s = monthOf(b.getAttribute('data-start'));
      var e = monthOf(endRaw) + 1;
      info[b.getAttribute('aria-controls')] = {
        s: s, e: e,
        startText: monthLabel(s),
        endText: endRaw === 'present' ? 'Now' : monthLabel(e - 1),
        type: b.getAttribute('data-type') || ''
      };
      minY = Math.min(minY, Math.floor(s / 12));
      maxY = Math.max(maxY, Math.floor((e - 1) / 12));
    });

    /* Add a hidden row for every year that has no titles of its own. */
    var have = {};
    Array.from(tl.children).forEach(function (li) { have[+li.getAttribute('data-year')] = li; });
    var rows = [];
    for (var Y = maxY; Y >= minY; Y--) {
      var li = have[Y];
      if (!li) {
        li = document.createElement('li');
        li.className = 'tl-year extra';
        li.setAttribute('data-year', Y);
        li.setAttribute('aria-hidden', 'true');
        li.innerHTML = '<div class="tl-inner"><p class="tl-label">' + Y + '</p><div class="tl-spacer"></div></div>';
      }
      tl.appendChild(li); /* keeps rows in order, newest first */
      rows.push({ y: Y, li: li, extra: li.classList.contains('extra') });
    }

    var line = document.createElement('div');
    line.className = 'dur';
    line.setAttribute('aria-hidden', 'true');
    line.innerHTML = '<i class="cap top"></i><i class="cap bottom"></i>';
    wrap.appendChild(line);

    var dateTop = document.createElement('span');
    dateTop.className = 'dur-date top';
    dateTop.setAttribute('aria-hidden', 'true');
    var dateBottom = document.createElement('span');
    dateBottom.className = 'dur-date bottom';
    dateBottom.setAttribute('aria-hidden', 'true');
    wrap.appendChild(dateTop);
    wrap.appendChild(dateBottom);

    var current = null, token = 0;

    function visibleRows() {
      return rows.filter(function (r) { return !r.extra || r.li.classList.contains('shown'); });
    }

    /* Dashed line wherever years are skipped; no line below the last visible year. */
    function updateJumps() {
      var vis = visibleRows();
      rows.forEach(function (r) { r.li.classList.remove('jump', 'end'); });
      vis.forEach(function (r, i) {
        var nx = vis[i + 1];
        if (nx && nx.y < r.y - 1) r.li.classList.add('jump');
        if (!nx) r.li.classList.add('end');
      });
    }

    /* Position of any month, based on the visible year rows. */
    function yAt(t) {
      var base = wrap.getBoundingClientRect().top;
      var vis = visibleRows().map(function (r) {
        var b = r.li.getBoundingClientRect();
        return { y: r.y, top: b.top - base, bottom: b.bottom - base };
      });
      var B = {};
      vis.forEach(function (r, i) {
        var nx = vis[i + 1];
        if (B[r.y + 1] === undefined) B[r.y + 1] = r.top;
        var bot = (nx && nx.y === r.y - 1) ? nx.top : r.bottom;
        B[r.y] = bot;
        if (nx && nx.y < r.y - 1) {
          for (var k = r.y - 1; k > nx.y; k--) {
            B[k] = bot + (nx.top - bot) * (r.y - k) / (r.y - (nx.y + 1));
          }
        }
      });
      var hi = vis[0].y, lo = vis[vis.length - 1].y;
      var Yr = Math.floor(t / 12);
      if (Yr > hi) return B[hi + 1];
      if (Yr < lo) return B[lo];
      return B[Yr] + (B[Yr + 1] - B[Yr]) * ((t - Yr * 12) / 12);
    }

    function hideLine() {
      [line, dateTop, dateBottom].forEach(function (el) { el.classList.remove('grow', 'on'); });
    }

    function place(it, animate) {
      var top = yAt(it.e), bottom = yAt(it.s);
      var height = Math.max(6, bottom - top);
      [line, dateTop, dateBottom].forEach(function (el) {
        el.classList.remove('grow', 'on');
        el.style.transition = 'none';
      });
      line.style.top = top + 'px';
      line.style.height = height + 'px';
      line.setAttribute('data-type', it.type);
      dateTop.textContent = it.endText;
      dateBottom.textContent = it.startText;
      dateTop.style.top = (top + 3) + 'px';
      dateBottom.style.top = (top + height - 3) + 'px';
      void line.offsetWidth;
      if (animate) [line, dateTop, dateBottom].forEach(function (el) { el.style.transition = ''; });
      line.classList.add('grow');
      dateTop.classList.add('on');
      dateBottom.classList.add('on');
      if (!animate) {
        void line.offsetWidth;
        [line, dateTop, dateBottom].forEach(function (el) { el.style.transition = ''; });
      }
    }

    this.has = function (id) { return !!info[id]; };

    this.select = function (id) {
      if (id && id === current) return;
      var my = ++token;
      var hadLine = line.classList.contains('grow');
      hideLine();
      current = id || null;

      var it = id ? info[id] : null;
      var need = {};
      if (it) {
        for (var y = Math.floor(it.s / 12); y <= Math.floor((it.e - 1) / 12); y++) need[y] = true;
      }
      var changed = false;
      rows.forEach(function (r) {
        if (!r.extra) return;
        var on = !!need[r.y];
        if (r.li.classList.contains('shown') !== on) {
          r.li.classList.toggle('shown', on);
          changed = true;
        }
      });
      updateJumps();
      if (!it) return;

      var delay = changed ? REVEAL_MS : (hadLine && !reduceMotion ? 200 : 30);
      setTimeout(function () {
        if (my !== token) return;
        place(it, !reduceMotion);
      }, delay);
    };

    this.refresh = function () {
      if (current && info[current]) place(info[current], false);
    };

    updateJumps();
  }

  var timelines = [];
  document.querySelectorAll('.tl-wrap').forEach(function (wrap) {
    var t = new Timeline(wrap);
    t.wrap = wrap;
    timelines.push(t);
  });
  function refreshAll() { timelines.forEach(function (t) { t.refresh(); }); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshAll);
  var lastW = window.innerWidth, resizeTimer;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshAll, 150);
  });

  /* Durations under the date line of each Projects/Experience entry, and a link name for each. */
  var usedSlugs = { overview: 1, projects: 1, experience: 1, interests: 1, top: 1 };
  var slugToBtn = {};
  document.querySelectorAll('.tl-wrap .item[data-start]').forEach(function (b) {
    var detail = document.getElementById(b.getAttribute('aria-controls'));
    var months = monthOf(b.getAttribute('data-end')) + 1 - monthOf(b.getAttribute('data-start'));
    if (detail && months > 0) {
      var span = document.createElement('p');
      span.className = 'span';
      span.textContent = durationText(months);
      var where = detail.querySelector('.where');
      if (where) where.insertAdjacentElement('afterend', span);
      else detail.insertBefore(span, detail.querySelector('h3') ? detail.querySelector('h3').nextSibling : detail.firstChild);
    }
    var slug = slugify(b.textContent), n = 2, base = slug;
    while (usedSlugs[slug]) slug = base + '-' + (n++);
    usedSlugs[slug] = 1;
    b.setAttribute('data-slug', slug);
    slugToBtn[slug] = b;
  });

  /* ---------- Flowchart widget (automation project) ----------
     Uses event delegation, so it works wherever the widget sits on the page. */
  function flowClear(widget) {
    (widget._fcTimers || []).forEach(clearTimeout);
    widget._fcTimers = [];
    widget.classList.remove('running');
    var label = widget.querySelector('.fc-run-label');
    if (label) label.textContent = 'Run trace';
    widget.querySelectorAll('.trace-active, .trace-done, .sub-active').forEach(function (el) {
      el.classList.remove('trace-active', 'trace-done', 'sub-active');
    });
  }

  function flowRun(widget) {
    if (widget.classList.contains('running')) { flowClear(widget); return; }
    flowClear(widget);
    var track = widget.querySelector('.fc-track.active');
    if (!track) return;
    widget.classList.add('running');
    var label = widget.querySelector('.fc-run-label');
    if (label) label.textContent = 'Tracing...';

    var nodes = Array.from(track.querySelectorAll('.fc-node'));
    var arrows = Array.from(track.querySelectorAll('.fc-arrow'));
    var stepTime = reduceMotion ? 150 : (track.getAttribute('data-fc-panel') === 'auto' ? 450 : 380);
    var timers = widget._fcTimers;
    var elapsed = 0;

    nodes.forEach(function (node, idx) {
      var subSteps = Array.from(node.querySelectorAll('.fc-sub-pipeline span'));
      timers.push(setTimeout(function () {
        nodes.forEach(function (n) { n.classList.remove('trace-active'); });
        node.classList.add('trace-active', 'trace-done');
        if (arrows[idx - 1]) arrows[idx - 1].classList.add('trace-done');
        subSteps.forEach(function (sub, i) {
          timers.push(setTimeout(function () {
            subSteps.forEach(function (x) { x.classList.remove('sub-active'); });
            sub.classList.add('sub-active');
          }, (i + 1) * 160));
        });
      }, elapsed));
      elapsed += stepTime + subSteps.length * 170;
    });

    timers.push(setTimeout(function () {
      nodes.forEach(function (n) { n.classList.remove('trace-active'); });
      widget.querySelectorAll('.sub-active').forEach(function (x) { x.classList.remove('sub-active'); });
      widget.classList.remove('running');
      if (label) label.textContent = 'Replay trace';
    }, elapsed + 200));
  }

  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-fc-mode]');
    if (tab) {
      var widget = tab.closest('.fc-widget');
      if (!widget) return;
      flowClear(widget);
      var mode = tab.getAttribute('data-fc-mode');
      widget.querySelectorAll('[data-fc-mode]').forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      widget.querySelectorAll('.fc-track').forEach(function (tr) {
        tr.classList.toggle('active', tr.getAttribute('data-fc-panel') === mode);
      });
      return;
    }
    var run = e.target.closest('[data-fc-run]');
    if (run) {
      var w = run.closest('.fc-widget');
      if (w) flowRun(w);
    }
  });

  /* ---------- Cost breakdown pages (Formula Student project) ---------- */
  function cbShow(cb, n) {
    var tabs = cb.querySelectorAll('[data-cb-tab]');
    var pages = cb.querySelectorAll('.cb-page');
    n = Math.max(0, Math.min(pages.length - 1, n));
    tabs.forEach(function (t, i) {
      t.setAttribute('aria-selected', i === n ? 'true' : 'false');
      t.tabIndex = i === n ? 0 : -1;
    });
    pages.forEach(function (p, i) { p.hidden = i !== n; });
    cb.setAttribute('data-cb-at', n);
    var prev = cb.querySelector('[data-cb-step="-1"]'), next = cb.querySelector('[data-cb-step="1"]');
    if (prev) prev.disabled = n === 0;
    if (next) next.disabled = n === pages.length - 1;
    var count = cb.querySelector('.cb-count');
    if (count) count.textContent = (n + 1) + ' of ' + pages.length;
  }
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-cb-tab]');
    var step = e.target.closest('[data-cb-step]');
    var cb = (tab || step) && (tab || step).closest('[data-cb]');
    if (!cb) return;
    var at = +(cb.getAttribute('data-cb-at') || 0);
    cbShow(cb, tab ? +tab.getAttribute('data-cb-tab') : at + +step.getAttribute('data-cb-step'));
  });
  document.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('[data-cb-tab]');
    if (!tab || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    var cb = tab.closest('[data-cb]');
    var n = +(cb.getAttribute('data-cb-at') || 0) + (e.key === 'ArrowRight' ? 1 : -1);
    cbShow(cb, n);
    e.preventDefault();
    var t = cb.querySelectorAll('[data-cb-tab]')[+cb.getAttribute('data-cb-at')];
    if (t) t.focus();
  });

  /* ---------- Detail pane ---------- */
  function isStepper(group) { return !!group.querySelector('.tl-wrap'); }

  function openDetail(group, id, trigger) {
    var pane = group.querySelector('.pane');
    var detail = document.getElementById(id);
    if (!detail) return;

    group.querySelectorAll('.item').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      var li = b.closest('li');
      if (li) li.classList.remove('open');
    });
    trigger.setAttribute('aria-expanded', 'true');
    var li = trigger.closest('li');
    if (li) li.classList.add('open');
    if (!pane) return; /* details open under the title */

    pane.innerHTML = detail.innerHTML;

    if (isStepper(group)) {
      var items = Array.from(group.querySelectorAll('.item'));
      var i = items.indexOf(trigger);
      var tools = document.createElement('div');
      tools.className = 'pane-tools';
      tools.innerHTML = '<button type="button" class="copy-link">Copy link to this</button>';
      pane.appendChild(tools);

      var nav = document.createElement('div');
      nav.className = 'pane-nav';
      if (items[i - 1]) nav.appendChild(stepButton('prev', 'Previous', items[i - 1]));
      if (items[i + 1]) nav.appendChild(stepButton('next', 'Next', items[i + 1]));
      pane.appendChild(nav);
    }

    pane.classList.remove('swap');
    void pane.offsetWidth;
    pane.classList.add('swap');
  }

  function stepButton(cls, label, target) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('data-target', target.getAttribute('aria-controls'));
    var small = document.createElement('small');
    small.textContent = label;
    var span = document.createElement('span');
    span.textContent = target.textContent;
    b.appendChild(small);
    b.appendChild(span);
    return b;
  }

  function linkFor(btn) {
    return location.href.split('#')[0] + '#' + btn.getAttribute('data-slug');
  }

  function goTo(btn) {
    btn.click();
    btn.focus({ preventScroll: true });
    btn.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  /* Title lists: details open on the right, or under the title on phones. */
  document.querySelectorAll('[data-pane-group]').forEach(function (group) {
    var stepper = isStepper(group);
    group.querySelectorAll('.item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('aria-controls');
        var inline = !group.querySelector('.pane');
        var closing = btn.getAttribute('aria-expanded') === 'true' && (inline || !desktop.matches);
        if (closing) {
          btn.setAttribute('aria-expanded', 'false');
          btn.closest('li').classList.remove('open');
        } else {
          openDetail(group, id, btn);
        }
        var myWrap = btn.closest('.tl-wrap');
        timelines.forEach(function (t) {
          if (!group.contains(t.wrap)) return;
          t.select(t.wrap === myWrap && !closing ? id : null);
        });
        if (stepper) {
          btn.focus({ preventScroll: true });
          if (closing) history.replaceState(null, '', location.pathname + location.search);
          else history.replaceState(null, '', '#' + btn.getAttribute('data-slug'));
        }
      });
    });

    var pane = group.querySelector('.pane');
    if (!stepper || !pane) return;
    pane.addEventListener('click', function (e) {
      var step = e.target.closest('.pane-nav button');
      if (step) { goTo(document.querySelector('.item[aria-controls="' + step.getAttribute('data-target') + '"]')); return; }
      var copy = e.target.closest('.copy-link');
      if (copy) {
        var active = group.querySelector('.item[aria-expanded="true"]');
        if (!active) return;
        var url = linkFor(active);
        var done = function (msg) {
          copy.textContent = msg;
          setTimeout(function () { copy.textContent = 'Copy link to this'; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { done('Link copied'); }, function () { done('The link is in your address bar'); });
        } else {
          done('The link is in your address bar');
        }
      }
    });
  });

  /* Arrow keys step through the titles of the section you are in. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    var el = document.activeElement;
    if (!el || !el.closest) return;
    var group = el.closest('[data-pane-group]');
    if (!group || !isStepper(group)) return;
    var items = Array.from(group.querySelectorAll('.item'));
    var active = group.querySelector('.item[aria-expanded="true"]') || (el.classList.contains('item') ? el : null);
    var i = items.indexOf(active);
    var target = i < 0 ? items[0] : items[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (!target) return;
    e.preventDefault();
    goTo(target);
  });

  /* Shareable links: opening the page with #some-title selects that title. */
  function openFromHash(scroll) {
    var slug = decodeURIComponent(location.hash.slice(1));
    var btn = slugToBtn[slug];
    if (!btn) return;
    if (btn.getAttribute('aria-expanded') !== 'true') btn.click();
    if (scroll) btn.scrollIntoView({ block: 'center' });
  }
  if (Object.keys(slugToBtn).length) {
    window.addEventListener('load', function () { setTimeout(function () { openFromHash(true); }, 60); });
    window.addEventListener('hashchange', function () { openFromHash(true); });
  }

  /* ---------- Main page: header that follows, current section, print ---------- */
  if (page === 'home') {
    var header = document.querySelector('header');
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var navLinks = {};
    document.querySelectorAll('header nav a[href^="#"]').forEach(function (a) { navLinks[a.getAttribute('href').slice(1)] = a; });
    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var a = navLinks[en.target.id];
          if (!a || !en.isIntersecting) return;
          Object.keys(navLinks).forEach(function (k) {
            navLinks[k].classList.remove('current');
            navLinks[k].removeAttribute('aria-current');
          });
          a.classList.add('current');
          a.setAttribute('aria-current', 'true');
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      Object.keys(navLinks).forEach(function (id) {
        var sec = document.getElementById(id);
        if (sec) spy.observe(sec);
      });
    }

    document.querySelectorAll('[data-print]').forEach(function (b) {
      b.addEventListener('click', function () { window.print(); });
    });
  }

  /* ---------- Letters of the name lean toward the cursor (real pointer only, not with reduced motion) ---------- */
  (function letters() {
    var ok = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion;
    var chars = Array.from(document.querySelectorAll('.name .ch'));
    if (!ok || !chars.length) return;
    window.addEventListener('pointermove', function (e) {
      chars.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        el.style.setProperty('--t', Math.max(0, 1 - d / 170).toFixed(3));
      });
    });
    document.addEventListener('pointerleave', function () {
      chars.forEach(function (el) { el.style.setProperty('--t', 0); });
    });
  })();

  /* ---------- Easter eggs: only on the main page ---------- */
  if (page === 'home') {
    /* Type "nudge" anywhere. */
    var buf = '';
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-5);
      if (buf === 'nudge') window.location.href = 'personal.html';
    });

    /* Click the B in the name three times. */
    var firstLetter = document.querySelector('[data-split] .ch');
    if (firstLetter) {
      var clicks = 0, timer;
      firstLetter.addEventListener('click', function () {
        clicks++;
        clearTimeout(timer);
        timer = setTimeout(function () { clicks = 0; }, 1500);
        if (clicks >= 3) window.location.href = 'personal.html';
      });
    }
  }

  /* Hint for anyone who opens the console. */
  console.log(
    '%cLooking around?',
    'font: 600 15px Georgia, serif; color: #2F45E0;',
    '\nThere is a page that is not on the CV. Try typing the word "nudge" anywhere on the site.'
  );
})();

/* ============================================
   Layer - External Schedule Import
   Links a university / external timetable (iCal feed or HTML timetable page)
   and turns its lectures into Layer calendar events.
   ============================================ */

(function () {
  const SOURCES_KEY = 'layerScheduleSources';
  const DEFAULT_HORIZON_MONTHS = 6;
  const MAX_EXPANDED_INSTANCES = 500;
  const DAY_CODES = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];

  let previewEvents = [];
  let previewMeta = null;

  /* ---------- storage ---------- */

  function loadScheduleSources() {
    try { return JSON.parse(localStorage.getItem(SOURCES_KEY)) || []; }
    catch { return []; }
  }

  function saveScheduleSources(sources) {
    localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
  }

  function rememberSource(url, name, importedCount) {
    const sources = loadScheduleSources();
    const existing = sources.find(s => s.url === url);
    if (existing) {
      existing.name = name || existing.name;
      existing.lastSync = new Date().toISOString();
      existing.lastCount = importedCount;
    } else {
      sources.push({ url, name: name || url, lastSync: new Date().toISOString(), lastCount: importedCount });
    }
    saveScheduleSources(sources);
  }

  /* ---------- date helpers ---------- */

  function toDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function toTimeString(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  /* ---------- iCalendar parsing ---------- */

  function unfoldIcs(text) {
    return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  }

  function unescapeIcsText(value) {
    return value
      .replace(/\\n/gi, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\')
      .trim();
  }

  function parseIcsLine(line) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return null;
    const rawName = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);
    const parts = rawName.split(';');
    const params = {};
    parts.slice(1).forEach(part => {
      const eq = part.indexOf('=');
      if (eq !== -1) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/"/g, '');
    });
    return { name: parts[0].toUpperCase(), params, value };
  }

  // Local timetables are wall-clock based: TZID and floating values are read as local
  // time, only explicit UTC values are converted.
  function parseIcsDate(value, params) {
    const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (dateOnly) {
      return {
        date: new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])),
        isAllDay: true
      };
    }
    const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
    if (!dateTime) return null;
    const [, y, mo, d, h, mi, s, utc] = dateTime;
    const isAllDay = (params && params.VALUE === 'DATE') || false;
    if (utc) {
      return {
        date: new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))),
        isAllDay
      };
    }
    return {
      date: new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)),
      isAllDay
    };
  }

  function parseRrule(value) {
    const rule = {};
    value.split(';').forEach(part => {
      const [key, val] = part.split('=');
      if (!key || val === undefined) return;
      rule[key.toUpperCase()] = val;
    });
    return {
      freq: (rule.FREQ || '').toUpperCase(),
      interval: Math.max(1, parseInt(rule.INTERVAL, 10) || 1),
      count: rule.COUNT ? parseInt(rule.COUNT, 10) : null,
      until: rule.UNTIL ? (parseIcsDate(rule.UNTIL, {}) || {}).date || null : null,
      byDay: rule.BYDAY
        ? rule.BYDAY.split(',').map(d => DAY_CODES[d.replace(/^[-+]?\d+/, '').toUpperCase()]).filter(d => d !== undefined)
        : []
    };
  }

  function expandRecurrence(base, rule, exdates, horizonEnd) {
    if (!rule || !rule.freq) return [base];

    const instances = [];
    const durationMs = base.end ? base.end.getTime() - base.start.getTime() : 0;
    const limit = rule.until && rule.until < horizonEnd ? rule.until : horizonEnd;
    const excluded = new Set(exdates.map(d => `${toDateString(d)}T${toTimeString(d)}`));

    const pushInstance = (start) => {
      if (excluded.has(`${toDateString(start)}T${toTimeString(start)}`)) return;
      instances.push({ ...base, start, end: durationMs ? new Date(start.getTime() + durationMs) : null });
    };

    if (rule.freq === 'WEEKLY') {
      const weekDays = rule.byDay.length ? rule.byDay : [base.start.getDay()];
      const weekStart = addDays(base.start, -((base.start.getDay() + 6) % 7));
      let week = 0;
      while (instances.length < (rule.count || MAX_EXPANDED_INSTANCES)) {
        const cursorWeek = addDays(weekStart, week * 7 * rule.interval);
        if (cursorWeek > limit) break;
        for (const day of weekDays.slice().sort()) {
          const offset = (day + 6) % 7;
          const candidate = addDays(cursorWeek, offset);
          candidate.setHours(base.start.getHours(), base.start.getMinutes(), 0, 0);
          if (candidate < base.start || candidate > limit) continue;
          pushInstance(candidate);
          if (rule.count && instances.length >= rule.count) break;
        }
        week++;
        if (week > 520) break;
      }
    } else {
      const stepDays = rule.freq === 'DAILY' ? rule.interval : null;
      let cursor = new Date(base.start);
      let iterations = 0;
      while (cursor <= limit && instances.length < (rule.count || MAX_EXPANDED_INSTANCES) && iterations < 1000) {
        pushInstance(new Date(cursor));
        if (stepDays) {
          cursor = addDays(cursor, stepDays);
        } else if (rule.freq === 'MONTHLY') {
          cursor = new Date(cursor); cursor.setMonth(cursor.getMonth() + rule.interval);
        } else if (rule.freq === 'YEARLY') {
          cursor = new Date(cursor); cursor.setFullYear(cursor.getFullYear() + rule.interval);
        } else {
          break;
        }
        iterations++;
      }
    }

    return instances.slice(0, MAX_EXPANDED_INSTANCES);
  }

  function parseIcs(text, options = {}) {
    const horizonEnd = options.horizonEnd || (() => {
      const end = new Date();
      end.setMonth(end.getMonth() + DEFAULT_HORIZON_MONTHS);
      return end;
    })();

    const lines = unfoldIcs(text).split('\n');
    const results = [];
    let current = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.toUpperCase() === 'BEGIN:VEVENT') { current = { exdates: [] }; continue; }
      if (line.toUpperCase() === 'END:VEVENT') {
        if (current && current.start) {
          const base = {
            title: current.title || 'Untitled event',
            description: current.description || '',
            location: current.location || '',
            start: current.start,
            end: current.end || null,
            isAllDay: current.isAllDay || false
          };
          expandRecurrence(base, current.rrule, current.exdates, horizonEnd).forEach(instance => results.push(instance));
        }
        current = null;
        continue;
      }
      if (!current) continue;

      const parsed = parseIcsLine(line);
      if (!parsed) continue;
      switch (parsed.name) {
        case 'SUMMARY': current.title = unescapeIcsText(parsed.value); break;
        case 'DESCRIPTION': current.description = unescapeIcsText(parsed.value); break;
        case 'LOCATION': current.location = unescapeIcsText(parsed.value); break;
        case 'DTSTART': {
          const parsedDate = parseIcsDate(parsed.value, parsed.params);
          if (parsedDate) { current.start = parsedDate.date; current.isAllDay = parsedDate.isAllDay; }
          break;
        }
        case 'DTEND': {
          const parsedDate = parseIcsDate(parsed.value, parsed.params);
          if (parsedDate) current.end = parsedDate.date;
          break;
        }
        case 'RRULE': current.rrule = parseRrule(parsed.value); break;
        case 'EXDATE': {
          parsed.value.split(',').forEach(part => {
            const parsedDate = parseIcsDate(part.trim(), parsed.params);
            if (parsedDate) current.exdates.push(parsedDate.date);
          });
          break;
        }
        default: break;
      }
    }

    return results.map(toImportedEvent);
  }

  /* ---------- HTML timetable parsing (best effort) ---------- */

  const TIME_RANGE_REGEX = /(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/;
  const DATE_PATTERNS = [
    { regex: /(\d{4})-(\d{2})-(\d{2})/, order: ['y', 'm', 'd'] },
    { regex: /(\d{1,2})\.(\d{1,2})\.(\d{4})/, order: ['d', 'm', 'y'] },
    { regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, order: ['d', 'm', 'y'] }
  ];

  function findDateInText(text, fallbackYear) {
    for (const pattern of DATE_PATTERNS) {
      const match = pattern.regex.exec(text);
      if (!match) continue;
      const parts = {};
      pattern.order.forEach((key, index) => { parts[key] = Number(match[index + 1]); });
      return new Date(parts.y, parts.m - 1, parts.d);
    }
    // Formats such as "5 Oct 2026" or "Mon 5 October".
    const named = /(\d{1,2})\s+([A-Za-z]{3,})\.?\s*(\d{4})?/.exec(text);
    if (named) {
      const monthIndex = MONTH_NAMES.findIndex(m => m.startsWith(named[2].toLowerCase().slice(0, 3)));
      if (monthIndex !== -1) {
        return new Date(named[3] ? Number(named[3]) : fallbackYear, monthIndex, Number(named[1]));
      }
    }
    return null;
  }

  function cleanTitle(text) {
    return text
      .replace(new RegExp(TIME_RANGE_REGEX.source, 'g'), ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  function parseHtmlSchedule(html, options = {}) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fallbackYear = (options.referenceDate || new Date()).getFullYear();
    const events = [];
    const seen = new Set();

    const candidates = doc.querySelectorAll('td, li, div, article, section, p');
    candidates.forEach(node => {
      if (node.querySelector('td, li, article, section')) return; // Only leaf-ish blocks.
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 400) return;
      const timeMatch = TIME_RANGE_REGEX.exec(text);
      if (!timeMatch) return;

      let date = findDateInText(text, fallbackYear);
      let ancestor = node.parentElement;
      let hops = 0;
      while (!date && ancestor && hops < 6) {
        const headerText = [
          ancestor.getAttribute && ancestor.getAttribute('data-date'),
          ancestor.querySelector && ancestor.querySelector('th, h1, h2, h3, h4, caption')
            ? ancestor.querySelector('th, h1, h2, h3, h4, caption').textContent
            : ''
        ].filter(Boolean).join(' ');
        date = findDateInText(headerText, fallbackYear);
        ancestor = ancestor.parentElement;
        hops++;
      }
      if (!date) return;

      const start = new Date(date);
      start.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
      const end = new Date(date);
      end.setHours(Number(timeMatch[3]), Number(timeMatch[4]), 0, 0);

      const title = cleanTitle(text) || 'Untitled event';
      const key = `${toDateString(start)}|${toTimeString(start)}|${title}`;
      if (seen.has(key)) return;
      seen.add(key);

      events.push({ title, description: '', location: '', start, end, isAllDay: false });
    });

    return events.map(toImportedEvent);
  }

  /* ---------- normalisation ---------- */

  function toImportedEvent(event) {
    return {
      title: event.title,
      date: toDateString(event.start),
      time: event.isAllDay ? null : toTimeString(event.start),
      endTime: event.isAllDay || !event.end ? null : toTimeString(event.end),
      location: event.location || '',
      notes: event.description || '',
      isAllDay: !!event.isAllDay
    };
  }

  function sortEvents(events) {
    return events.slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  }

  function isDuplicate(event, existing) {
    return existing.some(e =>
      e.date === event.date &&
      (e.time || null) === (event.time || null) &&
      (e.title || '').trim().toLowerCase() === event.title.trim().toLowerCase()
    );
  }

  /* ---------- fetching ---------- */

  async function fetchSchedule(url) {
    const response = await fetch('/api/schedule-fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data.error && data.error.message) || 'Could not load that schedule');
    }
    return data;
  }

  function parseScheduleContent(content, format) {
    if (format === 'ics' || /BEGIN:VCALENDAR/i.test(content.slice(0, 2000))) {
      return { format: 'ics', events: parseIcs(content) };
    }
    return { format: 'html', events: parseHtmlSchedule(content) };
  }

  /* ---------- UI ---------- */

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function renderSourcesList() {
    const sources = loadScheduleSources();
    if (!sources.length) return '';
    return `
      <div class="schedule-import-sources">
        <div class="schedule-import-label">Linked schedules</div>
        ${sources.map((source, index) => `
          <div class="schedule-import-source">
            <div class="schedule-import-source-info">
              <span class="schedule-import-source-name">${escapeHtml(source.name)}</span>
              <span class="schedule-import-source-meta">Last synced ${new Date(source.lastSync).toLocaleDateString()}</span>
            </div>
            <div class="schedule-import-source-actions">
              <button class="btn btn-secondary btn-sm" onclick="resyncScheduleSource(${index})">Sync</button>
              <button class="btn btn-secondary btn-sm" onclick="removeScheduleSource(${index})">Remove</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function openScheduleImportModal() {
    const content = `
      <div class="schedule-import-modal">
        <p class="schedule-import-intro">
          Paste the link to your university timetable or any calendar feed. Layer reads the
          dates, times, rooms and titles and adds them to your calendar.
          Subscription links (iCal / .ics / webcal) import most reliably.
        </p>

        <div class="form-group">
          <label class="form-label" for="scheduleImportUrl">Schedule link</label>
          <input id="scheduleImportUrl" type="url" class="form-input"
                 placeholder="https://your-university.edu/timetable.ics"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();importScheduleFromUrl();}" />
        </div>

        <details class="schedule-import-advanced">
          <summary>Paste calendar content instead</summary>
          <textarea id="scheduleImportRaw" class="form-input schedule-import-textarea"
                    placeholder="BEGIN:VCALENDAR ... or the copied HTML of your timetable page"></textarea>
          <button class="btn btn-secondary" onclick="importScheduleFromText()">Read pasted content</button>
        </details>

        <div id="scheduleImportStatus" class="schedule-import-status"></div>
        <div id="scheduleImportPreview"></div>
        ${renderSourcesList()}

        <div class="form-actions">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="importScheduleFromUrl()">Fetch schedule</button>
        </div>
      </div>
    `;
    openModal('Link an external schedule', content);
    setTimeout(() => {
      const input = document.getElementById('scheduleImportUrl');
      if (input) input.focus();
    }, 50);
  }

  function setStatus(message, type = 'info') {
    const status = document.getElementById('scheduleImportStatus');
    if (status) status.innerHTML = message ? `<span class="schedule-import-status-${type}">${escapeHtml(message)}</span>` : '';
  }

  function renderPreview(events, meta) {
    const container = document.getElementById('scheduleImportPreview');
    if (!container) return;
    if (!events.length) {
      container.innerHTML = `<div class="schedule-import-empty">No events found. If this is a login-protected timetable, open it, export the iCal/.ics subscription link and paste that instead.</div>`;
      return;
    }

    const existing = typeof loadCalendarEvents === 'function' ? loadCalendarEvents() : [];
    const rows = events.map((event, index) => {
      const duplicate = isDuplicate(event, existing);
      const timeLabel = event.time ? `${event.time}${event.endTime ? ` – ${event.endTime}` : ''}` : 'All day';
      return `
        <label class="schedule-import-row${duplicate ? ' is-duplicate' : ''}">
          <input type="checkbox" data-import-index="${index}" ${duplicate ? '' : 'checked'} />
          <span class="schedule-import-row-date">${escapeHtml(event.date)}</span>
          <span class="schedule-import-row-time">${escapeHtml(timeLabel)}</span>
          <span class="schedule-import-row-title">${escapeHtml(event.title)}</span>
          <span class="schedule-import-row-location">${escapeHtml(event.location || '')}</span>
          ${duplicate ? '<span class="schedule-import-row-tag">already added</span>' : ''}
        </label>
      `;
    }).join('');

    container.innerHTML = `
      <div class="schedule-import-preview-header">
        <span>${events.length} event${events.length === 1 ? '' : 's'} found${meta && meta.format === 'html' ? ' (read from the page layout — please review)' : ''}</span>
        <div>
          <button class="btn btn-secondary btn-sm" onclick="toggleAllScheduleImport(true)">Select all</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleAllScheduleImport(false)">Clear</button>
        </div>
      </div>
      <div class="schedule-import-list">${rows}</div>
      <button class="btn btn-primary schedule-import-confirm" onclick="confirmScheduleImport()">Add selected events to calendar</button>
    `;
  }

  function toggleAllScheduleImport(checked) {
    document.querySelectorAll('#scheduleImportPreview input[data-import-index]').forEach(input => {
      input.checked = checked;
    });
  }

  async function importScheduleFromUrl(presetUrl) {
    const input = document.getElementById('scheduleImportUrl');
    const url = (presetUrl || (input && input.value) || '').trim();
    if (!url) {
      setStatus('Enter a schedule link first', 'error');
      return;
    }
    setStatus('Loading schedule…');
    try {
      const result = await fetchSchedule(url);
      const parsed = parseScheduleContent(result.content, result.format);
      previewEvents = sortEvents(parsed.events);
      previewMeta = { format: parsed.format, url, sourceUrl: result.sourceUrl };
      setStatus(parsed.format === 'ics' ? 'Calendar feed read successfully' : 'Read the page layout — check the detected events below');
      renderPreview(previewEvents, previewMeta);
    } catch (error) {
      previewEvents = [];
      setStatus(error.message, 'error');
      renderPreview([], null);
    }
  }

  function importScheduleFromText() {
    const textarea = document.getElementById('scheduleImportRaw');
    const raw = (textarea && textarea.value || '').trim();
    if (!raw) {
      setStatus('Paste the calendar content first', 'error');
      return;
    }
    const parsed = parseScheduleContent(raw, null);
    previewEvents = sortEvents(parsed.events);
    previewMeta = { format: parsed.format, url: null };
    setStatus(`Read ${previewEvents.length} event${previewEvents.length === 1 ? '' : 's'} from the pasted content`);
    renderPreview(previewEvents, previewMeta);
  }

  async function confirmScheduleImport() {
    const selected = [...document.querySelectorAll('#scheduleImportPreview input[data-import-index]:checked')]
      .map(input => previewEvents[Number(input.dataset.importIndex)])
      .filter(Boolean);

    if (!selected.length) {
      setStatus('Select at least one event', 'error');
      return;
    }

    setStatus(`Adding ${selected.length} event${selected.length === 1 ? '' : 's'}…`);
    const importId = Date.now();
    let added = 0;

    for (const event of selected) {
      const payload = {
        id: importId + added,
        title: event.title,
        date: event.date,
        time: event.time,
        endTime: event.endTime,
        color: '#3b82f6',
        category: 'default',
        location: event.location,
        notes: event.notes,
        isRecurring: false,
        recurringId: null
      };
      if (typeof saveCalendarEventAsync === 'function') {
        await saveCalendarEventAsync(payload);
      } else {
        const events = loadCalendarEvents();
        events.push(payload);
        saveCalendarEvents(events);
      }
      added++;
    }

    if (previewMeta && previewMeta.url) {
      rememberSource(previewMeta.url, hostnameOf(previewMeta.url), added);
    }

    if (typeof showToast === 'function') showToast(`Imported ${added} event${added === 1 ? '' : 's'} from your schedule`);
    if (typeof closeModal === 'function') closeModal();
    if (typeof renderCurrentView === 'function') renderCurrentView();
  }

  function hostnameOf(url) {
    try { return new URL(url).hostname; } catch { return url; }
  }

  function resyncScheduleSource(index) {
    const source = loadScheduleSources()[index];
    if (!source) return;
    const input = document.getElementById('scheduleImportUrl');
    if (input) input.value = source.url;
    importScheduleFromUrl(source.url);
  }

  function removeScheduleSource(index) {
    const sources = loadScheduleSources();
    sources.splice(index, 1);
    saveScheduleSources(sources);
    openScheduleImportModal();
  }

  /* ---------- exports ---------- */

  window.openScheduleImportModal = openScheduleImportModal;
  window.importScheduleFromUrl = importScheduleFromUrl;
  window.importScheduleFromText = importScheduleFromText;
  window.confirmScheduleImport = confirmScheduleImport;
  window.toggleAllScheduleImport = toggleAllScheduleImport;
  window.resyncScheduleSource = resyncScheduleSource;
  window.removeScheduleSource = removeScheduleSource;
  window.LayerScheduleImport = { parseIcs, parseHtmlSchedule, parseScheduleContent, loadScheduleSources };
})();

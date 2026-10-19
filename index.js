// Holiday Forge — SillyTavern extension
// Generate, track and inject in-world holidays. Per-chat state, theme-adaptive, mobile-first.

import { extension_settings, getContext } from '../../../extensions.js';
import {
    saveSettingsDebounced,
    eventSource,
    event_types,
    setExtensionPrompt,
    extension_prompt_types,
    extension_prompt_roles,
} from '../../../../script.js';

const MODULE = 'holidayForge';
const META = 'holidayForge';
const PROMPT_KEY = 'HOLIDAY_FORGE';

const TYPES = {
    religious: { icon: '🕯️', color: '#e0b04a' },
    cultural: { icon: '🎭', color: '#d9718f' },
    seasonal: { icon: '🍂', color: '#5fb87a' },
    personal: { icon: '💝', color: '#7aa2f7' },
};

const GREGORIAN = [
    ['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
    ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31],
];

const STYLES = {
    balanced: 'Balanced mix of grand festivals and small everyday observances.',
    grounded: 'Realistic, grounded and culturally plausible; avoid anything over-the-top.',
    whimsical: 'Playful, colorful and imaginative, with quirky customs.',
    solemn: 'Serious, ceremonial and reverent in tone, with weighty traditions.',
};

const DEFAULTS = {
    enabled: true,
    inject: true,
    depth: 2,
    frequency: 1,
    tokenBudget: 200,
    window: 14,
    maxItems: 3,
    dateFormat: 'DMY',
    offset: 0,
    flow: 0,
    style: 'balanced',
    count: 8,
    strip: true,
    toast: true,
    autoGenerate: false,
    defaultProfile: 'default',
    profiles: {},
};

const ui = { tab: 'overview', editing: null, editingProfile: null, busy: false, filter: 'all', ideas: {}, open: false };
const inj = { text: '' };
let scanTimer = null;

/* ------------------------------------------------------------------ utils */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => `hf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function S() {
    const s = (extension_settings[MODULE] ??= {});
    for (const k of Object.keys(DEFAULTS)) {
        if (!(k in s)) s[k] = structuredClone(DEFAULTS[k]);
    }
    if (!Object.keys(s.profiles).length) {
        s.profiles.default = newProfile('default', 'Default world');
    }
    if (!s.profiles[s.defaultProfile]) s.defaultProfile = Object.keys(s.profiles)[0];
    return s;
}

function newProfile(id, name) {
    return { id, name, world: '', faith: '', calendarType: 'gregorian', months: '', region: '', rules: '' };
}

function hasChat() {
    const ctx = getContext();
    return !!(ctx.chatId ?? ctx.getCurrentChatId?.());
}

function C() {
    const md = getContext().chatMetadata;
    if (!md) return null;
    md[META] ??= { profileId: null, holidays: [], celebrated: {}, mentions: {}, clock: null, toastKey: null, autoDone: false };
    return md[META];
}

function saveChat() {
    const ctx = getContext();
    if (ctx.saveMetadataDebounced) ctx.saveMetadataDebounced();
    else ctx.saveMetadata?.();
}

function P() {
    const s = S();
    const st = C();
    return s.profiles[st?.profileId] || s.profiles[s.defaultProfile];
}

/* --------------------------------------------------------------- calendar */

function parseMonths(str) {
    return String(str || '')
        .split(/[,\n]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => {
            const i = x.lastIndexOf(':');
            if (i < 0) return null;
            const name = x.slice(0, i).trim();
            const days = parseInt(x.slice(i + 1), 10);
            return name && days > 0 ? { name, days } : null;
        })
        .filter(Boolean);
}

function calendar(p) {
    if (p.calendarType === 'custom') {
        const m = parseMonths(p.months);
        if (m.length) return m;
    }
    return GREGORIAN.map(([name, days]) => ({ name, days }));
}

const yearLen = (cal) => cal.reduce((a, m) => a + m.days, 0);
const mIdx = (cal, m) => clamp(parseInt(m, 10) || 1, 1, cal.length);
const dClamp = (cal, m, d) => clamp(parseInt(d, 10) || 1, 1, cal[mIdx(cal, m) - 1].days);

function dayOfYear(cal, m, d) {
    m = mIdx(cal, m);
    let n = 0;
    for (let i = 0; i < m - 1; i++) n += cal[i].days;
    return n + dClamp(cal, m, d) - 1;
}

const toDay = (cal, y, m, d) => y * yearLen(cal) + dayOfYear(cal, m, d);

function fromDay(cal, s) {
    const L = yearLen(cal);
    const y = Math.floor(s / L);
    let r = s - y * L;
    let m = 0;
    while (r >= cal[m].days) { r -= cal[m].days; m++; }
    return { y, m: m + 1, d: r + 1 };
}

function ensureClock() {
    const st = C();
    if (st.clock) return st.clock;
    const p = P();
    const cal = calendar(p);
    if (p.calendarType === 'custom') {
        st.clock = { y: 1, m: 1, d: 1, h: 8, min: 0, anchor: Date.now() };
    } else {
        const n = new Date();
        st.clock = { y: n.getFullYear(), m: n.getMonth() + 1, d: dClamp(cal, n.getMonth() + 1, n.getDate()), h: 8, min: 0, anchor: Date.now() };
    }
    saveChat();
    return st.clock;
}

function clockMinutes(withOffset = true) {
    const c = ensureClock();
    const cal = calendar(P());
    const s = S();
    let t = toDay(cal, c.y, c.m, c.d) * 1440 + c.h * 60 + c.min;
    if (s.flow > 0) t += Math.floor(((Date.now() - c.anchor) / 60000) * s.flow);
    if (withOffset) t += Math.round(s.offset) * 1440;
    return t;
}

function storeClock(t) {
    const cal = calendar(P());
    const day = Math.floor(t / 1440);
    const rem = t - day * 1440;
    const dt = fromDay(cal, day);
    C().clock = { ...dt, h: Math.floor(rem / 60), min: rem % 60, anchor: Date.now() };
    saveChat();
}

function nowParts() {
    const cal = calendar(P());
    const t = clockMinutes(true);
    const day = Math.floor(t / 1440);
    const rem = t - day * 1440;
    return { cal, t, day, h: Math.floor(rem / 60), min: rem % 60, ...fromDay(cal, day) };
}

function fmtMD(cal, m, d) {
    const n = cal[mIdx(cal, m) - 1].name;
    return S().dateFormat === 'DMY' ? `${d} ${n}` : `${n} ${d}`;
}

function fmtDate(cal, y, m, d) {
    const n = cal[mIdx(cal, m) - 1].name;
    switch (S().dateFormat) {
        case 'MDY': return `${n} ${d}, ${y}`;
        case 'YMD': return `${y} ${n} ${d}`;
        default: return `${d} ${n} ${y}`;
    }
}

/* --------------------------------------------------------------- holidays */

const holidays = () => C()?.holidays ?? [];
const visible = () => holidays().filter((h) => !h.hidden);

function occurrence(cal, h, nowDay) {
    const { y } = fromDay(cal, nowDay);
    if (h.year !== null && h.year !== undefined && h.year !== '') return toDay(cal, +h.year, h.month, h.day);
    let s = toDay(cal, y, h.month, h.day);
    if (s < nowDay) s = toDay(cal, y + 1, h.month, h.day);
    return s;
}

function upcoming() {
    const { cal, t, day } = nowParts();
    return visible()
        .map((h) => {
            const serial = occurrence(cal, h, day);
            return { h, serial, delta: serial - day, mins: serial * 1440 - t };
        })
        .filter((x) => x.delta >= 0)
        .sort((a, b) => a.serial - b.serial);
}

function mergeGenerated(list) {
    const st = C();
    const manual = new Set(st.holidays.filter((h) => h.source === 'manual').map((h) => h.name.toLowerCase()));
    const known = new Set(st.holidays.map((h) => h.name.toLowerCase()));
    let added = 0;
    for (const h of list) {
        const key = h.name.toLowerCase();
        if (manual.has(key) || known.has(key)) continue; // manual always overrides, no dupes
        st.holidays.push(h);
        known.add(key);
        added++;
    }
    saveChat();
    return added;
}

/* ------------------------------------------------------------------- scan */

function scanChat() {
    const st = C();
    if (!st) return;
    const chat = getContext().chat || [];
    const mentions = {};
    for (const h of holidays()) {
        const re = new RegExp(`(^|[^\\p{L}\\p{N}])${reEsc(h.name)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
        chat.forEach((m, i) => {
            if (!m || m.is_system || !m.mes) return;
            const hit = re.exec(m.mes);
            if (!hit) return;
            const rec = (mentions[h.id] ??= { first: i, last: i, count: 0, snippet: '' });
            rec.last = i;
            rec.count++;
            const at = hit.index;
            rec.snippet = m.mes.slice(Math.max(0, at - 40), at + h.name.length + 60).replace(/\s+/g, ' ').trim();
        });
    }
    st.mentions = mentions;
    saveChat();
}

function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { scanChat(); if (ui.open) renderBody(); }, 1200);
}

function isPassed(h) {
    const st = C();
    if (st.celebrated[h.id]) return true;
    if (!st.mentions[h.id]) return false;
    const { cal, day, y } = nowParts();
    if (h.year !== null && h.year !== undefined && h.year !== '') return toDay(cal, +h.year, h.month, h.day) < day;
    return toDay(cal, y, h.month, h.day) < day;
}

/* -------------------------------------------------------------- injection */

async function tokens(text) {
    try {
        const ctx = getContext();
        if (ctx.getTokenCountAsync) return await ctx.getTokenCountAsync(text);
    } catch { /* fallthrough */ }
    return Math.ceil(text.length / 3.6);
}

async function buildInjection() {
    const s = S();
    if (!s.enabled || !s.inject || !hasChat()) return '';
    const st = C();
    if (!st || !visible().length) return '';
    const { cal, y, m, d } = nowParts();
    const list = upcoming().filter((x) => x.delta <= s.window).slice(0, Math.max(1, s.maxItems));
    if (!list.length) return '';
    const short = (t, n) => (t && t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t || '');
    const lines = [`[Holiday Forge — in-world date: ${fmtDate(cal, y, m, d)}]`];
    for (const x of list) {
        const h = x.h;
        if (x.delta === 0) {
            lines.push(`TODAY: ${h.name} (${h.type}). ${short(h.description, 180)}${h.traditions ? ' Traditions: ' + short(h.traditions, 140) + '.' : ''}${h.tone ? ' Mood: ' + h.tone + '.' : ''}`);
        } else {
            lines.push(`In ${x.delta} day${x.delta === 1 ? '' : 's'} (${fmtMD(cal, h.month, h.day)}): ${h.name} (${h.type}). ${short(h.description, 120)}`);
        }
    }
    lines.push('Characters may mention these occasions naturally when it fits; never force them.');
    let text = lines.join('\n');
    while ((await tokens(text)) > s.tokenBudget && lines.length > 2) {
        lines.splice(lines.length - 2, 1); // drop the last holiday line, keep the footer
        text = lines.join('\n');
    }
    if ((await tokens(text)) > s.tokenBudget) text = lines.slice(0, 2).join('\n');
    return text;
}

function applyInjection() {
    const s = S();
    const len = (getContext().chat || []).length;
    const on = inj.text && (s.frequency <= 1 || len % s.frequency === 0);
    setExtensionPrompt(PROMPT_KEY, on ? inj.text : '', extension_prompt_types.IN_CHAT, clamp(s.depth, 0, 20), false, extension_prompt_roles.SYSTEM);
}

async function refreshInjection() {
    try {
        inj.text = await buildInjection();
    } catch (e) {
        console.warn('[Holiday Forge] injection failed', e);
        inj.text = '';
    }
    applyInjection();
}

/* ------------------------------------------------------------- generation */

function profileBlock(p, cal) {
    return [
        `- World: ${p.world || 'infer from the character card / world info'}`,
        `- Faith / belief system: ${p.faith || 'infer from context'}`,
        `- Region / culture: ${p.region || 'infer from context'}`,
        `- Calendar: ${p.calendarType === 'custom' ? 'custom' : 'Gregorian'}; months numbered ${cal.map((m, i) => `${i + 1}=${m.name}(${m.days}d)`).join(', ')}`,
        p.rules ? `- Custom rules: ${p.rules}` : '',
    ].filter(Boolean).join('\n');
}

async function quiet(prompt) {
    const ctx = getContext();
    let out = '';
    try {
        out = await ctx.generateQuietPrompt({ quietPrompt: prompt });
    } catch (e) {
        console.warn('[Holiday Forge] object-style quiet prompt failed, trying legacy', e);
    }
    if (!out || typeof out !== 'string') out = await ctx.generateQuietPrompt(prompt, false, false);
    return String(out || '');
}

function parseJsonList(text) {
    let t = text.replace(/```(?:json)?/gi, '').trim();
    const a = t.indexOf('[');
    const b = t.lastIndexOf(']');
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    const data = JSON.parse(t);
    return Array.isArray(data) ? data : data.holidays || [];
}

async function generate(userPrompt) {
    const s = S();
    const p = P();
    const cal = calendar(p);
    const existing = holidays().map((h) => h.name).join('; ') || 'none';
    const prompt = `[OOC SYSTEM TASK — pause the roleplay. Do not write story text or dialogue.]
Invent ${s.count} holidays / celebrations for this roleplay world. Treat the character card, world info and chat so far as the source of truth.
World profile:
${profileBlock(p, cal)}
Style: ${STYLES[s.style] || STYLES.balanced}
User request: ${userPrompt || 'none, use your judgement'}
Already existing (do not duplicate): ${existing}
Return ONLY a valid JSON array. No markdown, no commentary. Each item:
{"name":"","month":<number 1-${cal.length}>,"day":<number>,"type":"religious|cultural|seasonal|personal","description":"1-2 sentences","traditions":"1-3 short customs","tone":"2-3 words"}`;

    const raw = await quiet(prompt);
    const list = parseJsonList(raw)
        .filter((x) => x && x.name)
        .map((x) => {
            let month = x.month;
            if (typeof month === 'string' && isNaN(+month)) {
                const i = cal.findIndex((c) => c.name.toLowerCase() === month.trim().toLowerCase());
                month = i >= 0 ? i + 1 : 1;
            }
            month = mIdx(cal, month);
            return {
                id: uid(),
                name: String(x.name).trim(),
                month,
                day: dClamp(cal, month, x.day),
                year: null,
                type: TYPES[x.type] ? x.type : 'cultural',
                description: String(x.description || '').trim(),
                traditions: String(x.traditions || '').trim(),
                tone: String(x.tone || '').trim(),
                source: 'generated',
                hidden: false,
            };
        });
    return mergeGenerated(list);
}

async function ideasFor(h) {
    const p = P();
    const prompt = `[OOC SYSTEM TASK — pause the roleplay. Do not write story text.]
Suggest 3 short, concrete scene ideas (one sentence each, as a bullet list) for how the characters could spend "${h.name}" (${h.type}: ${h.description}) in this roleplay. Use the characters, setting and current mood of the chat. World: ${p.world || 'see context'}; faith: ${p.faith || 'see context'}.`;
    return (await quiet(prompt)).trim();
}

/* ------------------------------------------------------------------- html */

const typeChip = (t) => `<span class="hf-chip" style="--c:${TYPES[t]?.color || '#999'}">${TYPES[t]?.icon || '✨'} ${esc(t)}</span>`;

function cdTiles(totalMin) {
    const mins = Math.max(0, totalMin);
    const dd = Math.floor(mins / 1440);
    const hh = Math.floor((mins % 1440) / 60);
    const mm = mins % 60;
    const tile = (n, l) => `<div class="hf-tile"><b>${n}</b><span>${l}</span></div>`;
    return tile(dd, 'days') + tile(hh, 'hours') + tile(mm, 'min');
}

function miniRow(x, cal) {
    const h = x.h;
    const label = x.delta === 0 ? 'Today' : x.delta === 1 ? 'Tomorrow' : `in ${x.delta}d`;
    return `<div class="hf-row" style="--c:${TYPES[h.type]?.color}">
        <div class="hf-ico">${TYPES[h.type]?.icon || '✨'}</div>
        <div class="hf-grow"><div class="hf-name">${esc(h.name)}</div><div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))}</div></div>
        <div class="hf-when ${x.delta === 0 ? 'now' : ''}">${label}</div></div>`;
}

function viewOverview() {
    const np = nowParts();
    const list = upcoming();
    const today = list.filter((x) => x.delta === 0);
    const next = list.find((x) => x.delta > 0);
    const top3 = list.slice(0, 3);
    let html = '';

    if (!visible().length) {
        html += `<div class="hf-empty"><div class="hf-bigico">🎆</div><p>No holidays in this chat yet.</p>
            <button class="hf-btn primary" data-hf="goto" data-tab="holidays">Generate holidays</button></div>`;
    } else {
        for (const x of today) {
            html += `<div class="hf-today" style="--c:${TYPES[x.h.type]?.color}"><div class="hf-today-h">🎉 Today — ${esc(x.h.name)}</div>
                <div class="hf-sub">${esc(x.h.description)}</div>${x.h.traditions ? `<div class="hf-sub"><b>Traditions:</b> ${esc(x.h.traditions)}</div>` : ''}
                <button class="hf-btn small" data-hf="ideas" data-id="${x.h.id}">💡 Scene ideas</button>
                <div class="hf-ideas">${ui.ideas[x.h.id] ? esc(ui.ideas[x.h.id]) : ''}</div></div>`;
        }
        if (next) {
            html += `<div class="hf-hero" style="--c:${TYPES[next.h.type]?.color}">
                <div class="hf-hero-top">${typeChip(next.h.type)}<span class="hf-sub">${esc(fmtMD(np.cal, next.h.month, next.h.day))}</span></div>
                <div class="hf-hero-name">${esc(next.h.name)}</div>
                <div class="hf-cd" data-serial="${next.serial}">${cdTiles(next.mins)}</div>
                <div class="hf-sub">${esc(next.h.description)}</div>
                <button class="hf-btn small" data-hf="ideas" data-id="${next.h.id}">💡 Scene ideas</button>
                <div class="hf-ideas">${ui.ideas[next.h.id] ? esc(ui.ideas[next.h.id]) : ''}</div></div>`;
        }
        html += `<div class="hf-h">Next 3</div><div class="hf-card">${top3.map((x) => miniRow(x, np.cal)).join('') || '<div class="hf-sub">Nothing upcoming.</div>'}</div>`;
    }

    const monthOpts = np.cal.map((m, i) => `<option value="${i + 1}" ${i + 1 === np.m ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    html += `<details class="hf-card hf-clock"><summary>🕰️ In-world date: <b>${esc(fmtDate(np.cal, np.y, np.m, np.d))}</b>, ${String(np.h).padStart(2, '0')}:${String(np.min).padStart(2, '0')}</summary>
        <div class="hf-grid">
            <label>Day<input class="text_pole" type="number" id="hf_cd_d" value="${np.d}" min="1"></label>
            <label>Month<select class="text_pole" id="hf_cd_m">${monthOpts}</select></label>
            <label>Year<input class="text_pole" type="number" id="hf_cd_y" value="${np.y}"></label>
            <label>Hour<input class="text_pole" type="number" id="hf_cd_h" value="${np.h}" min="0" max="23"></label>
        </div>
        <div class="hf-actions">
            <button class="hf-btn primary" data-hf="setclock">Set date</button>
            <button class="hf-btn" data-hf="advance" data-n="1">+1 day</button>
            <button class="hf-btn" data-hf="advance" data-n="7">+7 days</button>
        </div></details>`;
    return html;
}

function holidayCard(h, cal) {
    const mention = C().mentions[h.id];
    return `<details class="hf-hcard" style="--c:${TYPES[h.type]?.color}">
        <summary><div class="hf-ico">${TYPES[h.type]?.icon || '✨'}</div>
            <div class="hf-grow"><div class="hf-name">${esc(h.name)} ${h.hidden ? '<span class="hf-badge">hidden</span>' : ''}</div>
            <div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))}${h.year ? ' ' + esc(h.year) : ''} · ${h.source === 'manual' ? '✍️ manual' : '✨ generated'}${mention ? ` · 💬 ×${mention.count}` : ''}</div></div>
            ${typeChip(h.type)}</summary>
        <div class="hf-hbody">
            ${h.description ? `<p>${esc(h.description)}</p>` : ''}
            ${h.traditions ? `<p><b>Traditions:</b> ${esc(h.traditions)}</p>` : ''}
            ${h.tone ? `<p><b>Tone:</b> ${esc(h.tone)}</p>` : ''}
            <div class="hf-actions">
                <button class="hf-btn small" data-hf="edit" data-id="${h.id}">✏️ Edit</button>
                <button class="hf-btn small" data-hf="hide" data-id="${h.id}">${h.hidden ? '👁️ Show' : '🙈 Hide'}</button>
                <button class="hf-btn small danger" data-hf="del" data-id="${h.id}">🗑️ Delete</button>
            </div></div></details>`;
}

function viewHolidays() {
    const { cal } = nowParts();
    const s = S();
    if (ui.editing) return viewEditor(cal);
    const filters = ['all', ...Object.keys(TYPES)];
    const list = holidays()
        .filter((h) => ui.filter === 'all' || h.type === ui.filter)
        .sort((a, b) => dayOfYear(cal, a.month, a.day) - dayOfYear(cal, b.month, b.day));
    return `<div class="hf-card">
            <div class="hf-h">✨ Generate with LLM</div>
            <textarea class="text_pole" id="hf_gen_prompt" rows="2" placeholder="Optional: e.g. harvest festivals, a holiday for the elves, something tied to the war…"></textarea>
            <div class="hf-actions">
                <label class="hf-inline">Count <input class="text_pole hf-num" type="number" id="hf_gen_count" min="1" max="20" value="${s.count}"></label>
                <button class="hf-btn primary" data-hf="generate" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '⏳ Generating…' : '✨ Generate'}</button>
                <button class="hf-btn" data-hf="add">➕ Add own</button>
            </div></div>
        <div class="hf-filters">${filters.map((f) => `<button class="hf-pill ${ui.filter === f ? 'on' : ''}" data-hf="filter" data-f="${f}">${f === 'all' ? 'All' : TYPES[f].icon + ' ' + f}</button>`).join('')}</div>
        ${list.map((h) => holidayCard(h, cal)).join('') || '<div class="hf-empty"><p>Nothing here.</p></div>'}`;
}

function viewEditor(cal) {
    const h = ui.editing === 'new'
        ? { name: '', month: 1, day: 1, year: '', type: 'cultural', description: '', traditions: '', tone: '' }
        : holidays().find((x) => x.id === ui.editing) || {};
    return `<div class="hf-card"><div class="hf-h">${ui.editing === 'new' ? '➕ New holiday' : '✏️ Edit holiday'}</div>
        <label>Name<input class="text_pole" id="hf_e_name" value="${esc(h.name)}"></label>
        <div class="hf-grid">
            <label>Month<select class="text_pole" id="hf_e_month">${cal.map((m, i) => `<option value="${i + 1}" ${+h.month === i + 1 ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
            <label>Day<input class="text_pole" type="number" id="hf_e_day" min="1" value="${h.day}"></label>
            <label>Year <small>(optional, one-off)</small><input class="text_pole" type="number" id="hf_e_year" value="${h.year ?? ''}"></label>
            <label>Type<select class="text_pole" id="hf_e_type">${Object.keys(TYPES).map((t) => `<option ${h.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        </div>
        <label>Tone<input class="text_pole" id="hf_e_tone" value="${esc(h.tone)}" placeholder="e.g. joyful, solemn"></label>
        <label>Description<textarea class="text_pole" id="hf_e_desc" rows="3">${esc(h.description)}</textarea></label>
        <label>Traditions<textarea class="text_pole" id="hf_e_trad" rows="3">${esc(h.traditions)}</textarea></label>
        <div class="hf-actions"><button class="hf-btn primary" data-hf="save-holiday">💾 Save</button><button class="hf-btn" data-hf="cancel-edit">Cancel</button></div>
        <div class="hf-sub">Saved entries become manual and override generated ones with the same name.</div></div>`;
}

function viewHistory() {
    const { cal, day, y } = nowParts();
    const st = C();
    const items = visible()
        .filter((h) => isPassed(h) || st.mentions[h.id])
        .map((h) => ({ h, m: st.mentions[h.id], passed: isPassed(h) }))
        .sort((a, b) => (a.m?.last ?? 1e9) - (b.m?.last ?? 1e9));
    let html = `<div class="hf-actions"><button class="hf-btn primary" data-hf="scan">🔍 Scan chat</button></div>
        <div class="hf-sub">Looks for holiday names in messages. A holiday counts as passed once it is mentioned and its in-world date is behind the current date, or when you mark it manually.</div>`;
    if (!items.length) return html + '<div class="hf-empty"><div class="hf-bigico">📜</div><p>No celebrations on the timeline yet.</p></div>';
    html += '<div class="hf-timeline">';
    for (const { h, m, passed } of items) {
        html += `<div class="hf-tl ${passed ? 'done' : ''}" style="--c:${TYPES[h.type]?.color}">
            <div class="hf-dot"></div>
            <div class="hf-tl-body"><div class="hf-name">${TYPES[h.type]?.icon} ${esc(h.name)} <span class="hf-badge">${passed ? 'passed' : 'mentioned'}</span></div>
            <div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))}${m ? ` · msg #${m.first}${m.count > 1 ? `–#${m.last}` : ''} · ×${m.count}` : ''}</div>
            ${m?.snippet ? `<div class="hf-quote">…${esc(m.snippet)}…</div>` : ''}
            <label class="checkbox_label"><input type="checkbox" data-hf="celebrate" data-id="${h.id}" ${st.celebrated[h.id] ? 'checked' : ''}><span>Mark as celebrated</span></label></div></div>`;
    }
    return html + '</div>';
}

function viewProfiles() {
    const s = S();
    const st = C();
    const activeId = st?.profileId || s.defaultProfile;
    const ids = Object.keys(s.profiles);
    const ep = s.profiles[ui.editingProfile || activeId];
    return `<div class="hf-card"><div class="hf-h">🌍 World profile for this chat</div>
        <select class="text_pole" id="hf_profile_pick">${ids.map((id) => `<option value="${id}" ${id === activeId ? 'selected' : ''}>${esc(s.profiles[id].name)}</option>`).join('')}</select>
        <div class="hf-actions"><button class="hf-btn" data-hf="profile-new">➕ New</button><button class="hf-btn" data-hf="profile-dup">⧉ Duplicate</button><button class="hf-btn danger" data-hf="profile-del">🗑️ Delete</button></div></div>
        <div class="hf-card"><div class="hf-h">✏️ Edit “${esc(ep.name)}”</div>
        <label>Profile name<input class="text_pole" data-p="name" value="${esc(ep.name)}"></label>
        <label>World name<input class="text_pole" data-p="world" value="${esc(ep.world)}"></label>
        <label>Faith system<input class="text_pole" data-p="faith" value="${esc(ep.faith)}" placeholder="e.g. Moon Church, ancestor worship"></label>
        <label>Region / culture<input class="text_pole" data-p="region" value="${esc(ep.region)}"></label>
        <label>Calendar<select class="text_pole" data-p="calendarType"><option value="gregorian" ${ep.calendarType === 'gregorian' ? 'selected' : ''}>Gregorian (12 months)</option><option value="custom" ${ep.calendarType === 'custom' ? 'selected' : ''}>Custom</option></select></label>
        ${ep.calendarType === 'custom' ? `<label>Months <small>(Name:days, comma or newline separated)</small><textarea class="text_pole" rows="3" data-p="months" placeholder="Frostmoon:30, Seedmoon:28, Sunpeak:31">${esc(ep.months)}</textarea></label>` : ''}
        <label>Custom rules<textarea class="text_pole" rows="3" data-p="rules" placeholder="e.g. No holidays on the winter solstice; the empire bans religious festivals">${esc(ep.rules)}</textarea></label>
        <div class="hf-actions"><button class="hf-btn" data-hf="profile-export">⬇️ Export JSON</button><button class="hf-btn" data-hf="profile-import">⬆️ Import JSON</button></div>
        <input type="file" id="hf_import_file" accept=".json,application/json" hidden></div>`;
}

function viewSettings() {
    const s = S();
    const chk = (k, l) => `<label class="checkbox_label"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}><span>${l}</span></label>`;
    const num = (k, l, min, max, step = 1) => `<label>${l}<input class="text_pole" type="number" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"></label>`;
    return `<div class="hf-card"><div class="hf-h">Generation</div>
            <label>Style<select class="text_pole" data-set="style">${Object.keys(STYLES).map((k) => `<option value="${k}" ${s.style === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
            ${num('count', 'Holidays per generation', 1, 20)}
            ${chk('autoGenerate', 'Auto-generate when a chat has no holidays')}</div>
        <div class="hf-card"><div class="hf-h">Character awareness</div>
            ${chk('enabled', 'Extension enabled')}
            ${chk('inject', 'Inject holidays into the prompt')}
            <div class="hf-grid">${num('tokenBudget', 'Token budget', 40, 1500, 10)}${num('depth', 'Injection depth', 0, 20)}${num('frequency', 'Every N messages', 1, 20)}${num('window', 'Look-ahead (days)', 1, 365)}${num('maxItems', 'Max holidays', 1, 10)}</div></div>
        <div class="hf-card"><div class="hf-h">Dates &amp; display</div>
            <label>Date format<select class="text_pole" data-set="dateFormat">${[['DMY', 'Day Month Year'], ['MDY', 'Month Day, Year'], ['YMD', 'Year Month Day']].map(([v, l]) => `<option value="${v}" ${s.dateFormat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            ${num('offset', 'Calendar offset (days)', -3650, 3650)}
            ${num('flow', 'Time flow (in-world minutes per real minute, 0 = frozen)', 0, 1440)}
            ${chk('strip', 'Show next-holiday strip above the chat')}
            ${chk('toast', '“Today is a holiday” toast')}</div>`;
}

const TABS = [
    ['overview', '🏠', 'Overview'], ['holidays', '📅', 'Holidays'], ['history', '📜', 'History'],
    ['profiles', '🌍', 'Profiles'], ['settings', '⚙️', 'Settings'],
];

function renderBody() {
    if (!ui.open) return;
    const body = document.querySelector('#hf-sheet .hf-body');
    if (!body) return;
    const scroll = body.scrollTop;
    if (!hasChat()) {
        body.innerHTML = '<div class="hf-empty"><div class="hf-bigico">💬</div><p>Open a chat to use Holiday Forge.</p></div>';
    } else {
        const views = { overview: viewOverview, holidays: viewHolidays, history: viewHistory, profiles: viewProfiles, settings: viewSettings };
        body.innerHTML = views[ui.tab]();
    }
    body.scrollTop = scroll;
    document.querySelectorAll('#hf-sheet .hf-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
    const dEl = document.querySelector('#hf-sheet .hf-date');
    if (dEl && hasChat()) {
        const np = nowParts();
        dEl.textContent = fmtDate(np.cal, np.y, np.m, np.d);
    }
}

function renderStrip() {
    let el = document.getElementById('hf-strip');
    const s = S();
    if (!s.enabled || !s.strip || !hasChat() || !visible().length) { el?.remove(); return; }
    if (!el) {
        el = document.createElement('div');
        el.id = 'hf-strip';
        el.addEventListener('click', openPanel);
        const chat = document.getElementById('chat');
        chat?.parentElement?.insertBefore(el, chat);
    }
    const { cal } = nowParts();
    const list = upcoming();
    const today = list.find((x) => x.delta === 0);
    const next = list.find((x) => x.delta > 0);
    if (today) el.innerHTML = `🎉 <b>Today:</b> ${esc(today.h.name)}`;
    else if (next) el.innerHTML = `${TYPES[next.h.type]?.icon} <b>${esc(next.h.name)}</b> <span class="hf-cd-inline" data-serial="${next.serial}">${inlineCd(next.mins)}</span> <small>${esc(fmtMD(cal, next.h.month, next.h.day))}</small>`;
    else el.textContent = '🎆 Holiday Forge';
}

function inlineCd(mins) {
    mins = Math.max(0, mins);
    return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
}

/* ---------------------------------------------------------------- actions */

function refreshAll() {
    renderBody();
    renderStrip();
    refreshInjection();
}

function toastToday() {
    const s = S();
    if (!s.enabled || !s.toast || !hasChat()) return;
    const st = C();
    const np = nowParts();
    const t = upcoming().find((x) => x.delta === 0);
    const key = `${np.y}-${np.m}-${np.d}`;
    if (t && st.toastKey !== key) {
        st.toastKey = key;
        saveChat();
        window.toastr?.info(`${t.h.name} — ${t.h.description}`.slice(0, 160), '🎉 Today is a holiday');
    }
}

function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function runGenerate(prompt) {
    if (ui.busy) return;
    ui.busy = true;
    renderBody();
    inj.text = '';
    applyInjection();
    try {
        const n = await generate(prompt);
        window.toastr?.success(n ? `Added ${n} holiday${n > 1 ? 's' : ''}` : 'Nothing new was added');
        scanChat();
    } catch (e) {
        console.error('[Holiday Forge]', e);
        window.toastr?.error('Generation failed or the reply was not valid JSON. Try again.');
    }
    ui.busy = false;
    refreshAll();
    toastToday();
}

const actions = {
    open: () => openPanel(),
    close: () => closePanel(),
    tab: (el) => { ui.tab = el.dataset.tab; ui.editing = null; renderBody(); },
    goto: (el) => { ui.tab = el.dataset.tab; renderBody(); },
    filter: (el) => { ui.filter = el.dataset.f; renderBody(); },
    generate: () => {
        const c = parseInt(document.getElementById('hf_gen_count')?.value, 10);
        if (c) S().count = clamp(c, 1, 20);
        saveSettingsDebounced();
        runGenerate(document.getElementById('hf_gen_prompt')?.value.trim());
    },
    add: () => { ui.editing = 'new'; renderBody(); },
    edit: (el) => { ui.editing = el.dataset.id; renderBody(); },
    'cancel-edit': () => { ui.editing = null; renderBody(); },
    'save-holiday': () => {
        const cal = nowParts().cal;
        const v = (id) => document.getElementById(id)?.value.trim() ?? '';
        const name = v('hf_e_name');
        if (!name) return window.toastr?.warning('Give it a name');
        const month = mIdx(cal, v('hf_e_month'));
        const yr = v('hf_e_year');
        const data = {
            name, month, day: dClamp(cal, month, v('hf_e_day')), year: yr === '' ? null : parseInt(yr, 10),
            type: v('hf_e_type'), tone: v('hf_e_tone'), description: v('hf_e_desc'), traditions: v('hf_e_trad'),
            source: 'manual', hidden: false,
        };
        const st = C();
        if (ui.editing === 'new') {
            st.holidays = st.holidays.filter((h) => !(h.source === 'generated' && h.name.toLowerCase() === name.toLowerCase()));
            st.holidays.push({ id: uid(), ...data });
        } else {
            const h = st.holidays.find((x) => x.id === ui.editing);
            if (h) Object.assign(h, data);
        }
        saveChat();
        ui.editing = null;
        scanChat();
        refreshAll();
    },
    hide: (el) => { const h = holidays().find((x) => x.id === el.dataset.id); if (h) { h.hidden = !h.hidden; saveChat(); refreshAll(); } },
    del: (el) => {
        const st = C();
        const h = st.holidays.find((x) => x.id === el.dataset.id);
        if (!h || !confirm(`Delete “${h.name}”?`)) return;
        st.holidays = st.holidays.filter((x) => x.id !== h.id);
        delete st.celebrated[h.id];
        delete st.mentions[h.id];
        saveChat();
        refreshAll();
    },
    celebrate: (el) => { const st = C(); if (el.checked) st.celebrated[el.dataset.id] = true; else delete st.celebrated[el.dataset.id]; saveChat(); renderBody(); },
    scan: () => { scanChat(); renderBody(); window.toastr?.info('Chat scanned'); },
    setclock: () => {
        const cal = calendar(P());
        const g = (id) => parseInt(document.getElementById(id)?.value, 10) || 0;
        const m = mIdx(cal, g('hf_cd_m'));
        const t = toDay(cal, g('hf_cd_y'), m, dClamp(cal, m, g('hf_cd_d'))) * 1440 + clamp(g('hf_cd_h'), 0, 23) * 60 - Math.round(S().offset) * 1440;
        storeClock(t);
        refreshAll();
        toastToday();
    },
    advance: (el) => { storeClock(clockMinutes(false) + parseInt(el.dataset.n, 10) * 1440); refreshAll(); toastToday(); },
    ideas: async (el) => {
        const h = holidays().find((x) => x.id === el.dataset.id);
        if (!h) return;
        el.disabled = true;
        el.textContent = '⏳ Thinking…';
        try { ui.ideas[h.id] = await ideasFor(h); } catch { window.toastr?.error('Could not get ideas'); }
        renderBody();
    },
    'profile-new': () => {
        const s = S();
        const id = uid();
        s.profiles[id] = newProfile(id, 'New world');
        C().profileId = id;
        ui.editingProfile = null;
        saveSettingsDebounced(); saveChat(); refreshAll();
    },
    'profile-dup': () => {
        const s = S();
        const src = P();
        const id = uid();
        s.profiles[id] = { ...src, id, name: src.name + ' (copy)' };
        C().profileId = id;
        saveSettingsDebounced(); saveChat(); refreshAll();
    },
    'profile-del': () => {
        const s = S();
        const p = P();
        if (Object.keys(s.profiles).length < 2) return window.toastr?.warning('Keep at least one profile');
        if (!confirm(`Delete profile “${p.name}”?`)) return;
        delete s.profiles[p.id];
        if (s.defaultProfile === p.id) s.defaultProfile = Object.keys(s.profiles)[0];
        C().profileId = null;
        saveSettingsDebounced(); saveChat(); refreshAll();
    },
    'profile-export': () => download(`holiday-forge-${P().name.replace(/\W+/g, '_')}.json`, JSON.stringify({ hf: 1, profile: P(), holidays: holidays() }, null, 2)),
    'profile-import': () => document.getElementById('hf_import_file')?.click(),
};

async function importFile(file) {
    try {
        const data = JSON.parse(await file.text());
        const prof = data.profile || data;
        const s = S();
        const id = uid();
        s.profiles[id] = { ...newProfile(id, prof.name || 'Imported'), ...prof, id };
        C().profileId = id;
        if (Array.isArray(data.holidays) && data.holidays.length && confirm('Also import the holidays from this file into the current chat?')) {
            const list = data.holidays.map((h) => ({ ...h, id: uid() }));
            mergeGenerated(list);
        }
        saveSettingsDebounced(); saveChat(); scanChat(); refreshAll();
        window.toastr?.success('Profile imported');
    } catch {
        window.toastr?.error('Invalid profile file');
    }
}

/* ------------------------------------------------------------- panel mount */

function buildPanel() {
    if (document.getElementById('hf-overlay')) return;
    const o = document.createElement('div');
    o.id = 'hf-overlay';
    o.className = 'hf-hidden';
    o.innerHTML = `<div id="hf-sheet" role="dialog" aria-modal="true" aria-label="Holiday Forge">
        <div class="hf-grab"><span></span></div>
        <div class="hf-head"><div class="hf-title">🔨 Holiday Forge</div><div class="hf-date"></div>
            <button class="hf-x" data-hf="close" aria-label="Close">✕</button></div>
        <nav class="hf-tabs">${TABS.map(([k, i, l]) => `<button data-hf="tab" data-tab="${k}"><span>${i}</span>${l}</button>`).join('')}</nav>
        <div class="hf-body"></div></div>`;
    document.body.appendChild(o);

    o.addEventListener('click', (e) => {
        if (e.target === o) return closePanel();
        const el = e.target.closest('[data-hf]');
        if (!el || el.tagName === 'INPUT') return;
        actions[el.dataset.hf]?.(el);
    });
    o.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.hf === 'celebrate') return actions.celebrate(t);
        if (t.id === 'hf_profile_pick') { C().profileId = t.value; ui.editingProfile = null; saveChat(); return refreshAll(); }
        if (t.id === 'hf_import_file' && t.files[0]) { importFile(t.files[0]); t.value = ''; return; }
        if (t.dataset.p) {
            const prof = P();
            prof[t.dataset.p] = t.value;
            saveSettingsDebounced();
            if (['calendarType', 'months'].includes(t.dataset.p)) { scanChat(); refreshAll(); } else { if (t.dataset.p === 'name') renderBody(); refreshInjection(); }
            return;
        }
        if (t.dataset.set) {
            const s = S();
            const k = t.dataset.set;
            const keepClock = k === 'flow' || k === 'offset' ? clockMinutes(false) : null;
            s[k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (parseFloat(t.value) || 0) : t.value;
            if (keepClock !== null && hasChat()) storeClock(keepClock);
            saveSettingsDebounced();
            syncDrawer();
            refreshAll();
        }
    });

    // swipe-down on the grab handle / header closes the bottom sheet
    const sheet = o.querySelector('#hf-sheet');
    let y0 = null;
    sheet.querySelector('.hf-grab').addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    sheet.querySelector('.hf-grab').addEventListener('touchmove', (e) => {
        if (y0 === null) return;
        const dy = Math.max(0, e.touches[0].clientY - y0);
        sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheet.querySelector('.hf-grab').addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - (y0 ?? 0);
        sheet.style.transform = '';
        y0 = null;
        if (dy > 90) closePanel();
    });
    sheet.querySelector('.hf-grab').addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.open) closePanel(); });
}

function openPanel() {
    buildPanel();
    ui.open = true;
    document.getElementById('hf-overlay').classList.remove('hf-hidden');
    document.body.classList.add('hf-lock');
    if (hasChat()) { ensureClock(); scanChat(); }
    renderBody();
}

function closePanel() {
    ui.open = false;
    ui.editing = null;
    document.getElementById('hf-overlay')?.classList.add('hf-hidden');
    document.body.classList.remove('hf-lock');
}

/* ---------------------------------------------------------- extension drawer */

function mountDrawer() {
    if (document.getElementById('hf_drawer')) return;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (host) {
        const d = document.createElement('div');
        d.id = 'hf_drawer';
        d.className = 'extension_container';
        d.innerHTML = `<div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header"><b>🔨 Holiday Forge</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
            <div class="inline-drawer-content">
                <label class="checkbox_label"><input type="checkbox" id="hf_drawer_enabled"><span>Enabled</span></label>
                <div class="menu_button" id="hf_drawer_open"><i class="fa-solid fa-calendar-days"></i> Open Holiday Forge</div>
            </div></div>`;
        host.appendChild(d);
        d.querySelector('#hf_drawer_enabled').addEventListener('change', (e) => { S().enabled = e.target.checked; saveSettingsDebounced(); refreshAll(); });
        d.querySelector('#hf_drawer_open').addEventListener('click', openPanel);
        syncDrawer();
    }
    const menu = document.getElementById('extensionsMenu');
    if (menu && !document.getElementById('hf_wand')) {
        const w = document.createElement('div');
        w.id = 'hf_wand';
        w.className = 'list-group-item flex-container flexGap5';
        w.innerHTML = '<div class="fa-solid fa-calendar-days extensionsMenuExtensionButton"></div><span>Holiday Forge</span>';
        w.addEventListener('click', openPanel);
        menu.appendChild(w);
    }
}

function syncDrawer() {
    const c = document.getElementById('hf_drawer_enabled');
    if (c) c.checked = S().enabled;
}

/* -------------------------------------------------------------------- init */

async function onChat() {
    ui.editing = null;
    ui.ideas = {};
    if (!hasChat()) { renderStrip(); inj.text = ''; applyInjection(); renderBody(); return; }
    const st = C();
    ensureClock();
    scanChat();
    refreshAll();
    toastToday();
    const s = S();
    if (s.enabled && s.autoGenerate && st && !st.holidays.length && !st.autoDone && (getContext().chat || []).length > 0) {
        st.autoDone = true;
        saveChat();
        runGenerate('');
    }
}

function tick() {
    if (!hasChat() || !S().enabled) return;
    document.querySelectorAll('.hf-cd').forEach((el) => {
        el.innerHTML = cdTiles(+el.dataset.serial * 1440 - clockMinutes(true));
    });
    document.querySelectorAll('.hf-cd-inline').forEach((el) => {
        el.textContent = inlineCd(+el.dataset.serial * 1440 - clockMinutes(true));
    });
    if (S().flow > 0) { toastToday(); refreshInjection(); }
}

jQuery(async () => {
    S();
    mountDrawer();
    buildPanel();

    eventSource.on(event_types.APP_READY, () => { mountDrawer(); onChat(); });
    eventSource.on(event_types.CHAT_CHANGED, onChat);
    eventSource.on(event_types.MESSAGE_RECEIVED, () => { scheduleScan(); refreshInjection(); });
    eventSource.on(event_types.MESSAGE_SENT, () => { scheduleScan(); refreshInjection(); });
    eventSource.on(event_types.MESSAGE_DELETED, () => scheduleScan());
    eventSource.on(event_types.GENERATION_STARTED, async (type, _params, dryRun) => {
        if (type === 'quiet' || dryRun) return applyInjection();
        await refreshInjection();
    });

    setInterval(tick, 5000);
    onChat();
});

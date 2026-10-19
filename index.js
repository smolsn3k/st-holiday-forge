// Holiday Forge v1.1 — SillyTavern extension
// Generate, track and inject in-world holidays. Per-chat state, theme-adaptive, mobile-first, EN/RU.

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
const GREG_RU = [
    ['Январь', 'января'], ['Февраль', 'февраля'], ['Март', 'марта'], ['Апрель', 'апреля'], ['Май', 'мая'], ['Июнь', 'июня'],
    ['Июль', 'июля'], ['Август', 'августа'], ['Сентябрь', 'сентября'], ['Октябрь', 'октября'], ['Ноябрь', 'ноября'], ['Декабрь', 'декабря'],
];

const STYLE_PROMPTS = {
    balanced: 'Balanced mix of grand festivals and small everyday observances.',
    grounded: 'Realistic, grounded and culturally plausible; avoid anything over-the-top.',
    whimsical: 'Playful, colorful and imaginative, with quirky customs.',
    solemn: 'Serious, ceremonial and reverent in tone, with weighty traditions.',
};

const DEFAULTS = {
    enabled: true,
    lang: 'auto',
    genLang: 'chat',
    apiProfile: '',
    useLore: false,
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
    tracker: 'last',
    toast: true,
    autoGenerate: false,
    defaultProfile: 'default',
    profiles: {},
};

/* ------------------------------------------------------------------- i18n */

const L = {
    en: {
        tab_overview: 'Overview', tab_holidays: 'Holidays', tab_history: 'History', tab_profiles: 'Profiles', tab_settings: 'Settings',
        type_religious: 'religious', type_cultural: 'cultural', type_seasonal: 'seasonal', type_personal: 'personal',
        style_balanced: 'balanced', style_grounded: 'grounded', style_whimsical: 'whimsical', style_solemn: 'solemn',
        all: 'All', today: 'Today', tomorrow: 'Tomorrow', in_days: (n) => `in ${n}d`,
        u_days: 'days', u_hours: 'hours', u_min: 'min', s_d: 'd', s_h: 'h',
        no_holidays: 'No holidays in this chat yet.', gen_first: 'Generate holidays',
        scene_ideas: '💡 Scene ideas', thinking: '⏳ Thinking…', next3: 'Next 3', nothing_upcoming: 'Nothing upcoming.',
        clock: 'In-world date:', day: 'Day', month: 'Month', year: 'Year', hour: 'Hour',
        set_date: 'Set date', plus1: '+1 day', plus7: '+7 days',
        edit: '✏️ Edit', hide: '🙈 Hide', show: '👁️ Show', del: '🗑️ Delete', hidden: 'hidden',
        src_manual: '✍️ manual', src_generated: '✨ generated', src_lorebook: '📚 lorebook',
        traditions: 'Traditions', tone: 'Tone', description: 'Description',
        gen_h: '✨ Generate with LLM', gen_ph: 'Optional: e.g. harvest festivals, a holiday for the elves, something tied to the war…',
        count: 'Count', generate: '✨ Generate', generating: '⏳ Generating…', add_own: '➕ Add own', scan_lore: '📚 Scan lorebook',
        api_profile: 'API profile', api_current: 'Current connection', api_missing: 'Connection Manager extension not found or has no profiles.',
        nothing_here: 'Nothing here.', new_holiday: '➕ New holiday', edit_holiday: '✏️ Edit holiday',
        name: 'Name', year_opt: 'Year (optional, one-off)', type: 'Type', save: '💾 Save', cancel: 'Cancel',
        tone_ph: 'e.g. joyful, solemn', editor_note: 'Saved entries become manual and override generated ones with the same name.',
        scan_chat: '🔍 Scan chat',
        hist_note: 'Looks for holiday names in messages. A holiday counts as passed once it is mentioned and its in-world date is behind the current date, or when you mark it manually.',
        hist_empty: 'No celebrations on the timeline yet.', passed: 'passed', mentioned: 'mentioned', msg: 'msg', mark_cel: 'Mark as celebrated',
        prof_chat_h: '🌍 World profile for this chat', new: '➕ New', dup: '⧉ Duplicate', delete: '🗑️ Delete',
        edit_prof: (n) => `✏️ Edit “${n}”`, prof_name: 'Profile name', world_name: 'World name', faith: 'Faith system',
        faith_ph: 'e.g. Moon Church, ancestor worship', region: 'Region / culture', calendar: 'Calendar',
        cal_greg: 'Gregorian (12 months)', cal_custom: 'Custom', months_label: 'Months (Name:days, comma or newline separated)',
        months_ph: 'Frostmoon:30, Seedmoon:28, Sunpeak:31', rules: 'Custom rules',
        rules_ph: 'e.g. No holidays on the winter solstice; the empire bans religious festivals',
        export: '⬇️ Export JSON', import: '⬆️ Import JSON',
        s_gen: 'Generation', style: 'Style', per_gen: 'Holidays per generation', auto_gen: 'Auto-generate when a chat has no holidays',
        use_lore: 'Include lorebook (World Info) when generating',
        s_ai: 'Character awareness', enabled: 'Extension enabled', inject: 'Inject holidays into the prompt',
        budget: 'Token budget', depth: 'Injection depth', freq: 'Every N messages', lookahead: 'Look-ahead (days)', maxitems: 'Max holidays',
        s_disp: 'Dates & display', date_fmt: 'Date format', fmt_dmy: 'Day Month Year', fmt_mdy: 'Month Day, Year', fmt_ymd: 'Year Month Day',
        offset: 'Calendar offset (days)', flow: 'Time flow (in-world minutes per real minute, 0 = frozen)',
        strip_opt: 'Show next-holiday strip above the chat', toast_opt: '“Today is a holiday” toast',
        tracker_opt: 'Tracker inside chat messages', tr_last: 'last message only', tr_all: 'every character message', tr_off: 'off',
        s_lang: 'Language', lang_ui: 'Interface language', lang_auto: 'Auto', gen_lang: 'Generated text language', gl_chat: 'Match the chat',
        open_chat: 'Open a chat to use Holiday Forge.', drawer_enabled: 'Enabled', drawer_open: 'Open Holiday Forge',
        tr_closest: 'Closest holidays', tr_open: 'Open Holiday Forge',
        t_added: (n) => `Added ${n} holiday${n > 1 ? 's' : ''}`, t_nothing: 'Nothing new was added',
        t_fail: 'Generation failed or the reply was not valid JSON. Try again.', t_scanned: 'Chat scanned',
        t_name: 'Give it a name', t_lore_none: 'No usable lorebook entries found', t_invalid: 'Invalid profile file',
        t_imported: 'Profile imported', t_keep1: 'Keep at least one profile', t_ideas_fail: 'Could not get ideas',
        t_api_missing: 'API profile not found, using the current connection',
        c_del: (n) => `Delete “${n}”?`, c_prof: (n) => `Delete profile “${n}”?`, c_imp: 'Also import the holidays from this file into the current chat?',
        t_today: '🎉 Today is a holiday',
        gl_line: { chat: 'Write all names and text in the same language as the roleplay (chat and character card).', en: 'Write all names and text in English.', ru: 'Write all names and text in Russian.' },
    },
    ru: {
        tab_overview: 'Обзор', tab_holidays: 'Праздники', tab_history: 'История', tab_profiles: 'Профили', tab_settings: 'Настройки',
        type_religious: 'религиозный', type_cultural: 'культурный', type_seasonal: 'сезонный', type_personal: 'личный',
        style_balanced: 'сбалансированный', style_grounded: 'реалистичный', style_whimsical: 'причудливый', style_solemn: 'торжественный',
        all: 'Все', today: 'Сегодня', tomorrow: 'Завтра', in_days: (n) => `через ${n} дн.`,
        u_days: 'дней', u_hours: 'часов', u_min: 'мин', s_d: 'д', s_h: 'ч',
        no_holidays: 'В этом чате пока нет праздников.', gen_first: 'Сгенерировать праздники',
        scene_ideas: '💡 Идеи для сцен', thinking: '⏳ Думаю…', next3: 'Ближайшие 3', nothing_upcoming: 'Ничего не намечается.',
        clock: 'Дата в мире:', day: 'День', month: 'Месяц', year: 'Год', hour: 'Час',
        set_date: 'Установить дату', plus1: '+1 день', plus7: '+7 дней',
        edit: '✏️ Изменить', hide: '🙈 Скрыть', show: '👁️ Показать', del: '🗑️ Удалить', hidden: 'скрыт',
        src_manual: '✍️ вручную', src_generated: '✨ сгенерирован', src_lorebook: '📚 лорбук',
        traditions: 'Традиции', tone: 'Тон', description: 'Описание',
        gen_h: '✨ Генерация через LLM', gen_ph: 'Необязательно: например, праздники урожая, праздник эльфов, что-то связанное с войной…',
        count: 'Кол-во', generate: '✨ Сгенерировать', generating: '⏳ Генерация…', add_own: '➕ Свой праздник', scan_lore: '📚 Скан лорбука',
        api_profile: 'API-профиль', api_current: 'Текущее подключение', api_missing: 'Расширение Connection Manager не найдено или в нём нет профилей.',
        nothing_here: 'Здесь пусто.', new_holiday: '➕ Новый праздник', edit_holiday: '✏️ Изменить праздник',
        name: 'Название', year_opt: 'Год (необязательно, разовый)', type: 'Тип', save: '💾 Сохранить', cancel: 'Отмена',
        tone_ph: 'например, радостный, торжественный', editor_note: 'Сохранённые записи становятся ручными и заменяют сгенерированные с тем же названием.',
        scan_chat: '🔍 Сканировать чат',
        hist_note: 'Ищет названия праздников в сообщениях. Праздник считается прошедшим, если он упомянут и его внутримировая дата уже позади, либо если вы отметили его вручную.',
        hist_empty: 'В хронологии пока нет праздников.', passed: 'прошёл', mentioned: 'упомянут', msg: 'сообщ.', mark_cel: 'Отметить как отпразднованный',
        prof_chat_h: '🌍 Профиль мира для этого чата', new: '➕ Новый', dup: '⧉ Дублировать', delete: '🗑️ Удалить',
        edit_prof: (n) => `✏️ Редактирование «${n}»`, prof_name: 'Название профиля', world_name: 'Название мира', faith: 'Система верований',
        faith_ph: 'например, Лунная церковь, культ предков', region: 'Регион / культура', calendar: 'Календарь',
        cal_greg: 'Григорианский (12 месяцев)', cal_custom: 'Свой', months_label: 'Месяцы (Название:дней, через запятую или с новой строки)',
        months_ph: 'Морозень:30, Сеяние:28, Солнцепик:31', rules: 'Свои правила',
        rules_ph: 'например, нет праздников в зимнее солнцестояние; империя запрещает религиозные обряды',
        export: '⬇️ Экспорт JSON', import: '⬆️ Импорт JSON',
        s_gen: 'Генерация', style: 'Стиль', per_gen: 'Праздников за раз', auto_gen: 'Автогенерация, если в чате нет праздников',
        use_lore: 'Учитывать лорбук (World Info) при генерации',
        s_ai: 'Осведомлённость персонажей', enabled: 'Расширение включено', inject: 'Добавлять праздники в промпт',
        budget: 'Лимит токенов', depth: 'Глубина вставки', freq: 'Каждые N сообщений', lookahead: 'Горизонт (дней)', maxitems: 'Макс. праздников',
        s_disp: 'Даты и отображение', date_fmt: 'Формат даты', fmt_dmy: 'День Месяц Год', fmt_mdy: 'Месяц День, Год', fmt_ymd: 'Год Месяц День',
        offset: 'Смещение календаря (дней)', flow: 'Ход времени (минут в мире за реальную минуту, 0 = стоит)',
        strip_opt: 'Полоса с ближайшим праздником над чатом', toast_opt: 'Уведомление «Сегодня праздник»',
        tracker_opt: 'Трекер внутри сообщений чата', tr_last: 'только последнее сообщение', tr_all: 'каждое сообщение персонажа', tr_off: 'выкл.',
        s_lang: 'Язык', lang_ui: 'Язык интерфейса', lang_auto: 'Авто', gen_lang: 'Язык сгенерированного текста', gl_chat: 'Как в чате',
        open_chat: 'Откройте чат, чтобы пользоваться Holiday Forge.', drawer_enabled: 'Включено', drawer_open: 'Открыть Holiday Forge',
        tr_closest: 'Ближайшие праздники', tr_open: 'Открыть Holiday Forge',
        t_added: (n) => `Добавлено праздников: ${n}`, t_nothing: 'Ничего нового не добавлено',
        t_fail: 'Не удалось сгенерировать или ответ не в формате JSON. Попробуйте ещё раз.', t_scanned: 'Чат просканирован',
        t_name: 'Укажите название', t_lore_none: 'Подходящих записей лорбука не найдено', t_invalid: 'Неверный файл профиля',
        t_imported: 'Профиль импортирован', t_keep1: 'Нужен хотя бы один профиль', t_ideas_fail: 'Не удалось получить идеи',
        t_api_missing: 'API-профиль не найден, используется текущее подключение',
        c_del: (n) => `Удалить «${n}»?`, c_prof: (n) => `Удалить профиль «${n}»?`, c_imp: 'Импортировать также праздники из файла в текущий чат?',
        t_today: '🎉 Сегодня праздник',
        gl_line: { chat: 'Write all names and text in the same language as the roleplay (chat and character card).', en: 'Write all names and text in English.', ru: 'Write all names and text in Russian.' },
    },
};

function lang() {
    const v = extension_settings[MODULE]?.lang;
    if (v === 'en' || v === 'ru') return v;
    const ui = (localStorage.getItem('language') || navigator.language || 'en').toLowerCase();
    return ui.startsWith('ru') ? 'ru' : 'en';
}

function t(k, ...a) {
    const v = L[lang()][k] ?? L.en[k] ?? k;
    return typeof v === 'function' ? v(...a) : v;
}

/* ------------------------------------------------------------------ state */

const ui = { tab: 'overview', editing: null, editingProfile: null, busy: false, filter: 'all', ideas: {}, open: false, trackerOpen: false };
const inj = { text: '' };
let scanTimer = null;
let obsTimer = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => `hf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function S() {
    const s = (extension_settings[MODULE] ??= {});
    for (const k of Object.keys(DEFAULTS)) {
        if (!(k in s)) s[k] = structuredClone(DEFAULTS[k]);
    }
    if (!Object.keys(s.profiles).length) s.profiles.default = newProfile('default', 'Default world');
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
    return s.profiles[C()?.profileId] || s.profiles[s.defaultProfile];
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
    const ru = lang() === 'ru';
    return GREGORIAN.map(([name, days], i) => ({ name: ru ? GREG_RU[i][0] : name, gen: ru ? GREG_RU[i][1] : undefined, days }));
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
    const L2 = yearLen(cal);
    const y = Math.floor(s / L2);
    let r = s - y * L2;
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
    let m = toDay(cal, c.y, c.m, c.d) * 1440 + c.h * 60 + c.min;
    if (s.flow > 0) m += Math.floor(((Date.now() - c.anchor) / 60000) * s.flow);
    if (withOffset) m += Math.round(s.offset) * 1440;
    return m;
}

function storeClock(total) {
    const cal = calendar(P());
    const day = Math.floor(total / 1440);
    const rem = total - day * 1440;
    C().clock = { ...fromDay(cal, day), h: Math.floor(rem / 60), min: rem % 60, anchor: Date.now() };
    saveChat();
}

function nowParts() {
    const cal = calendar(P());
    const total = clockMinutes(true);
    const day = Math.floor(total / 1440);
    const rem = total - day * 1440;
    return { cal, total, day, h: Math.floor(rem / 60), min: rem % 60, ...fromDay(cal, day) };
}

function fmtMD(cal, m, d) {
    const c = cal[mIdx(cal, m) - 1];
    return S().dateFormat === 'DMY' ? `${d} ${c.gen || c.name}` : `${c.name} ${d}`;
}

function fmtDate(cal, y, m, d) {
    const c = cal[mIdx(cal, m) - 1];
    switch (S().dateFormat) {
        case 'MDY': return `${c.name} ${d}, ${y}`;
        case 'YMD': return `${y} ${c.name} ${d}`;
        default: return `${d} ${c.gen || c.name} ${y}`;
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
    const { total, day } = nowParts();
    const { cal } = nowParts();
    return visible()
        .map((h) => {
            const serial = occurrence(cal, h, day);
            return { h, serial, delta: serial - day, mins: serial * 1440 - total };
        })
        .filter((x) => x.delta >= 0)
        .sort((a, b) => a.serial - b.serial);
}

function mergeGenerated(list) {
    const st = C();
    const known = new Set(st.holidays.map((h) => h.name.toLowerCase())); // manual entries always win, no dupes
    let added = 0;
    for (const h of list) {
        const key = h.name.toLowerCase();
        if (known.has(key)) continue;
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
            rec.snippet = m.mes.slice(Math.max(0, hit.index - 40), hit.index + h.name.length + 60).replace(/\s+/g, ' ').trim();
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
    } catch { /* fall through */ }
    return Math.ceil(text.length / 3.6);
}

async function buildInjection() {
    const s = S();
    if (!s.enabled || !s.inject || !hasChat() || !C() || !visible().length) return '';
    const { cal, y, m, d } = nowParts();
    const list = upcoming().filter((x) => x.delta <= s.window).slice(0, Math.max(1, s.maxItems));
    if (!list.length) return '';
    const short = (x, n) => (x && x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x || '');
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
        lines.splice(lines.length - 2, 1);
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

/* ------------------------------------------- lorebook, API profiles, LLM */

function profiles() {
    const cm = getContext().extensionSettings?.connectionManager || extension_settings.connectionManager;
    return Array.isArray(cm?.profiles) ? cm.profiles : [];
}

const HOLIDAY_RE = /holiday|festival|feast|celebrat|ritual|ceremon|solstice|equinox|harvest|carnival|fest\b|day of|eve\b|праздн|фестивал|торжеств|ритуал|обряд|церемон|солнцестоян|равноденств|урожа|карнавал|день\s/i;

async function collectLore() {
    const ctx = getContext();
    const wi = await import('../../../world-info.js');
    const names = new Set(wi.selected_world_info || []);
    const ch = ctx.characters?.[ctx.characterId];
    const linked = ch?.data?.extensions?.world;
    if (linked) names.add(linked);
    const chatBook = ctx.chatMetadata?.[wi.METADATA_KEY || 'world_info'];
    if (chatBook) names.add(chatBook);
    const file = ch?.avatar?.replace(/\.[^/.]+$/, '');
    const extra = wi.world_info?.charLore?.find((e) => e.name === file);
    (extra?.extraBooks || []).forEach((n) => names.add(n));

    const entries = [];
    for (const n of names) {
        try {
            const data = await wi.loadWorldInfo(n);
            Object.values(data?.entries || {}).forEach((e) => { if (!e.disable) entries.push(e); });
        } catch (e) { console.warn('[Holiday Forge] lorebook load failed', n, e); }
    }
    (ch?.data?.character_book?.entries || []).forEach((e) => { if (e.enabled !== false) entries.push({ comment: e.comment, key: e.keys, content: e.content }); });

    const fmt = (e) => `${e.comment || (e.key || []).join(', ')}: ${String(e.content || '').replace(/\s+/g, ' ').trim()}`;
    let pool = entries.filter((e) => HOLIDAY_RE.test(`${e.comment || ''} ${(e.key || []).join(' ')} ${e.content || ''}`));
    if (!pool.length) pool = entries;
    let text = '';
    for (const e of pool) {
        const line = fmt(e).slice(0, 900);
        if (text.length + line.length > 7000) break;
        text += line + '\n';
    }
    return { text: text.trim(), count: pool.length, books: [...names] };
}

function contextBlock() {
    const ctx = getContext();
    const cut = (x, n) => String(x || '').slice(0, n);
    const parts = [];
    const ch = ctx.characters?.[ctx.characterId];
    if (ch) parts.push(`Character: ${ch.name}\n${cut(ch.description, 1500)}\n${cut(ch.personality, 600)}\n${cut(ch.scenario, 800)}`.trim());
    const persona = ctx.powerUserSettings?.persona_description;
    if (persona) parts.push(`User persona (${ctx.name1}): ${cut(persona, 800)}`);
    const tail = (ctx.chat || []).filter((m) => m && !m.is_system && m.mes).slice(-10)
        .map((m) => `${m.name}: ${cut(m.mes, 500)}`).join('\n');
    if (tail) parts.push(`Recent chat:\n${tail}`);
    return parts.join('\n\n');
}

async function quiet(prompt, maxTokens = 1800) {
    const s = S();
    const ctx = getContext();
    if (s.apiProfile) {
        const prof = profiles().find((p) => p.id === s.apiProfile);
        const svc = ctx.ConnectionManagerRequestService;
        if (prof && svc) {
            const messages = [
                { role: 'system', content: `You assist with a roleplay world. Use this context as the source of truth.\n\n${contextBlock()}` },
                { role: 'user', content: prompt },
            ];
            const res = await svc.sendRequest(prof.id, messages, maxTokens, { stream: false, extractData: true, includePreset: true, includeInstruct: true }, {});
            return String(res?.content ?? res ?? '');
        }
        window.toastr?.warning(t('t_api_missing'));
    }
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
    let x = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
    const a = x.indexOf('[');
    const b = x.lastIndexOf(']');
    if (a >= 0 && b > a) x = x.slice(a, b + 1);
    const data = JSON.parse(x);
    return Array.isArray(data) ? data : data.holidays || [];
}

function profileBlock(p, cal) {
    return [
        `- World: ${p.world || 'infer from the character card / world info'}`,
        `- Faith / belief system: ${p.faith || 'infer from context'}`,
        `- Region / culture: ${p.region || 'infer from context'}`,
        `- Calendar: ${p.calendarType === 'custom' ? 'custom' : 'Gregorian'}; months numbered ${cal.map((m, i) => `${i + 1}=${m.name}(${m.days}d)`).join(', ')}`,
        p.rules ? `- Custom rules: ${p.rules}` : '',
    ].filter(Boolean).join('\n');
}

function normalize(list, cal, source) {
    return list
        .filter((x) => x && x.name)
        .map((x) => {
            let month = x.month;
            if (typeof month === 'string' && isNaN(+month)) {
                const q = month.trim().toLowerCase();
                const i = cal.findIndex((c) => c.name.toLowerCase() === q || (c.gen && c.gen.toLowerCase() === q));
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
                source,
                hidden: false,
            };
        });
}

const JSON_SHAPE = (cal) => `Return ONLY a valid JSON array. No markdown, no commentary. Each item:
{"name":"","month":<number 1-${cal.length}>,"day":<number>,"type":"religious|cultural|seasonal|personal","description":"1-2 sentences","traditions":"1-3 short customs","tone":"2-3 words"}
Keep the "type" value in English. ${t('gl_line')[S().genLang] || t('gl_line').chat}`;

async function generate(userPrompt) {
    const s = S();
    const p = P();
    const cal = calendar(p);
    const existing = holidays().map((h) => h.name).join('; ') || 'none';
    let lore = '';
    if (s.useLore) {
        try { lore = (await collectLore()).text; } catch (e) { console.warn('[Holiday Forge] lore', e); }
    }
    const prompt = `[OOC SYSTEM TASK — pause the roleplay. Do not write story text or dialogue.]
Invent ${s.count} holidays / celebrations for this roleplay world. Treat the character card, world info and chat so far as the source of truth.
World profile:
${profileBlock(p, cal)}
Style: ${STYLE_PROMPTS[s.style] || STYLE_PROMPTS.balanced}
User request: ${userPrompt || 'none, use your judgement'}
Already existing (do not duplicate): ${existing}
${lore ? `Lorebook excerpts:\n${lore}\n` : ''}${JSON_SHAPE(cal)}`;
    const raw = await quiet(prompt);
    return mergeGenerated(normalize(parseJsonList(raw), cal, 'generated'));
}

async function scanLorebook() {
    const p = P();
    const cal = calendar(p);
    const lore = await collectLore();
    if (!lore.text) return -1;
    const existing = holidays().map((h) => h.name).join('; ') || 'none';
    const prompt = `[OOC SYSTEM TASK — pause the roleplay. Do not write story text.]
Below are lorebook (World Info) entries of this roleplay world. Extract every holiday, festival, ritual day or celebration that they mention or clearly imply. Use their dates if given; otherwise choose a fitting date for the calendar. Do not invent unrelated holidays.
World profile:
${profileBlock(p, cal)}
Already existing (skip these): ${existing}
Lorebook entries:
${lore.text}

${JSON_SHAPE(cal)}
If nothing is found, return [].`;
    const raw = await quiet(prompt);
    return mergeGenerated(normalize(parseJsonList(raw), cal, 'lorebook'));
}

async function ideasFor(h) {
    const p = P();
    const prompt = `[OOC SYSTEM TASK — pause the roleplay. Do not write story text.]
Suggest 3 short, concrete scene ideas (one sentence each, as a bullet list) for how the characters could spend "${h.name}" (${h.type}: ${h.description}) in this roleplay. Use the characters, setting and current mood of the chat. World: ${p.world || 'see context'}; faith: ${p.faith || 'see context'}. ${t('gl_line')[S().genLang] || t('gl_line').chat}`;
    return (await quiet(prompt, 600)).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/* ------------------------------------------------------------------- html */

const typeChip = (ty) => `<span class="hf-chip" style="--c:${TYPES[ty]?.color || '#999'}">${TYPES[ty]?.icon || '✨'} ${esc(t('type_' + ty))}</span>`;
const srcLabel = (h) => t('src_' + (h.source || 'generated'));

function cdTiles(totalMin) {
    const m = Math.max(0, totalMin);
    const tile = (n, l) => `<div class="hf-tile"><b>${n}</b><span>${l}</span></div>`;
    return tile(Math.floor(m / 1440), t('u_days')) + tile(Math.floor((m % 1440) / 60), t('u_hours')) + tile(m % 60, t('u_min'));
}

function inlineCd(mins) {
    const m = Math.max(0, mins);
    return `${Math.floor(m / 1440)}${t('s_d')} ${Math.floor((m % 1440) / 60)}${t('s_h')}`;
}

function whenLabel(delta) {
    return delta === 0 ? t('today') : delta === 1 ? t('tomorrow') : t('in_days', delta);
}

function miniRow(x, cal) {
    const h = x.h;
    return `<div class="hf-row" style="--c:${TYPES[h.type]?.color}">
        <div class="hf-ico">${TYPES[h.type]?.icon || '✨'}</div>
        <div class="hf-grow"><div class="hf-name">${esc(h.name)}</div><div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))}</div></div>
        <div class="hf-when ${x.delta === 0 ? 'now' : ''}">${whenLabel(x.delta)}</div></div>`;
}

function apiSelect() {
    const s = S();
    const ps = profiles();
    const ok = !!getContext().ConnectionManagerRequestService && ps.length > 0;
    return `<label>${t('api_profile')}<select class="text_pole" data-set="apiProfile" ${ok ? '' : 'disabled'}>
        <option value="">${t('api_current')}</option>
        ${ps.map((p) => `<option value="${esc(p.id)}" ${s.apiProfile === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        ${ok ? '' : `<small>${t('api_missing')}</small>`}</label>`;
}

function viewOverview() {
    const np = nowParts();
    const list = upcoming();
    const today = list.filter((x) => x.delta === 0);
    const next = list.find((x) => x.delta > 0);
    let html = '';
    if (!visible().length) {
        html += `<div class="hf-empty"><div class="hf-bigico">🎆</div><p>${t('no_holidays')}</p>
            <button class="hf-btn primary" data-hf="goto" data-tab="holidays">${t('gen_first')}</button></div>`;
    } else {
        for (const x of today) {
            html += `<div class="hf-today" style="--c:${TYPES[x.h.type]?.color}"><div class="hf-today-h">🎉 ${t('today')} — ${esc(x.h.name)}</div>
                <div class="hf-sub">${esc(x.h.description)}</div>${x.h.traditions ? `<div class="hf-sub"><b>${t('traditions')}:</b> ${esc(x.h.traditions)}</div>` : ''}
                <button class="hf-btn small" data-hf="ideas" data-id="${x.h.id}">${t('scene_ideas')}</button>
                <div class="hf-ideas">${esc(ui.ideas[x.h.id] || '')}</div></div>`;
        }
        if (next) {
            html += `<div class="hf-hero" style="--c:${TYPES[next.h.type]?.color}">
                <div class="hf-hero-top">${typeChip(next.h.type)}<span class="hf-sub">${esc(fmtMD(np.cal, next.h.month, next.h.day))}</span></div>
                <div class="hf-hero-name">${esc(next.h.name)}</div>
                <div class="hf-cd" data-serial="${next.serial}">${cdTiles(next.mins)}</div>
                <div class="hf-sub">${esc(next.h.description)}</div>
                <button class="hf-btn small" data-hf="ideas" data-id="${next.h.id}">${t('scene_ideas')}</button>
                <div class="hf-ideas">${esc(ui.ideas[next.h.id] || '')}</div></div>`;
        }
        html += `<div class="hf-h">${t('next3')}</div><div class="hf-card">${list.slice(0, 3).map((x) => miniRow(x, np.cal)).join('') || `<div class="hf-sub">${t('nothing_upcoming')}</div>`}</div>`;
    }
    const monthOpts = np.cal.map((m, i) => `<option value="${i + 1}" ${i + 1 === np.m ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    html += `<details class="hf-card hf-clock"><summary>🕰️ ${t('clock')} <b>&nbsp;${esc(fmtDate(np.cal, np.y, np.m, np.d))}</b>, ${String(np.h).padStart(2, '0')}:${String(np.min).padStart(2, '0')}</summary>
        <div class="hf-grid">
            <label>${t('day')}<input class="text_pole" type="number" id="hf_cd_d" value="${np.d}" min="1"></label>
            <label>${t('month')}<select class="text_pole" id="hf_cd_m">${monthOpts}</select></label>
            <label>${t('year')}<input class="text_pole" type="number" id="hf_cd_y" value="${np.y}"></label>
            <label>${t('hour')}<input class="text_pole" type="number" id="hf_cd_h" value="${np.h}" min="0" max="23"></label>
        </div>
        <div class="hf-actions">
            <button class="hf-btn primary" data-hf="setclock">${t('set_date')}</button>
            <button class="hf-btn" data-hf="advance" data-n="1">${t('plus1')}</button>
            <button class="hf-btn" data-hf="advance" data-n="7">${t('plus7')}</button>
        </div></details>`;
    return html;
}

function holidayCard(h, cal) {
    const mention = C().mentions[h.id];
    return `<details class="hf-hcard" style="--c:${TYPES[h.type]?.color}">
        <summary><div class="hf-ico">${TYPES[h.type]?.icon || '✨'}</div>
            <div class="hf-grow"><div class="hf-name">${esc(h.name)} ${h.hidden ? `<span class="hf-badge">${t('hidden')}</span>` : ''}</div>
            <div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))}${h.year ? ' ' + esc(h.year) : ''} · ${srcLabel(h)}${mention ? ` · 💬 ×${mention.count}` : ''}</div></div>
            ${typeChip(h.type)}</summary>
        <div class="hf-hbody">
            ${h.description ? `<p>${esc(h.description)}</p>` : ''}
            ${h.traditions ? `<p><b>${t('traditions')}:</b> ${esc(h.traditions)}</p>` : ''}
            ${h.tone ? `<p><b>${t('tone')}:</b> ${esc(h.tone)}</p>` : ''}
            <div class="hf-actions">
                <button class="hf-btn small" data-hf="edit" data-id="${h.id}">${t('edit')}</button>
                <button class="hf-btn small" data-hf="hide" data-id="${h.id}">${h.hidden ? t('show') : t('hide')}</button>
                <button class="hf-btn small danger" data-hf="del" data-id="${h.id}">${t('del')}</button>
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
    const dis = ui.busy ? 'disabled' : '';
    return `<div class="hf-card">
            <div class="hf-h">${t('gen_h')}</div>
            <textarea class="text_pole" id="hf_gen_prompt" rows="2" placeholder="${esc(t('gen_ph'))}"></textarea>
            ${apiSelect()}
            <label class="checkbox_label"><input type="checkbox" data-set="useLore" ${s.useLore ? 'checked' : ''}><span>${t('use_lore')}</span></label>
            <div class="hf-actions">
                <label class="hf-inline">${t('count')} <input class="text_pole hf-num" type="number" id="hf_gen_count" min="1" max="20" value="${s.count}"></label>
                <button class="hf-btn primary" data-hf="generate" ${dis}>${ui.busy ? t('generating') : t('generate')}</button>
            </div>
            <div class="hf-actions">
                <button class="hf-btn" data-hf="lore-scan" ${dis}>${t('scan_lore')}</button>
                <button class="hf-btn" data-hf="add">${t('add_own')}</button>
            </div></div>
        <div class="hf-filters">${filters.map((f) => `<button class="hf-pill ${ui.filter === f ? 'on' : ''}" data-hf="filter" data-f="${f}">${f === 'all' ? t('all') : TYPES[f].icon + ' ' + t('type_' + f)}</button>`).join('')}</div>
        ${list.map((h) => holidayCard(h, cal)).join('') || `<div class="hf-empty"><p>${t('nothing_here')}</p></div>`}`;
}

function viewEditor(cal) {
    const h = ui.editing === 'new'
        ? { name: '', month: 1, day: 1, year: '', type: 'cultural', description: '', traditions: '', tone: '' }
        : holidays().find((x) => x.id === ui.editing) || {};
    return `<div class="hf-card"><div class="hf-h">${ui.editing === 'new' ? t('new_holiday') : t('edit_holiday')}</div>
        <label>${t('name')}<input class="text_pole" id="hf_e_name" value="${esc(h.name)}"></label>
        <div class="hf-grid">
            <label>${t('month')}<select class="text_pole" id="hf_e_month">${cal.map((m, i) => `<option value="${i + 1}" ${+h.month === i + 1 ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
            <label>${t('day')}<input class="text_pole" type="number" id="hf_e_day" min="1" value="${h.day}"></label>
            <label>${t('year_opt')}<input class="text_pole" type="number" id="hf_e_year" value="${h.year ?? ''}"></label>
            <label>${t('type')}<select class="text_pole" id="hf_e_type">${Object.keys(TYPES).map((ty) => `<option value="${ty}" ${h.type === ty ? 'selected' : ''}>${esc(t('type_' + ty))}</option>`).join('')}</select></label>
        </div>
        <label>${t('tone')}<input class="text_pole" id="hf_e_tone" value="${esc(h.tone)}" placeholder="${esc(t('tone_ph'))}"></label>
        <label>${t('description')}<textarea class="text_pole" id="hf_e_desc" rows="3">${esc(h.description)}</textarea></label>
        <label>${t('traditions')}<textarea class="text_pole" id="hf_e_trad" rows="3">${esc(h.traditions)}</textarea></label>
        <div class="hf-actions"><button class="hf-btn primary" data-hf="save-holiday">${t('save')}</button><button class="hf-btn" data-hf="cancel-edit">${t('cancel')}</button></div>
        <div class="hf-sub">${t('editor_note')}</div></div>`;
}

function viewHistory() {
    const { cal } = nowParts();
    const st = C();
    const items = visible()
        .filter((h) => isPassed(h) || st.mentions[h.id])
        .map((h) => ({ h, m: st.mentions[h.id], passed: isPassed(h) }))
        .sort((a, b) => (a.m?.last ?? 1e9) - (b.m?.last ?? 1e9));
    let html = `<div class="hf-actions"><button class="hf-btn primary" data-hf="scan">${t('scan_chat')}</button></div><div class="hf-sub">${t('hist_note')}</div>`;
    if (!items.length) return html + `<div class="hf-empty"><div class="hf-bigico">📜</div><p>${t('hist_empty')}</p></div>`;
    html += '<div class="hf-timeline">';
    for (const { h, m, passed } of items) {
        html += `<div class="hf-tl ${passed ? 'done' : ''}" style="--c:${TYPES[h.type]?.color}">
            <div class="hf-dot"></div>
            <div class="hf-tl-body"><div class="hf-name">${TYPES[h.type]?.icon} ${esc(h.name)} <span class="hf-badge">${passed ? t('passed') : t('mentioned')}</span></div>
            <div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))}${m ? ` · ${t('msg')} #${m.first}${m.count > 1 ? `–#${m.last}` : ''} · ×${m.count}` : ''}</div>
            ${m?.snippet ? `<div class="hf-quote">…${esc(m.snippet)}…</div>` : ''}
            <label class="checkbox_label"><input type="checkbox" data-hf="celebrate" data-id="${h.id}" ${st.celebrated[h.id] ? 'checked' : ''}><span>${t('mark_cel')}</span></label></div></div>`;
    }
    return html + '</div>';
}

function viewProfiles() {
    const s = S();
    const activeId = C()?.profileId || s.defaultProfile;
    const ids = Object.keys(s.profiles);
    const ep = s.profiles[ui.editingProfile || activeId];
    return `<div class="hf-card"><div class="hf-h">${t('prof_chat_h')}</div>
        <select class="text_pole" id="hf_profile_pick">${ids.map((id) => `<option value="${id}" ${id === activeId ? 'selected' : ''}>${esc(s.profiles[id].name)}</option>`).join('')}</select>
        <div class="hf-actions"><button class="hf-btn" data-hf="profile-new">${t('new')}</button><button class="hf-btn" data-hf="profile-dup">${t('dup')}</button><button class="hf-btn danger" data-hf="profile-del">${t('delete')}</button></div></div>
        <div class="hf-card"><div class="hf-h">${t('edit_prof', esc(ep.name))}</div>
        <label>${t('prof_name')}<input class="text_pole" data-p="name" value="${esc(ep.name)}"></label>
        <label>${t('world_name')}<input class="text_pole" data-p="world" value="${esc(ep.world)}"></label>
        <label>${t('faith')}<input class="text_pole" data-p="faith" value="${esc(ep.faith)}" placeholder="${esc(t('faith_ph'))}"></label>
        <label>${t('region')}<input class="text_pole" data-p="region" value="${esc(ep.region)}"></label>
        <label>${t('calendar')}<select class="text_pole" data-p="calendarType"><option value="gregorian" ${ep.calendarType === 'gregorian' ? 'selected' : ''}>${t('cal_greg')}</option><option value="custom" ${ep.calendarType === 'custom' ? 'selected' : ''}>${t('cal_custom')}</option></select></label>
        ${ep.calendarType === 'custom' ? `<label>${t('months_label')}<textarea class="text_pole" rows="3" data-p="months" placeholder="${esc(t('months_ph'))}">${esc(ep.months)}</textarea></label>` : ''}
        <label>${t('rules')}<textarea class="text_pole" rows="3" data-p="rules" placeholder="${esc(t('rules_ph'))}">${esc(ep.rules)}</textarea></label>
        <div class="hf-actions"><button class="hf-btn" data-hf="profile-export">${t('export')}</button><button class="hf-btn" data-hf="profile-import">${t('import')}</button></div>
        <input type="file" id="hf_import_file" accept=".json,application/json" hidden></div>`;
}

function viewSettings() {
    const s = S();
    const chk = (k, l) => `<label class="checkbox_label"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}><span>${l}</span></label>`;
    const num = (k, l, min, max, step = 1) => `<label>${l}<input class="text_pole" type="number" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"></label>`;
    const sel = (k, l, opts) => `<label>${l}<select class="text_pole" data-set="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(s[k]) === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    return `<div class="hf-card"><div class="hf-h">${t('s_lang')}</div>
            ${sel('lang', t('lang_ui'), [['auto', t('lang_auto')], ['en', 'English'], ['ru', 'Русский']])}
            ${sel('genLang', t('gen_lang'), [['chat', t('gl_chat')], ['en', 'English'], ['ru', 'Русский']])}</div>
        <div class="hf-card"><div class="hf-h">${t('s_gen')}</div>
            ${apiSelect()}
            ${sel('style', t('style'), Object.keys(STYLE_PROMPTS).map((k) => [k, t('style_' + k)]))}
            ${num('count', t('per_gen'), 1, 20)}
            ${chk('useLore', t('use_lore'))}
            ${chk('autoGenerate', t('auto_gen'))}</div>
        <div class="hf-card"><div class="hf-h">${t('s_ai')}</div>
            ${chk('enabled', t('enabled'))}
            ${chk('inject', t('inject'))}
            <div class="hf-grid">${num('tokenBudget', t('budget'), 40, 1500, 10)}${num('depth', t('depth'), 0, 20)}${num('frequency', t('freq'), 1, 20)}${num('window', t('lookahead'), 1, 365)}${num('maxItems', t('maxitems'), 1, 10)}</div></div>
        <div class="hf-card"><div class="hf-h">${t('s_disp')}</div>
            ${sel('dateFormat', t('date_fmt'), [['DMY', t('fmt_dmy')], ['MDY', t('fmt_mdy')], ['YMD', t('fmt_ymd')]])}
            ${num('offset', t('offset'), -3650, 3650)}
            ${num('flow', t('flow'), 0, 1440)}
            ${sel('tracker', t('tracker_opt'), [['last', t('tr_last')], ['all', t('tr_all')], ['off', t('tr_off')]])}
            ${chk('strip', t('strip_opt'))}
            ${chk('toast', t('toast_opt'))}</div>`;
}

const TABS = [['overview', '🏠'], ['holidays', '📅'], ['history', '📜'], ['profiles', '🌍'], ['settings', '⚙️']];

function renderBody() {
    if (!ui.open) return;
    const body = document.querySelector('#hf-sheet .hf-body');
    if (!body) return;
    const scroll = body.scrollTop;
    if (!hasChat()) {
        body.innerHTML = `<div class="hf-empty"><div class="hf-bigico">💬</div><p>${t('open_chat')}</p></div>`;
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
    if (today) el.innerHTML = `🎉 <b>${t('today')}:</b> ${esc(today.h.name)}`;
    else if (next) el.innerHTML = `${TYPES[next.h.type]?.icon} <b>${esc(next.h.name)}</b> <span class="hf-cd-inline" data-serial="${next.serial}">${inlineCd(next.mins)}</span> <small>${esc(fmtMD(cal, next.h.month, next.h.day))}</small>`;
    else el.textContent = '🎆 Holiday Forge';
}

/* ----------------------------------------------- tracker inside chat messages */

function trackerHtml() {
    const { cal } = nowParts();
    const list = upcoming();
    if (!list.length) return '';
    const focus = list.find((x) => x.delta === 0) || list[0];
    const h = focus.h;
    const others = list.filter((x) => x !== focus).slice(0, 3);
    const head = focus.delta === 0
        ? `<span class="hf-tr-now">🎉 ${t('today')}</span> <b>${esc(h.name)}</b>`
        : `<span class="hf-tr-ico">${TYPES[h.type]?.icon || '✨'}</span> <b>${esc(h.name)}</b> <span class="hf-tr-cd hf-cd-inline" data-serial="${focus.serial}">${inlineCd(focus.mins)}</span>`;
    return `<details class="hf-tracker" style="--c:${TYPES[h.type]?.color}" ${ui.trackerOpen ? 'open' : ''}>
        <summary><span class="hf-tr-head">${head}</span><span class="hf-tr-chev">▾</span></summary>
        <div class="hf-tr-body">
            <div class="hf-tr-meta">${typeChip(h.type)} <span>${esc(fmtMD(cal, h.month, h.day))}</span>${h.tone ? ` <span>· ${esc(h.tone)}</span>` : ''}</div>
            ${h.description ? `<div class="hf-tr-desc">${esc(h.description)}</div>` : ''}
            ${h.traditions ? `<div class="hf-tr-desc"><b>${t('traditions')}:</b> ${esc(h.traditions)}</div>` : ''}
            ${others.length ? `<div class="hf-tr-list-h">${t('tr_closest')}</div>${others.map((x) => `<div class="hf-tr-item" style="--c:${TYPES[x.h.type]?.color}"><span>${TYPES[x.h.type]?.icon || '✨'} ${esc(x.h.name)}</span><span class="hf-tr-when">${esc(fmtMD(cal, x.h.month, x.h.day))} · ${whenLabel(x.delta)}</span></div>`).join('')}` : ''}
            <button class="hf-tr-open" data-hf-open="1">${t('tr_open')}</button>
        </div></details>`;
}

function ensureTracker(force = false) {
    const s = S();
    const chat = document.getElementById('chat');
    if (!chat) return;
    const clear = () => chat.querySelectorAll('.hf-tracker-wrap').forEach((n) => n.remove());
    const html = s.enabled && s.tracker !== 'off' && hasChat() && C() ? trackerHtml() : '';
    if (!html) return clear();

    const mesList = [...chat.querySelectorAll('.mes')].filter((m) => m.getAttribute('is_system') !== 'true');
    let targets = [];
    if (s.tracker === 'all') targets = mesList.filter((m) => m.getAttribute('is_user') !== 'true');
    else if (mesList.length) targets = [mesList[mesList.length - 1]];

    chat.querySelectorAll('.hf-tracker-wrap').forEach((n) => { if (!targets.includes(n.closest('.mes'))) n.remove(); });
    for (const mes of targets) {
        const block = mes.querySelector('.mes_block');
        if (!block) continue;
        let wrap = block.querySelector(':scope > .hf-tracker-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'hf-tracker-wrap';
            block.appendChild(wrap);
            force = true;
        }
        if (force) wrap.innerHTML = html;
    }
}

/* ---------------------------------------------------------------- actions */

function refreshAll() {
    renderBody();
    renderStrip();
    ensureTracker(true);
    refreshInjection();
}

function toastToday() {
    const s = S();
    if (!s.enabled || !s.toast || !hasChat()) return;
    const st = C();
    const np = nowParts();
    const x = upcoming().find((i) => i.delta === 0);
    const key = `${np.y}-${np.m}-${np.d}`;
    if (x && st.toastKey !== key) {
        st.toastKey = key;
        saveChat();
        window.toastr?.info(`${x.h.name} — ${x.h.description}`.slice(0, 160), t('t_today'));
    }
}

function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function runBusy(fn, okMsg) {
    if (ui.busy) return;
    ui.busy = true;
    renderBody();
    inj.text = '';
    applyInjection();
    try {
        const n = await fn();
        if (n === -1) window.toastr?.warning(t('t_lore_none'));
        else window.toastr?.[n ? 'success' : 'info'](n ? t('t_added', n) : t('t_nothing'));
        scanChat();
    } catch (e) {
        console.error('[Holiday Forge]', e);
        window.toastr?.error(t('t_fail'));
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
        const prompt = document.getElementById('hf_gen_prompt')?.value.trim();
        runBusy(() => generate(prompt));
    },
    'lore-scan': () => runBusy(scanLorebook),
    add: () => { ui.editing = 'new'; renderBody(); },
    edit: (el) => { ui.editing = el.dataset.id; renderBody(); },
    'cancel-edit': () => { ui.editing = null; renderBody(); },
    'save-holiday': () => {
        const cal = nowParts().cal;
        const v = (id) => document.getElementById(id)?.value.trim() ?? '';
        const name = v('hf_e_name');
        if (!name) return window.toastr?.warning(t('t_name'));
        const month = mIdx(cal, v('hf_e_month'));
        const yr = v('hf_e_year');
        const data = {
            name, month, day: dClamp(cal, month, v('hf_e_day')), year: yr === '' ? null : parseInt(yr, 10),
            type: v('hf_e_type'), tone: v('hf_e_tone'), description: v('hf_e_desc'), traditions: v('hf_e_trad'),
            source: 'manual', hidden: false,
        };
        const st = C();
        if (ui.editing === 'new') {
            st.holidays = st.holidays.filter((h) => h.name.toLowerCase() !== name.toLowerCase() || h.source === 'manual');
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
        if (!h || !confirm(t('c_del', h.name))) return;
        st.holidays = st.holidays.filter((x) => x.id !== h.id);
        delete st.celebrated[h.id];
        delete st.mentions[h.id];
        saveChat();
        refreshAll();
    },
    celebrate: (el) => { const st = C(); if (el.checked) st.celebrated[el.dataset.id] = true; else delete st.celebrated[el.dataset.id]; saveChat(); renderBody(); },
    scan: () => { scanChat(); renderBody(); window.toastr?.info(t('t_scanned')); },
    setclock: () => {
        const cal = calendar(P());
        const g = (id) => parseInt(document.getElementById(id)?.value, 10) || 0;
        const m = mIdx(cal, g('hf_cd_m'));
        const total = toDay(cal, g('hf_cd_y'), m, dClamp(cal, m, g('hf_cd_d'))) * 1440 + clamp(g('hf_cd_h'), 0, 23) * 60 - Math.round(S().offset) * 1440;
        storeClock(total);
        refreshAll();
        toastToday();
    },
    advance: (el) => { storeClock(clockMinutes(false) + parseInt(el.dataset.n, 10) * 1440); refreshAll(); toastToday(); },
    ideas: async (el) => {
        const h = holidays().find((x) => x.id === el.dataset.id);
        if (!h) return;
        el.disabled = true;
        el.textContent = t('thinking');
        try { ui.ideas[h.id] = await ideasFor(h); } catch { window.toastr?.error(t('t_ideas_fail')); }
        renderBody();
    },
    'profile-new': () => {
        const s = S();
        const id = uid();
        s.profiles[id] = newProfile(id, 'New world');
        C().profileId = id;
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
        if (Object.keys(s.profiles).length < 2) return window.toastr?.warning(t('t_keep1'));
        if (!confirm(t('c_prof', p.name))) return;
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
        if (Array.isArray(data.holidays) && data.holidays.length && confirm(t('c_imp'))) {
            mergeGenerated(data.holidays.map((h) => ({ ...h, id: uid() })));
        }
        saveSettingsDebounced(); saveChat(); scanChat(); refreshAll();
        window.toastr?.success(t('t_imported'));
    } catch {
        window.toastr?.error(t('t_invalid'));
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
        <nav class="hf-tabs">${TABS.map(([k, i]) => `<button data-hf="tab" data-tab="${k}"><span>${i}</span>${t('tab_' + k)}</button>`).join('')}</nav>
        <div class="hf-body"></div></div>`;
    document.body.appendChild(o);

    o.addEventListener('click', (e) => {
        if (e.target === o) return closePanel();
        const el = e.target.closest('[data-hf]');
        if (!el || el.tagName === 'INPUT') return;
        actions[el.dataset.hf]?.(el);
    });
    o.addEventListener('change', (e) => {
        const el = e.target;
        if (el.dataset.hf === 'celebrate') return actions.celebrate(el);
        if (el.id === 'hf_profile_pick') { C().profileId = el.value; ui.editingProfile = null; saveChat(); return refreshAll(); }
        if (el.id === 'hf_import_file' && el.files[0]) { importFile(el.files[0]); el.value = ''; return; }
        if (el.dataset.p) {
            P()[el.dataset.p] = el.value;
            saveSettingsDebounced();
            if (['calendarType', 'months'].includes(el.dataset.p)) { scanChat(); refreshAll(); } else { if (el.dataset.p === 'name') renderBody(); refreshInjection(); }
            return;
        }
        if (el.dataset.set) {
            const s = S();
            const k = el.dataset.set;
            const keepClock = k === 'flow' || k === 'offset' ? clockMinutes(false) : null;
            s[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (parseFloat(el.value) || 0) : el.value;
            if (keepClock !== null && hasChat()) storeClock(keepClock);
            saveSettingsDebounced();
            if (k === 'lang') return relocalize();
            syncDrawer();
            refreshAll();
        }
    });

    // swipe down on the handle closes the bottom sheet
    const sheet = o.querySelector('#hf-sheet');
    const grab = sheet.querySelector('.hf-grab');
    let y0 = null;
    grab.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    grab.addEventListener('touchmove', (e) => {
        if (y0 === null) return;
        sheet.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - y0)}px)`;
    }, { passive: true });
    grab.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - (y0 ?? 0);
        sheet.style.transform = '';
        y0 = null;
        if (dy > 90) closePanel();
    });
    grab.addEventListener('click', closePanel);
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

function relocalize() {
    const wasOpen = ui.open;
    document.getElementById('hf-overlay')?.remove();
    document.getElementById('hf_drawer')?.remove();
    document.getElementById('hf_wand')?.remove();
    buildPanel();
    mountDrawer();
    if (wasOpen) document.getElementById('hf-overlay').classList.remove('hf-hidden');
    refreshAll();
}

/* ---------------------------------------------------------- extension drawer */

function mountDrawer() {
    if (!document.getElementById('hf_drawer')) {
        const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
        if (host) {
            const d = document.createElement('div');
            d.id = 'hf_drawer';
            d.className = 'extension_container';
            d.innerHTML = `<div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header"><b>🔨 Holiday Forge</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
                <div class="inline-drawer-content">
                    <label class="checkbox_label"><input type="checkbox" id="hf_drawer_enabled"><span>${t('drawer_enabled')}</span></label>
                    <div class="menu_button" id="hf_drawer_open"><i class="fa-solid fa-calendar-days"></i> ${t('drawer_open')}</div>
                </div></div>`;
            host.appendChild(d);
            d.querySelector('#hf_drawer_enabled').addEventListener('change', (e) => { S().enabled = e.target.checked; saveSettingsDebounced(); refreshAll(); });
            d.querySelector('#hf_drawer_open').addEventListener('click', openPanel);
            syncDrawer();
        }
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
    if (!hasChat()) { renderStrip(); ensureTracker(true); inj.text = ''; applyInjection(); renderBody(); return; }
    const st = C();
    ensureClock();
    scanChat();
    refreshAll();
    toastToday();
    const s = S();
    if (s.enabled && s.autoGenerate && st && !st.holidays.length && !st.autoDone && (getContext().chat || []).length > 0) {
        st.autoDone = true;
        saveChat();
        runBusy(() => generate(''));
    }
}

function tick() {
    if (!hasChat() || !S().enabled) return;
    const total = clockMinutes(true);
    document.querySelectorAll('.hf-cd').forEach((el) => { el.innerHTML = cdTiles(+el.dataset.serial * 1440 - total); });
    document.querySelectorAll('.hf-cd-inline').forEach((el) => { el.textContent = inlineCd(+el.dataset.serial * 1440 - total); });
    if (S().flow > 0) { toastToday(); refreshInjection(); }
}

jQuery(async () => {
    S();
    mountDrawer();
    buildPanel();

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.open) closePanel(); });
    // tracker: remember open state, open the panel from the button
    document.addEventListener('toggle', (e) => { if (e.target?.classList?.contains('hf-tracker')) ui.trackerOpen = e.target.open; }, true);
    document.addEventListener('click', (e) => { if (e.target.closest?.('[data-hf-open]')) openPanel(); });

    const chatEl = document.getElementById('chat');
    if (chatEl) {
        new MutationObserver(() => {
            clearTimeout(obsTimer);
            obsTimer = setTimeout(() => ensureTracker(false), 150);
        }).observe(chatEl, { childList: true });
    }

    eventSource.on(event_types.APP_READY, () => { mountDrawer(); onChat(); });
    eventSource.on(event_types.CHAT_CHANGED, onChat);
    eventSource.on(event_types.MESSAGE_RECEIVED, () => { scheduleScan(); refreshInjection(); setTimeout(() => ensureTracker(false), 200); });
    eventSource.on(event_types.MESSAGE_SENT, () => { scheduleScan(); refreshInjection(); });
    eventSource.on(event_types.MESSAGE_DELETED, () => { scheduleScan(); setTimeout(() => ensureTracker(false), 200); });
    eventSource.on(event_types.GENERATION_STARTED, async (type, _params, dryRun) => {
        if (type === 'quiet' || dryRun) return applyInjection();
        await refreshInjection();
    });

    setInterval(tick, 5000);
    onChat();
});

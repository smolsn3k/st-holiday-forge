// Holiday Forge v1.7 — SillyTavern extension
// Generate, track and inject in-world holidays. Per-chat state, theme-adaptive, mobile-first, EN/RU.

// No static imports from SillyTavern internals (paths/exports change between versions and a failed import
// silently kills the whole extension). Everything comes from the global SillyTavern context.
const getContext = () => globalThis.SillyTavern.getContext();
let stModule = null;
import('../../../../script.js').then((m) => { stModule = m; }).catch(() => {});
let extMod = null;
import('../../../extensions.js').then((m) => { extMod = m; }).catch(() => {});
const ES_FALLBACK = {};
const ES = () => getContext().extensionSettings || extMod?.extension_settings || ES_FALLBACK;
const saveSettingsDebounced = () => { (getContext().saveSettingsDebounced || stModule?.saveSettingsDebounced)?.(); };

const VERSION = '1.7.0';
const MODULE = 'holidayForge';
const META = 'holidayForge';
const PROMPT_KEY = 'HOLIDAY_FORGE';

const TYPES = {
    religious: { fa: 'fa-church', color: '#e0b04a' },
    cultural: { fa: 'fa-masks-theater', color: '#d9718f' },
    seasonal: { fa: 'fa-leaf', color: '#5fb87a' },
    personal: { fa: 'fa-cake-candles', color: '#7aa2f7' },
};

// Holiday icons (Font Awesome 6 free, bundled with SillyTavern). The LLM picks a word from this list.
const ICONS = {
    tree: 'fa-tree', snow: 'fa-snowflake', star: 'fa-star', egg: 'fa-egg', sun: 'fa-sun', heart: 'fa-heart',
    flower: 'fa-seedling', shield: 'fa-shield-halved', flag: 'fa-flag', ghost: 'fa-ghost', moon: 'fa-moon',
    leaf: 'fa-leaf', wheat: 'fa-wheat-awn', fire: 'fa-fire', bell: 'fa-bell', church: 'fa-church', cross: 'fa-cross',
    dove: 'fa-dove', gift: 'fa-gift', glass: 'fa-champagne-glasses', music: 'fa-music', mask: 'fa-masks-theater',
    ring: 'fa-ring', cake: 'fa-cake-candles', book: 'fa-book', crown: 'fa-crown', work: 'fa-briefcase',
    school: 'fa-graduation-cap', beach: 'fa-umbrella-beach', candy: 'fa-candy-cane', mug: 'fa-mug-hot',
    skull: 'fa-skull', feather: 'fa-feather', cookie: 'fa-cookie', tent: 'fa-campground', pray: 'fa-hands-praying',
    drum: 'fa-drum', fish: 'fa-fish', gem: 'fa-gem', dragon: 'fa-dragon', wizard: 'fa-hat-wizard', anchor: 'fa-anchor',
};
const ICON_WORDS = Object.keys(ICONS);

function iconKey(v) {
    const x = String(v || '').trim().toLowerCase().replace(/^fa-/, '');
    if (ICONS[x]) return x;
    const hit = Object.entries(ICONS).find(([, fa]) => fa === `fa-${x}`);
    return hit ? hit[0] : '';
}

const ICON_BY_NAME = [
    [/(нов(ый|ого|ым)\s+год|new\s*year|hogmanay|сочельник)/i, 'tree'],
    [/(рождеств|christmas|xmas|yule|святки)/i, 'star'],
    [/(пасх|easter)/i, 'egg'],
    [/(маслениц|pancake|shrovetide)/i, 'sun'],
    [/(валентин|valentine|влюбл|любов|love)/i, 'heart'],
    [/(8\s*марта|женск|women|mother|матер)/i, 'flower'],
    [/(защитник|отечеств|defender|veteran|воин|war|battle|битв|войн)/i, 'shield'],
    [/(независим|единств|independence|national|republic|конституц|founding|основан)/i, 'flag'],
    [/(хэллоуин|halloween|самайн|samhain|мертв|мёртв|dead|spirit|дух)/i, 'ghost'],
    [/(купал|солнцеворот|солнцестоя|midsummer|solstice|bonfire|костер|костёр)/i, 'fire'],
    [/(урожа|жатв|harvest|осенин|thanksgiving|grain|зерн)/i, 'wheat'],
    [/(луна|лунн|moon|night|ночь|рамадан|ramadan|пост\b|fast|lent)/i, 'moon'],
    [/(зим|winter|snow|снег|мороз|frost)/i, 'snow'],
    [/(свадьб|венчан|wedding|годовщин|anniversary)/i, 'ring'],
    [/(день\s*рожд|именин|birthday)/i, 'cake'],
    [/(знани|выпускн|школ|академ|university|graduation|school)/i, 'school'],
    [/(корпоратив|работ|офис|corporate|guild|гильд|trade|торг)/i, 'work'],
    [/(вечеринк|party|бал\b|ball\b|пир\b|feast|банкет|banquet)/i, 'glass'],
    [/(концерт|фестивал|concert|festival|музык|песн|song)/i, 'music'],
    [/(маскарад|карнавал|carnival|masquerade|театр)/i, 'mask'],
    [/(поминк|поминал|память|memorial|funeral|похорон|remembrance)/i, 'feather'],
    [/(молитв|prayer|pray|храм|temple|святы|holy|sacred|божеств|god|богин|goddess)/i, 'pray'],
    [/(корон|coron|королев|король|king|queen|imperial|император)/i, 'crown'],
    [/(море|sea|ocean|рыб|fisher|корабл|harbor|порт)/i, 'anchor'],
    [/(дракон|dragon)/i, 'dragon'],
    [/(магия|magic|маг\b|wizard|arcane|колдов)/i, 'wizard'],
    [/(поездк|путешеств|пикник|trip|picnic|вылазк|pilgrim|паломн)/i, 'tent'],
    [/(чаепит|посиделк|tea\b)/i, 'mug'],
    [/(подар|gift)/i, 'gift'],
    [/(книг|book|scholar|learning|library)/i, 'book'],
];
const ICON_BY_TYPE = { religious: 'church', cultural: 'mask', seasonal: 'leaf', personal: 'cake' };

function holidayIcon(h) {
    if (!h) return 'fa-calendar-days';
    if (h.icon && ICONS[h.icon]) return ICONS[h.icon];
    const name = `${h.name || ''} ${h.description || ''}`;
    for (const [re, k] of ICON_BY_NAME) if (re.test(name)) return ICONS[k];
    return ICONS[ICON_BY_TYPE[h.type]] || 'fa-star';
}

const hIcon = (h) => `<i class="fa-solid ${holidayIcon(h)}"></i>`;

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
    topLayer: false,
    loreMode: 'active',
    loreBooks: [],
    trackerPos: 'top',
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
        scene_ideas: '<i class="fa-solid fa-lightbulb"></i> Scene ideas', thinking: '<i class="fa-solid fa-hourglass-half"></i> Thinking…', next3: 'Next 3', nothing_upcoming: 'Nothing upcoming.',
        clock: 'In-world date:', day: 'Day', month: 'Month', year: 'Year', hour: 'Hour',
        set_date: 'Set date', plus1: '+1 day', plus7: '+7 days',
        edit: '<i class="fa-solid fa-pen"></i> Edit', hide: '<i class="fa-solid fa-eye-slash"></i> Hide', show: '<i class="fa-solid fa-eye"></i> Show', del: '<i class="fa-solid fa-trash"></i> Delete', hidden: 'hidden',
        src_manual: '<i class="fa-solid fa-pen-nib"></i> manual', src_generated: '<i class="fa-solid fa-wand-magic-sparkles"></i> generated', src_lorebook: '<i class="fa-solid fa-book-open"></i> lorebook',
        traditions: 'Traditions', tone: 'Tone', description: 'Description',
        gen_h: '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate with LLM', gen_ph: 'Optional: e.g. harvest festivals, a holiday for the elves, something tied to the war…',
        count: 'Count', generate: '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate', generating: '<i class="fa-solid fa-hourglass-half"></i> Generating…', add_own: '<i class="fa-solid fa-plus"></i> Add own', scan_lore: '<i class="fa-solid fa-book-open"></i> Scan lorebook',
        api_profile: 'API profile', api_current: 'Current connection', api_missing: 'Connection Manager extension not found or has no profiles.',
        nothing_here: 'Nothing here.', new_holiday: '<i class="fa-solid fa-plus"></i> New holiday', edit_holiday: '<i class="fa-solid fa-pen"></i> Edit holiday',
        name: 'Name', year_opt: 'Year (optional, one-off)', type: 'Type', save: '<i class="fa-solid fa-floppy-disk"></i> Save', cancel: 'Cancel',
        tone_ph: 'e.g. joyful, solemn', editor_note: 'Saved entries become manual and override generated ones with the same name.',
        scan_chat: '<i class="fa-solid fa-magnifying-glass"></i> Scan chat',
        hist_note: 'Looks for holiday names in messages. A holiday counts as passed once it is mentioned and its in-world date is behind the current date, or when you mark it manually.',
        hist_empty: 'No celebrations on the timeline yet.', passed: 'passed', mentioned: 'mentioned', msg: 'msg', mark_cel: 'Mark as celebrated',
        prof_chat_h: '<i class="fa-solid fa-earth-europe"></i> World profile for this chat', new: '<i class="fa-solid fa-plus"></i> New', dup: '<i class="fa-solid fa-clone"></i> Duplicate', delete: '<i class="fa-solid fa-trash"></i> Delete',
        edit_prof: (n) => `<i class="fa-solid fa-pen"></i> Edit “${n}”`, prof_name: 'Profile name', world_name: 'World name', faith: 'Faith system',
        faith_ph: 'e.g. Moon Church, ancestor worship', region: 'Region / culture', calendar: 'Calendar',
        cal_greg: 'Gregorian (12 months)', cal_custom: 'Custom', months_label: 'Months (Name:days, comma or newline separated)',
        months_ph: 'Frostmoon:30, Seedmoon:28, Sunpeak:31', rules: 'Custom rules',
        rules_ph: 'e.g. No holidays on the winter solstice; the empire bans religious festivals',
        export: '<i class="fa-solid fa-download"></i> Export JSON', import: '<i class="fa-solid fa-upload"></i> Import JSON',
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
        tr_closest: 'Closest holidays', tr_open: 'Open Holiday Forge', icon: 'Icon', icon_auto: 'Auto',
        tab_calendar: 'Calendar', cal_today: 'Today', cal_add: 'Add holiday on this day', cal_none_day: 'No holidays on this day.',
        cal_celebrated: (y) => `Celebrated in year ${y}`, cal_memory: 'Memory of past years',
        cal_memory_empty: 'Nothing remembered yet. Tick “Celebrated” on a day in the calendar (or in History) and it is kept here and repeats next year.',
        repeat_opt: 'Repeats every year', one_off: 'one-off',
        hist_help: '“Scan whole chat” is a free, instant text search for holidays that are already in your list. “Find new” asks the AI to read the chat and add holidays that are not in the list yet.',
        scan_whole: 'Scan whole chat', scanning: 'Scanning…', find_recent: 'Find new (last 40 messages)', find_all: 'Find new in whole chat…',
        c_whole: (m, n) => `Scan the whole chat with the AI?\n\n${m} messages will be sent to your model in ${n} requests. This can take a long time and use many tokens. You can cancel at any time; holidays found so far are kept.`,
        diag_btn: 'Diagnostics', diag_hint: 'Runs a self-test and copies technical info that you can paste to the developer.', diag_run: 'Run & copy', diag_copy: 'Copy',
        diag_copied: 'Diagnostics copied', diag_ready: 'Diagnostics ready: select and copy the text',
        inline_btn: 'Open here (inline)',
        t_hidden: 'The panel seems to be hidden behind other elements. Use “Open here (inline)” in the Extensions list and run Diagnostics.',
        src_chat: '<i class="fa-solid fa-comment"></i> chat', tr_none_left: 'No more holidays this year.',
        tr_next_year: (n, d) => `Next: ${n} in ${d} days.`,
        scan_date: 'Scan date from chat',
        c_rpdate: (label, ev) => `The AI thinks the current story date is:\n\n${label}\n\nBased on: ${ev}\n\nSet the in-world date to this?`,
        t_date_none: 'Could not find a date in the recent chat', t_date_set: (l) => `In-world date set: ${l}`,
        io_h: 'Import / Export', io_export: 'Export (downloads a JSON file):', io_holidays: 'Holidays', io_world_h: 'World + holidays', io_world: 'World only', io_all: 'All worlds',
        io_import: 'Import a file exported from Holiday Forge:', io_mode: 'If this chat already has holidays', io_merge: 'Merge (keep existing, add new)', io_replace: 'Replace them all',
        io_with_hol: 'Also import the holidays found in the file', io_file: 'Choose file…', io_paste: 'Paste JSON instead', io_import_paste: 'Import pasted JSON',
        t_io_empty: 'No holidays to export', t_io_done: (p, a, m) => `Imported: ${p} world(s), ${a} new holiday(s), ${m} merged`, io_short_exp: 'Export', io_short_imp: 'Import',
        lore_src: 'Lorebook source', lore_active: 'Active lorebooks (global, character, chat)', lore_selected: 'Only the lorebooks I pick',
        lore_none: 'No lorebooks found', toplayer_opt: 'Always show the panel above everything (use if the panel is hidden)',
        t_added: (n) => `Added ${n} holiday${n > 1 ? 's' : ''}`, t_nothing: 'Nothing new was added',
        t_fail: 'Generation failed or the reply was not valid JSON. Try again.', t_scanned: 'Chat scanned',
        t_name: 'Give it a name', t_lore_none: 'No usable lorebook entries found', t_invalid: 'Invalid profile file',
        t_imported: 'Profile imported', t_keep1: 'Keep at least one profile', t_ideas_fail: 'Could not get ideas',
        t_api_missing: 'API profile not found, using the current connection',
        c_del: (n) => `Delete “${n}”?`, c_prof: (n) => `Delete profile “${n}”?`, c_imp: 'Also import the holidays from this file into the current chat?',
        t_today: 'Today is a holiday',
        tracker_pos: 'Tracker position', tp_top: 'top of the message', tp_bottom: 'bottom of the message',
        busy: 'Working…', cancel: 'Cancel', tr_empty: 'No holidays yet', tr_empty_hint: 'Tap to open and generate', tr_also: 'Also today',
        find_chat: '<i class="fa-solid fa-wand-magic-sparkles"></i> Find new in chat',
        t_scan_res: (h, m) => `Found mentions of ${h} holiday${h === 1 ? '' : 's'} (${m} messages checked)`,
        t_scan_zero: (h, m) => `No mentions found — ${h} holidays, ${m} messages checked`,
        t_scan_noh: 'No holidays yet — generate or add some first', t_cancelled: 'Cancelled',
        t_fail_d: (m) => `Failed: ${m}`, t_chat_none: 'No new holidays found in the chat',
        gl_line: { chat: 'Write all names and text in the same language as the roleplay (chat and character card).', en: 'Write all names and text in English.', ru: 'Write all names and text in Russian.' },
    },
    ru: {
        tab_overview: 'Обзор', tab_holidays: 'Праздники', tab_history: 'История', tab_profiles: 'Профили', tab_settings: 'Настройки',
        type_religious: 'религиозный', type_cultural: 'культурный', type_seasonal: 'сезонный', type_personal: 'личный',
        style_balanced: 'сбалансированный', style_grounded: 'реалистичный', style_whimsical: 'причудливый', style_solemn: 'торжественный',
        all: 'Все', today: 'Сегодня', tomorrow: 'Завтра', in_days: (n) => `через ${n} дн.`,
        u_days: 'дней', u_hours: 'часов', u_min: 'мин', s_d: 'д', s_h: 'ч',
        no_holidays: 'В этом чате пока нет праздников.', gen_first: 'Сгенерировать праздники',
        scene_ideas: '<i class="fa-solid fa-lightbulb"></i> Идеи для сцен', thinking: '<i class="fa-solid fa-hourglass-half"></i> Думаю…', next3: 'Ближайшие 3', nothing_upcoming: 'Ничего не намечается.',
        clock: 'Дата в мире:', day: 'День', month: 'Месяц', year: 'Год', hour: 'Час',
        set_date: 'Установить дату', plus1: '+1 день', plus7: '+7 дней',
        edit: '<i class="fa-solid fa-pen"></i> Изменить', hide: '<i class="fa-solid fa-eye-slash"></i> Скрыть', show: '<i class="fa-solid fa-eye"></i> Показать', del: '<i class="fa-solid fa-trash"></i> Удалить', hidden: 'скрыт',
        src_manual: '<i class="fa-solid fa-pen-nib"></i> вручную', src_generated: '<i class="fa-solid fa-wand-magic-sparkles"></i> сгенерирован', src_lorebook: '<i class="fa-solid fa-book-open"></i> лорбук',
        traditions: 'Традиции', tone: 'Тон', description: 'Описание',
        gen_h: '<i class="fa-solid fa-wand-magic-sparkles"></i> Генерация через LLM', gen_ph: 'Необязательно: например, праздники урожая, праздник эльфов, что-то связанное с войной…',
        count: 'Кол-во', generate: '<i class="fa-solid fa-wand-magic-sparkles"></i> Сгенерировать', generating: '<i class="fa-solid fa-hourglass-half"></i> Генерация…', add_own: '<i class="fa-solid fa-plus"></i> Свой праздник', scan_lore: '<i class="fa-solid fa-book-open"></i> Скан лорбука',
        api_profile: 'API-профиль', api_current: 'Текущее подключение', api_missing: 'Расширение Connection Manager не найдено или в нём нет профилей.',
        nothing_here: 'Здесь пусто.', new_holiday: '<i class="fa-solid fa-plus"></i> Новый праздник', edit_holiday: '<i class="fa-solid fa-pen"></i> Изменить праздник',
        name: 'Название', year_opt: 'Год (необязательно, разовый)', type: 'Тип', save: '<i class="fa-solid fa-floppy-disk"></i> Сохранить', cancel: 'Отмена',
        tone_ph: 'например, радостный, торжественный', editor_note: 'Сохранённые записи становятся ручными и заменяют сгенерированные с тем же названием.',
        scan_chat: '<i class="fa-solid fa-magnifying-glass"></i> Сканировать чат',
        hist_note: 'Ищет названия праздников в сообщениях. Праздник считается прошедшим, если он упомянут и его внутримировая дата уже позади, либо если вы отметили его вручную.',
        hist_empty: 'В хронологии пока нет праздников.', passed: 'прошёл', mentioned: 'упомянут', msg: 'сообщ.', mark_cel: 'Отметить как отпразднованный',
        prof_chat_h: '<i class="fa-solid fa-earth-europe"></i> Профиль мира для этого чата', new: '<i class="fa-solid fa-plus"></i> Новый', dup: '<i class="fa-solid fa-clone"></i> Дублировать', delete: '<i class="fa-solid fa-trash"></i> Удалить',
        edit_prof: (n) => `<i class="fa-solid fa-pen"></i> Редактирование «${n}»`, prof_name: 'Название профиля', world_name: 'Название мира', faith: 'Система верований',
        faith_ph: 'например, Лунная церковь, культ предков', region: 'Регион / культура', calendar: 'Календарь',
        cal_greg: 'Григорианский (12 месяцев)', cal_custom: 'Свой', months_label: 'Месяцы (Название:дней, через запятую или с новой строки)',
        months_ph: 'Морозень:30, Сеяние:28, Солнцепик:31', rules: 'Свои правила',
        rules_ph: 'например, нет праздников в зимнее солнцестояние; империя запрещает религиозные обряды',
        export: '<i class="fa-solid fa-download"></i> Экспорт JSON', import: '<i class="fa-solid fa-upload"></i> Импорт JSON',
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
        tr_closest: 'Ближайшие праздники', tr_open: 'Открыть Holiday Forge', icon: 'Значок', icon_auto: 'Авто',
        tab_calendar: 'Календарь', cal_today: 'Сегодня', cal_add: 'Добавить праздник на этот день', cal_none_day: 'В этот день праздников нет.',
        cal_celebrated: (y) => `Отпразднован в ${y} году`, cal_memory: 'Память о прошлых годах',
        cal_memory_empty: 'Пока ничего не запомнено. Отметьте «Отпразднован» в календаре (или в Истории) — это сохранится здесь и повторится в следующем году.',
        repeat_opt: 'Повторяется каждый год', one_off: 'разовый',
        hist_help: '«Скан всего чата» — бесплатный мгновенный текстовый поиск праздников, которые уже есть в списке. «Найти новые» просит ИИ прочитать чат и добавить праздники, которых в списке ещё нет.',
        scan_whole: 'Скан всего чата', scanning: 'Сканирую…', find_recent: 'Найти новые (последние 40 сообщений)', find_all: 'Найти новые во всём чате…',
        c_whole: (m, n) => `Просканировать весь чат через ИИ?\n\nСообщений: ${m}, они уйдут вашей модели в ${n} запросах. Это может занять много времени и токенов. Можно отменить в любой момент — уже найденные праздники сохранятся.`,
        diag_btn: 'Диагностика', diag_hint: 'Запускает самопроверку и копирует технические данные, которые можно отправить разработчику.', diag_run: 'Запустить и скопировать', diag_copy: 'Копировать',
        diag_copied: 'Диагностика скопирована', diag_ready: 'Диагностика готова: выделите и скопируйте текст',
        inline_btn: 'Открыть здесь (во вкладке)',
        t_hidden: 'Похоже, панель скрыта за другими элементами. Нажмите «Открыть здесь» в списке расширений и запустите диагностику.',
        src_chat: '<i class="fa-solid fa-comment"></i> чат', tr_none_left: 'В этом году праздников больше нет.',
        tr_next_year: (n, d) => `Дальше: ${n} через ${d} дн.`,
        scan_date: 'Определить дату из чата',
        c_rpdate: (label, ev) => `ИИ считает, что сейчас в истории:\n\n${label}\n\nОснование: ${ev}\n\nУстановить эту дату в мире?`,
        t_date_none: 'В последних сообщениях дата не найдена', t_date_set: (l) => `Дата в мире установлена: ${l}`,
        io_h: 'Импорт / Экспорт', io_export: 'Экспорт (скачивает JSON-файл):', io_holidays: 'Праздники', io_world_h: 'Мир + праздники', io_world: 'Только мир', io_all: 'Все миры',
        io_import: 'Импорт файла, экспортированного из Holiday Forge:', io_mode: 'Если в этом чате уже есть праздники', io_merge: 'Объединить (оставить текущие, добавить новые)', io_replace: 'Заменить все',
        io_with_hol: 'Также импортировать праздники из файла', io_file: 'Выбрать файл…', io_paste: 'Вставить JSON вместо файла', io_import_paste: 'Импортировать вставленный JSON',
        t_io_empty: 'Нет праздников для экспорта', t_io_done: (p, a, m) => `Импортировано: миров ${p}, новых праздников ${a}, объединено ${m}`, io_short_exp: 'Экспорт', io_short_imp: 'Импорт',
        lore_src: 'Источник лорбука', lore_active: 'Активные лорбуки (глобальные, персонажа, чата)', lore_selected: 'Только выбранные мной лорбуки',
        lore_none: 'Лорбуки не найдены', toplayer_opt: 'Всегда показывать панель поверх всего (если панель скрыта)',
        t_added: (n) => `Добавлено праздников: ${n}`, t_nothing: 'Ничего нового не добавлено',
        t_fail: 'Не удалось сгенерировать или ответ не в формате JSON. Попробуйте ещё раз.', t_scanned: 'Чат просканирован',
        t_name: 'Укажите название', t_lore_none: 'Подходящих записей лорбука не найдено', t_invalid: 'Неверный файл профиля',
        t_imported: 'Профиль импортирован', t_keep1: 'Нужен хотя бы один профиль', t_ideas_fail: 'Не удалось получить идеи',
        t_api_missing: 'API-профиль не найден, используется текущее подключение',
        c_del: (n) => `Удалить «${n}»?`, c_prof: (n) => `Удалить профиль «${n}»?`, c_imp: 'Импортировать также праздники из файла в текущий чат?',
        t_today: 'Сегодня праздник',
        tracker_pos: 'Положение трекера', tp_top: 'вверху сообщения', tp_bottom: 'внизу сообщения',
        busy: 'Работаю…', cancel: 'Отмена', tr_empty: 'Праздников пока нет', tr_empty_hint: 'Нажмите, чтобы открыть и сгенерировать', tr_also: 'Также сегодня',
        find_chat: '<i class="fa-solid fa-wand-magic-sparkles"></i> Найти новые в чате',
        t_scan_res: (h, m) => `Найдены упоминания праздников: ${h} (сообщений проверено: ${m})`,
        t_scan_zero: (h, m) => `Упоминаний нет — праздников: ${h}, сообщений проверено: ${m}`,
        t_scan_noh: 'Праздников пока нет — сначала сгенерируйте или добавьте', t_cancelled: 'Отменено',
        t_fail_d: (m) => `Ошибка: ${m}`, t_chat_none: 'Новых праздников в чате не найдено',
        gl_line: { chat: 'Write all names and text in the same language as the roleplay (chat and character card).', en: 'Write all names and text in English.', ru: 'Write all names and text in Russian.' },
    },
};

function lang() {
    const v = ES()[MODULE]?.lang;
    if (v === 'en' || v === 'ru') return v;
    const ui = (localStorage.getItem('language') || navigator.language || 'en').toLowerCase();
    return ui.startsWith('ru') ? 'ru' : 'en';
}

function t(k, ...a) {
    const v = L[lang()][k] ?? L.en[k] ?? k;
    return typeof v === 'function' ? v(...a) : v;
}

/* ------------------------------------------------------------------ state */

const ui = { tab: 'overview', editing: null, editingProfile: null, busy: false, filter: 'all', ideas: {}, open: false, trackerOpen: false, runId: 0, editIcon: '', editDraft: null, importMode: 'merge', importHol: true, loreNames: [], calY: null, calM: 1, calSel: null, diagText: '', inline: false, scanning: false, progress: null };
let runState = null;
const inj = { text: '' };
const diagLog = [];
const dlog = (m) => { diagLog.push(`${new Date().toISOString().slice(11, 19)} ${m}`); if (diagLog.length > 60) diagLog.shift(); };
window.addEventListener?.('error', (e) => {
    const f = String(e.filename || '');
    if (/holiday/i.test(f) || /holiday forge/i.test(String(e.message))) dlog(`ERR ${e.message} @${f.split('/').slice(-2).join('/')}:${e.lineno}`);
});
window.addEventListener?.('unhandledrejection', (e) => {
    const m = String(e.reason?.stack || e.reason || '');
    if (/holiday/i.test(m)) dlog('REJ ' + m.slice(0, 200));
});
let scanTimer = null;
let obsTimer = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => `hf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function S() {
    const s = (ES()[MODULE] ??= {});
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

const freshState = () => ({ profileId: null, holidays: [], celebrated: {}, mentions: {}, clock: null, toastKey: null, autoDone: false });

function chatIdNow() {
    const ctx = getContext();
    return ctx.chatId ?? ctx.getCurrentChatId?.() ?? null;
}

function hasChat() {
    const ctx = getContext();
    return !!chatIdNow() || ctx.characterId !== undefined || !!ctx.groupId;
}

function C() {
    const ctx = getContext();
    const md = ctx.chatMetadata || stModule?.chat_metadata;
    if (md && typeof md === 'object') {
        md[META] ??= freshState();
        return md[META];
    }
    // fallback if chat metadata is not exposed: keep state in extension settings, keyed by chat
    if (!hasChat()) return null;
    const key = String(chatIdNow() ?? ctx.characterId ?? ctx.groupId);
    const store = (ES().holidayForgeChats ??= {});
    return (store[key] ??= freshState());
}

function saveChat() {
    const ctx = getContext();
    if (ctx.chatMetadata || stModule?.chat_metadata) {
        if (ctx.saveMetadataDebounced) ctx.saveMetadataDebounced();
        else if (ctx.saveMetadata) ctx.saveMetadata();
        else stModule?.saveMetadata?.();
    } else {
        saveSettingsDebounced();
    }
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

const hasFixedYear = (h) => h.year !== null && h.year !== undefined && h.year !== '';

function celebratedIn(h, y) {
    const st = C();
    let c = st.celebrated[h.id];
    if (c === true) { c = { [y]: true }; st.celebrated[h.id] = c; } // legacy boolean -> per-year memory
    return !!(c && typeof c === 'object' && c[y]);
}

function setCelebrated(id, y, val) {
    const st = C();
    let c = st.celebrated[id];
    if (!c || typeof c !== 'object') c = {};
    c[y] = !!val; // explicit false = "user unticked it", so auto-marking will not bring it back
    st.celebrated[id] = c;
}

/** Upcoming holidays. A holiday already marked as passed/celebrated this year is not counted down to again until the next year starts. */
function upcoming(opts = {}) {
    const { cal, total, day, y } = nowParts();
    return visible()
        .map((h) => {
            const serial = occurrence(cal, h, day);
            return { h, serial, delta: serial - day, mins: serial * 1440 - total, year: fromDay(cal, serial).y };
        })
        .filter((x) => x.delta >= 0)
        .filter((x) => opts.all || !celebratedIn(x.h, x.year))
        .filter((x) => opts.all || !(x.year > y && isPassed(x.h)))
        .sort((a, b) => a.serial - b.serial);
}

function nextYearHint() {
    const n = upcoming({ all: true })[0];
    return n ? `${t('tr_none_left')} ${t('tr_next_year', n.h.name, n.delta)}` : t('tr_none_left');
}

function mergeGenerated(list) {
    const st = runState || C();
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

const STOP = new Set(['the', 'of', 'and', 'day', 'feast', 'festival', 'a', 'an', 'in', 'on', 'to', 'день', 'праздник', 'фестиваль', 'и', 'в', 'на']);

function nameMatchers(name) {
    const words = name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    let sig = words.filter((w) => w.length >= 3 && !STOP.has(w));
    if (!sig.length) sig = words;
    // prefix stems tolerate Russian/English inflections ("Праздник Урожая" matches "праздника урожая")
    return sig.map((w) => {
        const stem = w.length > 6 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w;
        return new RegExp(`(^|[^\\p{L}\\p{N}])${reEsc(stem)}`, 'iu');
    });
}

// SillyTavern's /hide marks messages as is_system; they are still real story messages, so they must be scanned.
const isMsg = (m) => !!(m && m.mes && !['command', 'assistant_note'].includes(m.extra?.type) && !m.extra?.isSmallSys);

function scanChat(msgs) {
    const st = C();
    if (!st) return null;
    const all = msgs || getContext().chat || [];
    const chat = all.filter(isMsg);
    const mentions = {};
    for (const h of holidays()) {
        const res = nameMatchers(h.name);
        if (!res.length) continue;
        all.forEach((m, i) => {
            if (!isMsg(m)) return;
            if (!res.every((re) => re.test(m.mes))) return;
            const rec = (mentions[h.id] ??= { first: i, last: i, count: 0, snippet: '' });
            rec.last = i;
            rec.count++;
            const hit = res[0].exec(m.mes);
            const at = hit ? hit.index : 0;
            rec.snippet = m.mes.slice(Math.max(0, at - 40), at + h.name.length + 60).replace(/\s+/g, ' ').trim();
        });
    }
    st.mentions = mentions;
    autoMarkPassed();
    saveChat();
    return { holidays: holidays().length, found: Object.keys(mentions).length, messages: chat.length };
}

function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { scanChat(); if (ui.open) renderBody(); }, 1200);
}

function isPassed(h) {
    const st = C();
    const { cal, day, y } = nowParts();
    if (celebratedIn(h, y)) return true;
    const c = st.celebrated[h.id];
    if (c && typeof c === 'object' && c[y] === false) return false;
    if (!st.mentions[h.id]) return false;
    if (hasFixedYear(h)) return toDay(cal, +h.year, h.month, h.day) < day;
    return toDay(cal, y, h.month, h.day) < day;
}

/** Freeze "mentioned and date passed" into the per-year memory so it survives the year rollover. */
function autoMarkPassed() {
    const st = C();
    const { cal, day, y } = nowParts();
    for (const h of holidays()) {
        if (!st.mentions[h.id]) continue;
        const c = st.celebrated[h.id];
        if (c && typeof c === 'object' && c[y] !== undefined) continue;
        const date = hasFixedYear(h) ? toDay(cal, +h.year, h.month, h.day) : toDay(cal, y, h.month, h.day);
        if (date < day) setCelebrated(h.id, hasFixedYear(h) ? +h.year : y, true);
    }
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
    getContext().setExtensionPrompt?.(PROMPT_KEY, on ? inj.text : '', 1 /* IN_CHAT */, clamp(s.depth, 0, 20), false, 0 /* SYSTEM */);
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
    const cm = getContext().extensionSettings?.connectionManager || ES().connectionManager;
    return Array.isArray(cm?.profiles) ? cm.profiles : [];
}

const HOLIDAY_RE = /holiday|festival|feast|celebrat|ritual|ceremon|solstice|equinox|harvest|carnival|fest\b|day of|eve\b|праздн|фестивал|торжеств|ритуал|обряд|церемон|солнцестоян|равноденств|урожа|карнавал|день\s/i;

async function collectLore() {
    const ctx = getContext();
    const wi = await import('../../../world-info.js');
    const active = new Set(wi.selected_world_info || []);
    const ch = ctx.characters?.[ctx.characterId];
    const linked = ch?.data?.extensions?.world;
    if (linked) active.add(linked);
    const chatBook = ctx.chatMetadata?.[wi.METADATA_KEY || 'world_info'];
    if (chatBook) active.add(chatBook);
    const file = ch?.avatar?.replace(/\.[^/.]+$/, '');
    const extra = wi.world_info?.charLore?.find((e) => e.name === file);
    (extra?.extraBooks || []).forEach((n) => active.add(n));
    const picked = S().loreMode === 'selected';
    const names = picked ? new Set(S().loreBooks || []) : active;

    const entries = [];
    for (const n of names) {
        try {
            const data = await wi.loadWorldInfo(n);
            Object.values(data?.entries || {}).forEach((e) => { if (!e.disable) entries.push(e); });
        } catch (e) { console.warn('[Holiday Forge] lorebook load failed', n, e); }
    }
    if (!picked) (ch?.data?.character_book?.entries || []).forEach((e) => { if (e.enabled !== false) entries.push({ comment: e.comment, key: e.keys, content: e.content }); });

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

async function viaProfile(profileId, prompt, maxTokens) {
    const svc = getContext().ConnectionManagerRequestService;
    const messages = [
        { role: 'system', content: `You assist with a roleplay world. Use this context as the source of truth.\n\n${contextBlock()}` },
        { role: 'user', content: prompt },
    ];
    const res = await svc.sendRequest(profileId, messages, maxTokens, { stream: false, extractData: true, includePreset: true, includeInstruct: true }, {});
    return String(res?.content ?? res ?? '');
}

async function quiet(prompt, maxTokens = 1800) {
    const s = S();
    const ctx = getContext();
    const svc = ctx.ConnectionManagerRequestService;
    let profId = s.apiProfile;
    if (profId && !profiles().some((p) => p.id === profId)) {
        window.toastr?.warning(t('t_api_missing'));
        profId = '';
    }
    if (profId && svc) return await viaProfile(profId, prompt, maxTokens);

    let out = '';
    try {
        out = await ctx.generateQuietPrompt({ quietPrompt: prompt });
    } catch (e) {
        console.warn('[Holiday Forge] quiet prompt (object form) failed', e);
    }
    if (!out || typeof out !== 'string') {
        try { out = await ctx.generateQuietPrompt(prompt, false, false); } catch (e) { console.warn('[Holiday Forge] quiet prompt (legacy form) failed', e); }
    }
    if ((!out || !String(out).trim()) && svc) {
        const sel = ctx.extensionSettings?.connectionManager?.selectedProfile || ES().connectionManager?.selectedProfile;
        if (sel) return await viaProfile(sel, prompt, maxTokens);
    }
    return String(out || '');
}

function parseJsonList(text) {
    const x = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
    const a = x.indexOf('[');
    const b = x.lastIndexOf(']');
    if (a >= 0 && b > a) {
        try {
            const d = JSON.parse(x.slice(a, b + 1).replace(/,\s*([\]}])/g, '$1'));
            if (Array.isArray(d)) return d;
        } catch { /* fall back to object-by-object parsing */ }
    }
    const objs = [];
    let depth = 0, start = -1, inStr = false, skip = false;
    for (let i = 0; i < x.length; i++) {
        const c = x[i];
        if (inStr) { if (skip) skip = false; else if (c === '\\') skip = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') { inStr = true; continue; }
        if (c === '{') { if (depth === 0) start = i; depth++; }
        else if (c === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
                try { objs.push(JSON.parse(x.slice(start, i + 1).replace(/,\s*}/g, '}'))); } catch { /* skip broken item */ }
                start = -1;
            }
            if (depth < 0) depth = 0;
        }
    }
    if (objs.length === 1 && Array.isArray(objs[0].holidays)) return objs[0].holidays;
    if (objs.length) return objs;
    console.warn('[Holiday Forge] unparseable reply:', text);
    throw new Error(t('t_fail'));
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
                let j = i;
                if (j < 0 && cal.length === 12) {
                    // gregorian calendar: accept English or Russian month names whatever the UI language is
                    j = GREGORIAN.findIndex(([n], k) => n.toLowerCase() === q || GREG_RU[k][0].toLowerCase() === q || GREG_RU[k][1] === q);
                }
                month = j >= 0 ? j + 1 : 1;
            }
            month = mIdx(cal, month);
            return {
                id: uid(),
                name: String(x.name).trim(),
                month,
                day: dClamp(cal, month, x.day),
                year: null,
                repeat: true,
                type: TYPES[x.type] ? x.type : 'cultural',
                description: String(x.description || '').trim(),
                traditions: String(x.traditions || '').trim(),
                tone: String(x.tone || '').trim(),
                icon: iconKey(x.icon),
                source,
                hidden: false,
            };
        });
}

const JSON_SHAPE = (cal) => `Return ONLY a valid JSON array. No markdown, no commentary. Each item:
{"name":"","month":<number 1-${cal.length}>,"day":<number>,"type":"religious|cultural|seasonal|personal","description":"1-2 sentences","traditions":"1-3 short customs","tone":"2-3 words","icon":"<one word from: ${ICON_WORDS.join(', ')}>"}
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

/** The whole chat, even if the in-memory list only holds part of it: ask the server for the full file, fall back to memory. */
async function getFullChat() {
    const ctx = getContext();
    const mem = ctx.chat || [];
    try {
        const id = chatIdNow();
        const ch = ctx.characters?.[ctx.characterId];
        let url = null, body = null;
        if (id && ctx.groupId) { url = '/api/chats/group/get'; body = { id }; }
        else if (id && ch) { url = '/api/chats/get'; body = { ch_name: ch.name, file_name: String(id).replace(/\.jsonl$/, ''), avatar_url: ch.avatar }; }
        if (url && ctx.getRequestHeaders) {
            const r = await fetch(url, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) });
            if (r.ok) {
                const data = await r.json();
                if (Array.isArray(data)) {
                    const msgs = data.filter((m) => m && !m.chat_metadata && m.mes !== undefined);
                    dlog(`full chat: server ${msgs.length}, memory ${mem.length}`);
                    if (msgs.length > mem.length) return msgs;
                }
            } else dlog(`full chat fetch HTTP ${r.status}`);
        }
    } catch (e) { dlog('full chat fetch failed: ' + (e?.message || e)); }
    return mem;
}

const chatList = (msgs) => (msgs || []).filter(isMsg);

function chunkMessages(list, maxChars = 8000, perMsg = 1200) {
    const chunks = [];
    let cur = [];
    let len = 0;
    for (const m of list) {
        const line = `${m.name}: ${String(m.mes).replace(/\s+/g, ' ').slice(0, perMsg)}`;
        if (len + line.length > maxChars && cur.length) { chunks.push(cur.join('\n')); cur = []; len = 0; }
        cur.push(line);
        len += line.length + 1;
    }
    if (cur.length) chunks.push(cur.join('\n'));
    return chunks;
}

async function findInChat(whole, msgs) {
    const p = P();
    const cal = calendar(p);
    const list = chatList(msgs || getContext().chat);
    if (!list.length) return -1;
    const chunks = chunkMessages(whole ? list : list.slice(-40));
    const run = ui.runId;
    let added = 0, failed = 0;
    for (let i = 0; i < chunks.length; i++) {
        if (ui.runId !== run) break; // cancelled
        ui.progress = { done: i, total: chunks.length };
        updateProgress();
        const existing = holidays().map((h) => h.name).join('; ') || 'none';
        const prompt = `[OOC SYSTEM TASK — pause the roleplay. Do not write story text.]
Read this roleplay excerpt${chunks.length > 1 ? ` (part ${i + 1} of ${chunks.length} of a longer chat)` : ''}. List every holiday, festival or celebration that the characters mention, plan or celebrate. Use dates from the text if given, otherwise pick a fitting date for the calendar.
World profile:
${profileBlock(p, cal)}
Already existing (skip these): ${existing}
Excerpt:
${chunks[i]}

${JSON_SHAPE(cal)}
If nothing is found, return [].`;
        try {
            added += mergeGenerated(normalize(parseJsonList(await quiet(prompt)), cal, 'chat'));
        } catch (e) {
            failed++;
            dlog(`chunk ${i + 1} failed: ${e?.message || e}`);
            if (failed >= 3 && added === 0 && failed === i + 1) throw e;
        }
    }
    ui.progress = null;
    return added;
}

function monthFromAny(cal, v) {
    if (typeof v === 'number' || /^\d+$/.test(String(v).trim())) return mIdx(cal, v);
    const q = String(v).trim().toLowerCase();
    let i = cal.findIndex((c) => c.name.toLowerCase() === q || (c.gen && c.gen.toLowerCase() === q));
    if (i < 0 && cal.length === 12) i = GREGORIAN.findIndex(([n], k) => n.toLowerCase() === q || GREG_RU[k][0].toLowerCase() === q || GREG_RU[k][1] === q);
    return i >= 0 ? i + 1 : null;
}

/** Ask the model for the story's current date. Returns { label, minutes, evidence } or null. Hidden messages are included. */
async function scanRpDate() {
    const p = P();
    const cal = calendar(p);
    const list = chatList(getContext().chat);
    if (!list.length) return null;
    let text = '';
    for (let i = list.length - 1; i >= 0 && text.length < 9000; i--) {
        text = `${list[i].name}: ${String(list[i].mes).replace(/\s+/g, ' ').slice(0, 1200)}\n${text}`;
    }
    const prompt = `[OOC SYSTEM TASK — pause the roleplay. Do not write story text.]
Read this roleplay excerpt and work out the CURRENT in-story date at the END of the excerpt (the latest moment). Use explicit dates, weekdays, holidays, seasons and relative words such as "tomorrow" or "last night" that refer to dated events. If the story never gives or implies a date, answer {"found":false}.
Calendar: ${p.calendarType === 'custom' ? 'custom' : 'Gregorian'}; months numbered ${cal.map((m, i) => `${i + 1}=${m.name}(${m.days}d)`).join(', ')}
Return ONLY a JSON object, no markdown, no commentary:
{"found":true,"day":<number>,"month":<number 1-${cal.length}>,"year":<number or null>,"hour":<0-23 or null>,"evidence":"short quote or reason"}
Excerpt:
${text}`;
    const o = parseJsonList(await quiet(prompt, 500))[0];
    if (!o || o.found === false) return null;
    const month = monthFromAny(cal, o.month);
    if (!month || !o.day) return null;
    const np = nowParts();
    const yr = o.year === null || o.year === undefined || Number.isNaN(Math.round(+o.year)) ? np.y : Math.round(+o.year);
    const hr = o.hour === null || o.hour === undefined || Number.isNaN(Math.round(+o.hour)) ? np.h : clamp(Math.round(+o.hour), 0, 23);
    const day = dClamp(cal, month, o.day);
    return {
        label: `${fmtDate(cal, yr, month, day)}, ${String(hr).padStart(2, '0')}:00`,
        minutes: toDay(cal, yr, month, day) * 1440 + hr * 60 - Math.round(S().offset) * 1440,
        evidence: String(o.evidence || '—').slice(0, 200),
    };
}

async function ideasFor(h) {
    const p = P();
    const prompt = `[OOC SYSTEM TASK — pause the roleplay. Do not write story text.]
Suggest 3 short, concrete scene ideas (one sentence each, as a bullet list) for how the characters could spend "${h.name}" (${h.type}: ${h.description}) in this roleplay. Use the characters, setting and current mood of the chat. World: ${p.world || 'see context'}; faith: ${p.faith || 'see context'}. ${t('gl_line')[S().genLang] || t('gl_line').chat}`;
    return (await quiet(prompt, 600)).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/* ------------------------------------------------------------------- html */

const typeChip = (ty) => `<span class="hf-chip" style="--c:${TYPES[ty]?.color || '#999'}"><i class="fa-solid ${TYPES[ty]?.fa || 'fa-star'}"></i> ${esc(t('type_' + ty))}</span>`;
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
        <div class="hf-ico">${hIcon(h)}</div>
        <div class="hf-grow"><div class="hf-name">${esc(h.name)}</div><div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))}</div></div>
        <div class="hf-when ${x.delta === 0 ? 'now' : ''}">${whenLabel(x.delta)}</div></div>`;
}

async function loadLoreNames() {
    try {
        const wi = await import('../../../world-info.js');
        if (Array.isArray(wi.world_names)) ui.loreNames = [...wi.world_names];
    } catch (e) { dlog('lore names: ' + (e?.message || e)); }
    if (!ui.loreNames.length && Array.isArray(getContext().worldNames)) ui.loreNames = [...getContext().worldNames];
    if (ui.open && ['holidays', 'settings'].includes(ui.tab) && !ui.editing) renderBody();
}

function loreSelect() {
    const s = S();
    const names = ui.loreNames || [];
    const books = Array.isArray(s.loreBooks) ? s.loreBooks : [];
    return `<label>${t('lore_src')}<select class="text_pole" data-set="loreMode">
        <option value="active" ${s.loreMode !== 'selected' ? 'selected' : ''}>${t('lore_active')}</option>
        <option value="selected" ${s.loreMode === 'selected' ? 'selected' : ''}>${t('lore_selected')}</option></select></label>
        ${s.loreMode === 'selected' ? `<div class="hf-lorelist">${names.length ? names.map((n) => `<label class="checkbox_label"><input type="checkbox" data-lore="${esc(n)}" ${books.includes(n) ? 'checked' : ''}><span>${esc(n)}</span></label>`).join('') : `<div class="hf-sub">${t('lore_none')}</div>`}</div>` : ''}`;
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
        html += `<div class="hf-empty"><div class="hf-bigico"><i class="fa-solid fa-calendar-days"></i></div><p>${t('no_holidays')}</p>
            <button class="hf-btn primary" data-hf="goto" data-tab="holidays">${t('gen_first')}</button></div>`;
    } else {
        for (const x of today) {
            html += `<div class="hf-today" style="--c:${TYPES[x.h.type]?.color}"><div class="hf-today-h"><i class="fa-solid fa-champagne-glasses"></i> ${t('today')} — ${esc(x.h.name)}</div>
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
        html += `<div class="hf-h">${t('next3')}</div><div class="hf-card">${list.slice(0, 3).map((x) => miniRow(x, np.cal)).join('') || `<div class="hf-sub">${esc(nextYearHint())}</div>`}</div>`;
    }
    const monthOpts = np.cal.map((m, i) => `<option value="${i + 1}" ${i + 1 === np.m ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    html += `<details class="hf-card hf-clock"><summary><i class="fa-solid fa-clock"></i> ${t('clock')} <b>&nbsp;${esc(fmtDate(np.cal, np.y, np.m, np.d))}</b>, ${String(np.h).padStart(2, '0')}:${String(np.min).padStart(2, '0')}</summary>
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
    html += `<div class="hf-actions"><button class="hf-btn" data-hf="scan-date" ${ui.busy ? 'disabled' : ''}><i class="fa-solid fa-magnifying-glass-location"></i> ${t('scan_date')}</button></div>`;
    return html;
}

function holidayCard(h, cal) {
    const mention = C().mentions[h.id];
    return `<details class="hf-hcard" style="--c:${TYPES[h.type]?.color}">
        <summary><div class="hf-ico">${hIcon(h)}</div>
            <div class="hf-grow"><div class="hf-name">${esc(h.name)} ${h.hidden ? `<span class="hf-badge">${t('hidden')}</span>` : ''}</div>
            <div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))}${h.year ? ' ' + esc(h.year) : ''} · ${srcLabel(h)}${h.repeat === false ? ' · ' + t('one_off') : ''}${mention ? ` · <i class="fa-solid fa-comment"></i> ×${mention.count}` : ''}</div></div>
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
            ${loreSelect()}
            <div class="hf-actions">
                <label class="hf-inline">${t('count')} <input class="text_pole hf-num" type="number" id="hf_gen_count" min="1" max="20" value="${s.count}"></label>
                <button class="hf-btn primary" data-hf="generate" ${dis}>${ui.busy ? t('generating') : t('generate')}</button>
            </div>
            <div class="hf-actions">
                <button class="hf-btn" data-hf="lore-scan" ${dis}>${t('scan_lore')}</button>
                <button class="hf-btn" data-hf="add">${t('add_own')}</button>
            </div>
            <div class="hf-actions">
                <button class="hf-btn small" data-hf="exp-holidays"><i class="fa-solid fa-download"></i> ${t('io_short_exp')}</button>
                <button class="hf-btn small" data-hf="profile-import"><i class="fa-solid fa-upload"></i> ${t('io_short_imp')}</button>
            </div>
            <input type="file" id="hf_import_file" accept=".json,application/json" hidden></div>
        <div class="hf-filters">${filters.map((f) => `<button class="hf-pill ${ui.filter === f ? 'on' : ''}" data-hf="filter" data-f="${f}">${f === 'all' ? t('all') : '<i class="fa-solid ' + TYPES[f].fa + '"></i> ' + t('type_' + f)}</button>`).join('')}</div>
        ${list.map((h) => holidayCard(h, cal)).join('') || `<div class="hf-empty"><p>${t('nothing_here')}</p></div>`}`;
}

function iconPickerHtml(cur) {
    const btn = (key, fa, label) => `<button type="button" class="hf-ip ${cur === key ? 'on' : ''}" data-hf="pick-icon" data-icon="${key}" title="${esc(label)}"><i class="fa-solid ${fa}"></i></button>`;
    return btn('', 'fa-wand-magic-sparkles', t('icon_auto')) + ICON_WORDS.map((k) => btn(k, ICONS[k], k)).join('');
}

function viewEditor(cal) {
    const h = ui.editing === 'new'
        ? { name: '', month: 1, day: 1, year: '', type: 'cultural', description: '', traditions: '', tone: '', repeat: true, ...(ui.editDraft || {}) }
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
        <label class="checkbox_label"><input type="checkbox" id="hf_e_repeat" ${h.repeat !== false ? 'checked' : ''}><span>${t('repeat_opt')}</span></label>
        <div class="hf-h">${t('icon')}</div>
        <div class="hf-iconpick">${iconPickerHtml(ui.editIcon)}</div>
        <div class="hf-actions"><button class="hf-btn primary" data-hf="save-holiday">${t('save')}</button><button class="hf-btn" data-hf="cancel-edit">${t('cancel')}</button></div>
        <div class="hf-sub">${t('editor_note')}</div></div>`;
}

function weekdayNames() {
    try {
        const f = new Intl.DateTimeFormat(lang(), { weekday: 'short', timeZone: 'UTC' });
        return [0, 1, 2, 3, 4, 5, 6].map((i) => f.format(new Date(Date.UTC(2024, 0, 1 + i)))); // 2024-01-01 is a Monday
    } catch { return ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']; }
}

function holidaysOn(cal, y, m, d) {
    return visible().filter((h) => mIdx(cal, h.month) === m && dClamp(cal, h.month, h.day) === d && (!hasFixedYear(h) || +h.year === y));
}

function calStep(dir) {
    const cal = nowParts().cal;
    let m = ui.calM + dir;
    let y = ui.calY;
    if (m < 1) { m = cal.length; y--; } else if (m > cal.length) { m = 1; y++; }
    ui.calM = m; ui.calY = y; ui.calSel = null;
    renderBody();
}

function viewCalendar() {
    const np = nowParts();
    const cal = np.cal;
    const st = C();
    if (ui.calY === null) { ui.calY = np.y; ui.calM = np.m; }
    ui.calM = mIdx(cal, ui.calM);
    const y = ui.calY, m = ui.calM, nd = cal[m - 1].days;
    let off = 0, heads = '';
    if (P().calendarType !== 'custom') {
        const dt = new Date(Date.UTC(2000, m - 1, 1));
        dt.setUTCFullYear(y);
        off = (dt.getUTCDay() + 6) % 7;
        heads = weekdayNames().map((w) => `<div class="hf-wd">${esc(w)}</div>`).join('');
    }
    let cells = '';
    for (let i = 0; i < off; i++) cells += '<div class="hf-day empty"></div>';
    for (let d = 1; d <= nd; d++) {
        const hs = holidaysOn(cal, y, m, d);
        const isToday = y === np.y && m === np.m && d === np.d;
        const past = y < np.y || (y === np.y && (m < np.m || (m === np.m && d < np.d)));
        const marks = hs.slice(0, 3).map((h) => `<i class="fa-solid ${holidayIcon(h)} ${celebratedIn(h, y) ? 'done' : ''}" style="--c:${TYPES[h.type]?.color}"></i>`).join('');
        cells += `<button class="hf-day ${isToday ? 'today' : ''} ${past ? 'past' : ''} ${ui.calSel === d ? 'sel' : ''}" data-hf="cal-day" data-d="${d}"><span class="hf-dn">${d}</span><span class="hf-dm">${marks}${hs.length > 3 ? `<small>+${hs.length - 3}</small>` : ''}</span></button>`;
    }
    let html = `<div class="hf-calhead">
        <button class="hf-btn small" data-hf="cal-yprev" aria-label="-1 year"><i class="fa-solid fa-angles-left"></i></button>
        <button class="hf-btn small" data-hf="cal-prev" aria-label="-1 month"><i class="fa-solid fa-chevron-left"></i></button>
        <div class="hf-caltitle">${esc(cal[m - 1].name)} ${y}</div>
        <button class="hf-btn small" data-hf="cal-next" aria-label="+1 month"><i class="fa-solid fa-chevron-right"></i></button>
        <button class="hf-btn small" data-hf="cal-ynext" aria-label="+1 year"><i class="fa-solid fa-angles-right"></i></button></div>
        <div class="hf-calgrid">${heads}${cells}</div>
        <div class="hf-actions"><button class="hf-btn small" data-hf="cal-today"><i class="fa-solid fa-crosshairs"></i> ${t('cal_today')}</button></div>`;

    if (ui.calSel) {
        const hs = holidaysOn(cal, y, m, ui.calSel);
        html += `<div class="hf-card"><div class="hf-h">${esc(fmtDate(cal, y, m, ui.calSel))}</div>`;
        html += hs.length ? hs.map((h) => `<div class="hf-calitem" style="--c:${TYPES[h.type]?.color}">
            <div class="hf-row"><div class="hf-ico">${hIcon(h)}</div><div class="hf-grow"><div class="hf-name">${esc(h.name)}</div><div class="hf-sub">${esc(h.description)}</div></div>${typeChip(h.type)}</div>
            <label class="checkbox_label"><input type="checkbox" data-hf="celebrate-y" data-id="${h.id}" data-y="${y}" ${celebratedIn(h, y) ? 'checked' : ''}><span>${t('cal_celebrated', y)}</span></label>
            <button class="hf-btn small" data-hf="edit" data-id="${h.id}">${t('edit')}</button></div>`).join('') : `<div class="hf-sub">${t('cal_none_day')}</div>`;
        html += `<div class="hf-actions"><button class="hf-btn small" data-hf="cal-add"><i class="fa-solid fa-plus"></i> ${t('cal_add')}</button></div></div>`;
    }

    const mem = visible().map((h) => {
        const c = st.celebrated[h.id];
        const ys = c && typeof c === 'object' ? Object.keys(c).filter((k) => c[k]).map(Number).sort((a, b) => a - b) : [];
        return { h, ys };
    }).filter((x) => x.ys.length);
    html += `<div class="hf-h">${t('cal_memory')}</div><div class="hf-card">${mem.length ? mem.map(({ h, ys }) => `<div class="hf-row" style="--c:${TYPES[h.type]?.color}"><div class="hf-ico">${hIcon(h)}</div><div class="hf-grow"><div class="hf-name">${esc(h.name)}</div><div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))} · ${ys.join(', ')}</div></div></div>`).join('') : `<div class="hf-sub">${t('cal_memory_empty')}</div>`}</div>`;
    return html;
}

function viewHistory() {
    const { cal } = nowParts();
    const st = C();
    const items = visible()
        .filter((h) => isPassed(h) || st.mentions[h.id])
        .map((h) => ({ h, m: st.mentions[h.id], passed: isPassed(h) }))
        .sort((a, b) => (a.m?.last ?? 1e9) - (b.m?.last ?? 1e9));
    const dis = ui.busy || ui.scanning ? 'disabled' : '';
    let html = `<div class="hf-actions"><button class="hf-btn primary" data-hf="scan" ${dis}><i class="fa-solid fa-magnifying-glass"></i> ${ui.scanning ? t('scanning') : t('scan_whole')}</button></div>
        <div class="hf-actions"><button class="hf-btn" data-hf="chat-find" ${dis}><i class="fa-solid fa-wand-magic-sparkles"></i> ${t('find_recent')}</button><button class="hf-btn" data-hf="chat-find-all" ${dis}><i class="fa-solid fa-layer-group"></i> ${t('find_all')}</button></div>
        <div class="hf-sub">${t('hist_help')}</div><div class="hf-sub">${t('hist_note')}</div>`;
    if (!items.length) return html + `<div class="hf-empty"><div class="hf-bigico"><i class="fa-solid fa-scroll"></i></div><p>${t('hist_empty')}</p></div>`;
    html += '<div class="hf-timeline">';
    for (const { h, m, passed } of items) {
        html += `<div class="hf-tl ${passed ? 'done' : ''}" style="--c:${TYPES[h.type]?.color}">
            <div class="hf-dot"></div>
            <div class="hf-tl-body"><div class="hf-name">${hIcon(h)} ${esc(h.name)} <span class="hf-badge">${passed ? t('passed') : t('mentioned')}</span></div>
            <div class="hf-sub">${esc(fmtMD(cal, h.month, h.day))}${m ? ` · ${t('msg')} #${m.first}${m.count > 1 ? `–#${m.last}` : ''} · ×${m.count}` : ''}</div>
            ${m?.snippet ? `<div class="hf-quote">…${esc(m.snippet)}…</div>` : ''}
            <label class="checkbox_label"><input type="checkbox" data-hf="celebrate" data-id="${h.id}" ${celebratedIn(h, nowParts().y) ? 'checked' : ''}><span>${t('mark_cel')}</span></label></div></div>`;
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
        </div>
        ${ioCard()}`;
}

function ioCard() {
    return `<div class="hf-card"><div class="hf-h"><i class="fa-solid fa-file-export"></i> ${t('io_h')}</div>
        <div class="hf-sub">${t('io_export')}</div>
        <div class="hf-actions">
            <button class="hf-btn" data-hf="exp-holidays"><i class="fa-solid fa-download"></i> ${t('io_holidays')}</button>
            <button class="hf-btn" data-hf="exp-world-h"><i class="fa-solid fa-download"></i> ${t('io_world_h')}</button>
            <button class="hf-btn" data-hf="exp-world"><i class="fa-solid fa-download"></i> ${t('io_world')}</button>
            <button class="hf-btn" data-hf="exp-all"><i class="fa-solid fa-download"></i> ${t('io_all')}</button></div>
        <div class="hf-sub" style="margin-top:12px">${t('io_import')}</div>
        <label>${t('io_mode')}<select class="text_pole" id="hf_import_mode"><option value="merge" ${ui.importMode === 'merge' ? 'selected' : ''}>${t('io_merge')}</option><option value="replace" ${ui.importMode === 'replace' ? 'selected' : ''}>${t('io_replace')}</option></select></label>
        <label class="checkbox_label"><input type="checkbox" id="hf_import_hol" ${ui.importHol ? 'checked' : ''}><span>${t('io_with_hol')}</span></label>
        <div class="hf-actions"><button class="hf-btn primary" data-hf="profile-import"><i class="fa-solid fa-upload"></i> ${t('io_file')}</button></div>
        <details><summary>${t('io_paste')}</summary><textarea class="text_pole" id="hf_paste" rows="5"></textarea>
            <div class="hf-actions"><button class="hf-btn" data-hf="import-paste">${t('io_import_paste')}</button></div></details>
        <input type="file" id="hf_import_file" accept=".json,application/json" hidden></div>`;
}

function diagCard() {
    return `<div class="hf-card"><div class="hf-h"><i class="fa-solid fa-stethoscope"></i> ${t('diag_btn')}</div><div class="hf-sub">${t('diag_hint')}</div>
        <div class="hf-actions"><button class="hf-btn primary" data-hf="diag-run">${t('diag_run')}</button><button class="hf-btn" data-hf="diag-copy">${t('diag_copy')}</button></div>
        <textarea class="text_pole hf-diag-area" readonly rows="8">${esc(ui.diagText)}</textarea></div>`;
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
            ${loreSelect()}
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
            ${sel('trackerPos', t('tracker_pos'), [['top', t('tp_top')], ['bottom', t('tp_bottom')]])}
            ${chk('strip', t('strip_opt'))}
            ${chk('toast', t('toast_opt'))}
            ${chk('topLayer', t('toplayer_opt'))}</div>
        ${diagCard()}`;
}

function tabsHtml() {
    return TABS.map(([k, i]) => `<button data-hf="tab" data-tab="${k}"><span>${i}</span>${t('tab_' + k)}</button>`).join('');
}

function busyBanner() {
    if (!ui.busy) return '';
    const p = ui.progress;
    const pct = p ? Math.round((p.done / p.total) * 100) : 0;
    return `<div class="hf-busy"><span class="hf-spin"></span><span class="hf-grow"><span class="hf-busy-label">${t('busy')}${p ? ` ${p.done}/${p.total}` : ''}</span>${p ? `<span class="hf-bar"><i style="width:${pct}%"></i></span>` : ''}</span><button class="hf-btn small" data-hf="cancel">${t('cancel')}</button></div>`;
}

function updateProgress() {
    const el = document.querySelector('.hf-busy');
    if (!el) return renderBody();
    const p = ui.progress;
    if (!p) return;
    const bar = el.querySelector('.hf-bar i');
    if (bar) bar.style.width = `${Math.round((p.done / p.total) * 100)}%`;
    const lab = el.querySelector('.hf-busy-label');
    if (lab) lab.textContent = `${t('busy')} ${p.done}/${p.total}`;
}

const TABS = [['overview', '<i class="fa-solid fa-house"></i>'], ['holidays', '<i class="fa-solid fa-gift"></i>'], ['calendar', '<i class="fa-solid fa-calendar-days"></i>'], ['history', '<i class="fa-solid fa-scroll"></i>'], ['profiles', '<i class="fa-solid fa-earth-europe"></i>'], ['settings', '<i class="fa-solid fa-gear"></i>']];

function renderBody() {
    try {
        renderBodyInner();
    } catch (e) {
        console.error('[Holiday Forge] render failed', e);
        const body = document.querySelector('#hf-sheet .hf-body');
        if (body) body.innerHTML = `<div class="hf-empty"><p>${esc(e?.message || e)}</p></div>`;
    }
}

function renderBodyInner() {
    if (!ui.open) return;
    const body = document.querySelector('#hf-sheet .hf-body');
    if (!body) return;
    const scroll = body.scrollTop;
    if (!hasChat() || !C()) {
        body.innerHTML = `<div class="hf-empty"><div class="hf-bigico"><i class="fa-solid fa-comment"></i></div><p>${t('open_chat')}</p></div>`;
    } else {
        const views = { overview: viewOverview, holidays: viewHolidays, calendar: viewCalendar, history: viewHistory, profiles: viewProfiles, settings: viewSettings };
        body.innerHTML = busyBanner() + views[ui.tab]();
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
    if (today) el.innerHTML = `<i class="fa-solid fa-champagne-glasses"></i> <b>${t('today')}:</b> ${esc(today.h.name)}`;
    else if (next) el.innerHTML = `${hIcon(next.h)} <b>${esc(next.h.name)}</b> <span class="hf-cd-inline" data-serial="${next.serial}">${inlineCd(next.mins)}</span> <small>${esc(fmtMD(cal, next.h.month, next.h.day))}</small>`;
    else el.innerHTML = '<i class="fa-solid fa-calendar-days"></i> Holiday Forge';
}

/* ----------------------------------------------- tracker inside chat messages */

function ringInner(mins) {
    const days = Math.floor(Math.max(0, mins) / 1440);
    const hrs = Math.floor((Math.max(0, mins) % 1440) / 60);
    const R = 15.5;
    const CIRC = 2 * Math.PI * R;
    const prog = mins <= 0 ? 1 : clamp(1 - days / 60, 0.05, 1);
    const label = mins <= 0 ? '<i class="fa-solid fa-champagne-glasses"></i>' : days >= 1 ? `${days}` : `${hrs}${t('s_h')}`;
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="hf-ring-bg" cx="20" cy="20" r="${R}"/><circle class="hf-ring-fg" cx="20" cy="20" r="${R}" stroke-dasharray="${(CIRC * prog).toFixed(1)} ${CIRC.toFixed(1)}" transform="rotate(-90 20 20)"/></svg><b>${label}</b>`;
}

function trackerHtml() {
    const { cal } = nowParts();
    const list = upcoming();
    if (!list.length) {
        return `<div class="hf-tracker hf-tr-empty" data-hf-open="1"><span class="hf-tr-ico-big"><i class="fa-solid fa-calendar-days"></i></span><span class="hf-tr-main"><span class="hf-tr-title">Holiday Forge</span><span class="hf-tr-sub">${esc(visible().length ? nextYearHint() : t('tr_empty') + ' · ' + t('tr_empty_hint'))}</span></span></div>`;
    }
    const todays = list.filter((x) => x.delta === 0);
    const focus = todays[0] || list[0];
    const h = focus.h;
    const others = list.filter((x) => x !== focus && !todays.includes(x)).slice(0, 3);
    const sub = focus.delta === 0
        ? `<b>${t('today')}</b> · ${esc(fmtMD(cal, h.month, h.day))}`
        : `<span class="hf-cd-inline hf-tr-cd" data-serial="${focus.serial}">${inlineCd(focus.mins)}</span> · ${esc(fmtMD(cal, h.month, h.day))}`;
    const row = (x) => `<div class="hf-tr-item" style="--c:${TYPES[x.h.type]?.color}"><span class="hf-tr-ico">${hIcon(x.h)}</span><span class="hf-tr-iname">${esc(x.h.name)}</span><span class="hf-tr-when">${x.delta === 0 ? t('today') : esc(fmtMD(cal, x.h.month, x.h.day)) + ' · ' + whenLabel(x.delta)}</span></div>`;
    return `<details class="hf-tracker" style="--c:${TYPES[h.type]?.color}" ${ui.trackerOpen ? 'open' : ''}>
        <summary>
            <span class="hf-ring" data-serial="${focus.serial}">${ringInner(focus.mins)}</span>
            <span class="hf-tr-main"><span class="hf-tr-title">${hIcon(h)} ${esc(h.name)}</span><span class="hf-tr-sub">${sub}</span></span>
            <span class="hf-tr-chev">▾</span>
        </summary>
        <div class="hf-tr-body">
            <div class="hf-tr-meta">${typeChip(h.type)}${h.tone ? `<span>${esc(h.tone)}</span>` : ''}</div>
            ${h.description ? `<div class="hf-tr-desc">${esc(h.description)}</div>` : ''}
            ${h.traditions ? `<div class="hf-tr-desc"><b>${t('traditions')}:</b> ${esc(h.traditions)}</div>` : ''}
            ${todays.length > 1 ? `<div class="hf-tr-list-h">${t('tr_also')}</div>${todays.slice(1).map(row).join('')}` : ''}
            ${others.length ? `<div class="hf-tr-list-h">${t('tr_closest')}</div>${others.map(row).join('')}` : ''}
            <button class="hf-tr-open" data-hf-open="1">${t('tr_open')}</button>
            <button class="hf-tr-open" data-hf-diag="1"><i class="fa-solid fa-stethoscope"></i> ${t('diag_btn')}</button>
            ${ui.diagText ? `<textarea class="text_pole hf-diag-area" readonly rows="6">${esc(ui.diagText)}</textarea>` : ''}
        </div></details>`;
}

function ensureTracker(force = false) {
    const s = S();
    const chat = document.getElementById('chat');
    if (!chat) return;
    const clear = () => chat.querySelectorAll('.hf-tracker-wrap').forEach((n) => n.remove());
    if (!s.enabled || s.tracker === 'off' || !hasChat() || !C()) return clear();

    const html = trackerHtml();
    const bots = [...chat.querySelectorAll('.mes')].filter((m) => m.getAttribute('is_system') !== 'true' && m.getAttribute('is_user') !== 'true');
    const targets = s.tracker === 'all' ? bots : bots.length ? [bots[bots.length - 1]] : [];
    chat.querySelectorAll('.hf-tracker-wrap').forEach((n) => { if (!targets.includes(n.closest('.mes'))) n.remove(); });

    const top = s.trackerPos !== 'bottom';
    for (const mes of targets) {
        const mt = mes.querySelector('.mes_text');
        if (!mt || !mt.parentElement) continue;
        let wrap = mes.querySelector('.hf-tracker-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'hf-tracker-wrap';
            force = true;
        }
        const inPlace = top ? wrap.nextElementSibling === mt : wrap.previousElementSibling === mt;
        if (!inPlace) { if (top) mt.parentElement.insertBefore(wrap, mt); else mt.after(wrap); }
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
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const slug = (x) => String(x || 'world').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'world';

function memoryOf(list) {
    const st = C();
    const mem = {};
    for (const h of list) {
        const c = st.celebrated[h.id];
        if (c && typeof c === 'object') {
            const ys = Object.keys(c).filter((k) => c[k]).map(Number);
            if (ys.length) mem[h.id] = ys;
        }
    }
    return mem;
}

const exportHead = (kind) => ({ hf: 2, kind, app: 'holiday-forge', version: VERSION, exportedAt: new Date().toISOString() });

function exportHolidays() {
    const list = holidays();
    return { ...exportHead('holidays'), world: P().name, holidays: list, memory: memoryOf(list) };
}

function exportWorld(withHolidays) {
    const o = { ...exportHead('world'), profile: P() };
    if (withHolidays) { o.holidays = holidays(); o.memory = memoryOf(o.holidays); }
    return o;
}

const exportAllWorlds = () => ({ ...exportHead('bundle'), profiles: Object.values(S().profiles) });

function importProfiles(arr, assign) {
    const s = S();
    const ids = [];
    for (const raw of arr) {
        if (!raw || typeof raw !== 'object') continue;
        const id = uid();
        let name = String(raw.name || 'Imported');
        if (Object.values(s.profiles).some((p) => p.name === name)) name += ' (imported)';
        s.profiles[id] = {
            ...newProfile(id, name), world: String(raw.world || ''), faith: String(raw.faith || ''), region: String(raw.region || ''),
            rules: String(raw.rules || ''), calendarType: raw.calendarType === 'custom' ? 'custom' : 'gregorian', months: String(raw.months || ''),
        };
        ids.push(id);
    }
    saveSettingsDebounced();
    if (assign && ids.length === 1 && C()) { C().profileId = ids[0]; saveChat(); }
    return ids.length;
}

function importHolidayList(list, memory, mode) {
    const st = C();
    const cal = calendar(P());
    if (mode === 'replace') { st.holidays = []; st.celebrated = {}; st.mentions = {}; }
    const byName = new Map(st.holidays.map((h) => [h.name.toLowerCase(), h]));
    let added = 0, merged = 0;
    for (const raw of list) {
        if (!raw || !raw.name) continue;
        const key = String(raw.name).trim().toLowerCase();
        let target = byName.get(key);
        if (!target) {
            const month = mIdx(cal, raw.month);
            const yr = parseInt(raw.year, 10);
            target = {
                id: uid(), name: String(raw.name).trim(), month, day: dClamp(cal, month, raw.day), year: Number.isNaN(yr) ? null : yr,
                repeat: raw.repeat !== false, type: TYPES[raw.type] ? raw.type : 'cultural', description: String(raw.description || ''),
                traditions: String(raw.traditions || ''), tone: String(raw.tone || ''), icon: iconKey(raw.icon),
                source: ['manual', 'generated', 'lorebook', 'chat'].includes(raw.source) ? raw.source : 'manual', hidden: !!raw.hidden,
            };
            st.holidays.push(target);
            byName.set(key, target);
            added++;
        } else merged++;
        const ys = memory?.[raw.id];
        if (Array.isArray(ys)) {
            const c = (st.celebrated[target.id] = st.celebrated[target.id] && typeof st.celebrated[target.id] === 'object' ? st.celebrated[target.id] : {});
            for (const y of ys) if (c[y] === undefined) c[y] = true;
        }
    }
    saveChat();
    scanChat();
    return { added, merged };
}

/** Accepts v2 files (holidays / world / bundle), v1 files ({profile, holidays}), a bare profile, or a bare array of holidays. */
function importData(data, mode, withHolidays) {
    const res = { profiles: 0, added: 0, merged: 0 };
    if (Array.isArray(data)) data = { kind: 'holidays', holidays: data };
    if (!data || typeof data !== 'object') throw new Error('not a Holiday Forge file');
    const kind = data.kind || (Array.isArray(data.profiles) ? 'bundle' : data.profile ? 'world' : Array.isArray(data.holidays) ? 'holidays' : data.name !== undefined ? 'world' : null);
    if (!kind) throw new Error('unknown format');
    if (kind === 'bundle') {
        res.profiles = importProfiles(data.profiles || [], false);
    } else if (kind === 'world') {
        res.profiles = importProfiles([data.profile || data], true);
        if (withHolidays && Array.isArray(data.holidays) && hasChat() && C()) Object.assign(res, importHolidayList(data.holidays, data.memory, mode), { profiles: res.profiles });
    } else {
        if (!hasChat() || !C()) throw new Error(t('open_chat'));
        Object.assign(res, importHolidayList(data.holidays || [], data.memory, mode));
    }
    return res;
}

async function doImport(src) {
    try {
        const data = typeof src === 'string' ? JSON.parse(src) : src;
        const r = importData(data, ui.importMode, ui.importHol);
        window.toastr?.success(t('t_io_done', r.profiles, r.added, r.merged));
        refreshAll();
    } catch (e) {
        console.error('[Holiday Forge] import', e);
        window.toastr?.error(`${t('t_invalid')}${e?.message ? ` (${e.message})` : ''}`);
    }
}

async function runBusy(fn, noneKey = 't_lore_none', ms = 180000) {
    if (ui.busy) return;
    const id = ++ui.runId;
    runState = C();
    ui.busy = true;
    renderBody();
    inj.text = '';
    applyInjection();
    try {
        const n = await withTimeout(fn(), ms);
        if (id !== ui.runId) return;
        if (n === -1) window.toastr?.warning(t(noneKey));
        else if (n) window.toastr?.success(t('t_added', n));
        else window.toastr?.info(t('t_nothing'));
        scanChat();
    } catch (e) {
        if (id !== ui.runId) return;
        console.error('[Holiday Forge]', e);
        window.toastr?.error(t('t_fail_d', e?.message || String(e)));
    }
    ui.busy = false;
    ui.progress = null;
    runState = null;
    refreshAll();
    toastToday();
}

function cancelBusy() {
    ui.runId++;
    ui.progress = null;
    ui.busy = false;
    runState = null;
    try { getContext().stopGeneration?.(); } catch { /* ignore */ }
    window.toastr?.info(t('t_cancelled'));
    refreshAll();
}

const actions = {
    open: () => openPanel(),
    close: () => closePanel(),
    tab: (el) => { ui.tab = el.dataset.tab; ui.editing = null; renderBody(); if (['holidays', 'settings'].includes(ui.tab)) loadLoreNames(); },
    goto: (el) => { ui.tab = el.dataset.tab; renderBody(); },
    filter: (el) => { ui.filter = el.dataset.f; renderBody(); },
    generate: () => {
        const c = parseInt(document.getElementById('hf_gen_count')?.value, 10);
        if (c) S().count = clamp(c, 1, 20);
        saveSettingsDebounced();
        const prompt = document.getElementById('hf_gen_prompt')?.value.trim();
        runBusy(() => generate(prompt));
    },
    'scan-date': async () => {
        if (ui.busy) return;
        const id = ++ui.runId;
        runState = C();
        ui.busy = true;
        renderBody();
        inj.text = ''; // the injected (wrong) date must not bias the model
        applyInjection();
        let res = null, err = null;
        try { res = await withTimeout(scanRpDate(), 120000); } catch (e) { err = e; }
        if (id !== ui.runId) return; // cancelled
        ui.busy = false;
        runState = null;
        refreshAll();
        if (err) { console.error('[Holiday Forge]', err); return window.toastr?.error(t('t_fail_d', err?.message || String(err))); }
        if (!res) return window.toastr?.warning(t('t_date_none'));
        if (!confirm(t('c_rpdate', res.label, res.evidence))) return;
        storeClock(res.minutes);
        refreshAll();
        toastToday();
        window.toastr?.success(t('t_date_set', res.label));
    },
    'lore-scan': () => runBusy(scanLorebook),
    'chat-find': () => runBusy(() => findInChat(false), 't_chat_none'),
    'chat-find-all': async () => {
        if (ui.busy) return;
        const msgs = await getFullChat();
        const list = chatList(msgs);
        const n = chunkMessages(list).length;
        if (!n) return window.toastr?.warning(t('t_chat_none'));
        if (!confirm(t('c_whole', list.length, n))) return;
        runBusy(() => findInChat(true, msgs), 't_chat_none', 6 * 3600 * 1000);
    },
    cancel: () => cancelBusy(),
    add: () => { ui.editing = 'new'; ui.editIcon = ''; renderBody(); },
    edit: (el) => { ui.editing = el.dataset.id; ui.editIcon = holidays().find((x) => x.id === el.dataset.id)?.icon || ''; renderBody(); },
    'pick-icon': (el) => {
        ui.editIcon = el.dataset.icon;
        el.parentElement.querySelectorAll('.hf-ip').forEach((b) => b.classList.toggle('on', b === el));
    },
    'cancel-edit': () => { ui.editing = null; ui.editDraft = null; renderBody(); },
    'save-holiday': () => {
        const cal = nowParts().cal;
        const v = (id) => document.getElementById(id)?.value.trim() ?? '';
        const name = v('hf_e_name');
        if (!name) return window.toastr?.warning(t('t_name'));
        const month = mIdx(cal, v('hf_e_month'));
        const yr = v('hf_e_year');
        const repeat = document.getElementById('hf_e_repeat')?.checked !== false;
        const data = {
            name, month, day: dClamp(cal, month, v('hf_e_day')), year: yr !== '' ? parseInt(yr, 10) : repeat ? null : nowParts().y,
            type: v('hf_e_type'), tone: v('hf_e_tone'), icon: ui.editIcon || '', repeat, description: v('hf_e_desc'), traditions: v('hf_e_trad'),
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
        ui.editDraft = null;
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
    celebrate: (el) => { setCelebrated(el.dataset.id, nowParts().y, el.checked); saveChat(); refreshAll(); },
    'celebrate-y': (el) => { setCelebrated(el.dataset.id, +el.dataset.y, el.checked); saveChat(); refreshAll(); },
    'cal-prev': () => calStep(-1),
    'cal-next': () => calStep(1),
    'cal-yprev': () => { ui.calY--; ui.calSel = null; renderBody(); },
    'cal-ynext': () => { ui.calY++; ui.calSel = null; renderBody(); },
    'cal-today': () => { const np = nowParts(); ui.calY = np.y; ui.calM = np.m; ui.calSel = np.d; renderBody(); },
    'cal-day': (el) => { ui.calSel = +el.dataset.d; renderBody(); },
    'cal-add': () => { ui.editing = 'new'; ui.editIcon = ''; ui.editDraft = { month: ui.calM, day: ui.calSel, year: '' }; ui.tab = 'holidays'; renderBody(); },
    'diag-run': () => runDiag(),
    'diag-copy': async () => { if (ui.diagText) { const ok = await copyText(ui.diagText); window.toastr?.[ok ? 'success' : 'info'](t(ok ? 'diag_copied' : 'diag_ready')); } },
    scan: async () => {
        if (ui.scanning) return;
        ui.scanning = true;
        renderBody();
        let r = null;
        try { r = scanChat(await getFullChat()); } catch (e) { dlog('scan: ' + (e?.message || e)); r = scanChat(); }
        ui.scanning = false;
        refreshAll();
        if (!r) return;
        if (!r.holidays) window.toastr?.warning(t('t_scan_noh'));
        else if (!r.found) window.toastr?.info(t('t_scan_zero', r.holidays, r.messages));
        else window.toastr?.success(t('t_scan_res', r.found, r.messages));
    },
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
        el.innerHTML = t('thinking');
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
    'exp-holidays': () => {
        if (!holidays().length) return window.toastr?.warning(t('t_io_empty'));
        download(`holiday-forge-holidays-${slug(P().name)}.json`, JSON.stringify(exportHolidays(), null, 2));
    },
    'exp-world-h': () => download(`holiday-forge-world-${slug(P().name)}.json`, JSON.stringify(exportWorld(true), null, 2)),
    'exp-world': () => download(`holiday-forge-world-${slug(P().name)}-profile.json`, JSON.stringify(exportWorld(false), null, 2)),
    'exp-all': () => download('holiday-forge-all-worlds.json', JSON.stringify(exportAllWorlds(), null, 2)),
    'import-paste': () => {
        const txt = document.getElementById('hf_paste')?.value.trim();
        if (txt) doImport(txt);
    },
    'profile-import': () => document.getElementById('hf_import_file')?.click(),
};

async function importFile(file) {
    try { await doImport(await file.text()); } catch (e) { window.toastr?.error(t('t_invalid')); }
}

/* ------------------------------------------------------------- panel mount */

function buildPanel() {
    if (document.getElementById('hf-overlay')) return;
    const o = document.createElement('div');
    o.id = 'hf-overlay';
    o.className = 'hf-hidden';
    o.innerHTML = `<div id="hf-sheet" role="dialog" aria-modal="true" aria-label="Holiday Forge">
        <div class="hf-grab"><span></span></div>
        <div class="hf-head"><div class="hf-title"><i class="fa-solid fa-calendar-days"></i> Holiday Forge</div><div class="hf-date"></div>
            <button class="hf-x" data-hf="close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
        <nav class="hf-tabs">${tabsHtml()}</nav>
        <div class="hf-body"></div></div>`;
    document.body.appendChild(o);

    const sh0 = o.querySelector('#hf-sheet');
    o.addEventListener('click', (e) => { if (e.target === o) closePanel(); });
    sh0.addEventListener('click', (e) => {
        const el = e.target.closest('[data-hf]');
        if (!el || el.tagName === 'INPUT') return;
        try { actions[el.dataset.hf]?.(el); } catch (err) { console.error('[Holiday Forge]', err); window.toastr?.error('Holiday Forge: ' + (err?.message || err)); }
    });
    sh0.addEventListener('change', (e) => {
        const el = e.target;
        if (el.dataset.lore !== undefined) {
            const s = S();
            const set = new Set(Array.isArray(s.loreBooks) ? s.loreBooks : []);
            if (el.checked) set.add(el.dataset.lore); else set.delete(el.dataset.lore);
            s.loreBooks = [...set];
            saveSettingsDebounced();
            return;
        }
        if (el.dataset.hf === 'celebrate') return actions.celebrate(el);
        if (el.dataset.hf === 'celebrate-y') return actions['celebrate-y'](el);
        if (el.id === 'hf_profile_pick') { C().profileId = el.value; ui.editingProfile = null; saveChat(); return refreshAll(); }
        if (el.id === 'hf_import_file' && el.files[0]) { importFile(el.files[0]); el.value = ''; return; }
        if (el.id === 'hf_import_mode') { ui.importMode = el.value; return; }
        if (el.id === 'hf_import_hol') { ui.importHol = el.checked; return; }
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
    try {
        openPanelInner();
    } catch (e) {
        console.error('[Holiday Forge] open failed', e);
        window.toastr?.error('Holiday Forge: ' + (e?.message || e));
    }
}

function restoreSheet() {
    const sh = document.getElementById('hf-sheet');
    const o = document.getElementById('hf-overlay');
    if (sh && o && sh.parentElement !== o) o.appendChild(sh);
    const host = document.getElementById('hf_inline_host');
    if (host) host.hidden = true;
    ui.inline = false;
}

function overlayVisible() {
    const sh = document.getElementById('hf-sheet');
    if (!sh) return false;
    const r = sh.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return false;
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height - 8, 30));
    return !!el && sh.contains(el);
}

function enterTopLayer() {
    const o = document.getElementById('hf-overlay');
    try {
        if (o?.showPopover && !o.matches(':popover-open')) {
            o.setAttribute('popover', 'manual');
            o.showPopover();
        }
    } catch (e) { dlog('popover failed: ' + (e?.message || e)); }
}

/** If something in SillyTavern's layout covers the panel, move it to the browser's top layer (and remember that). */
function ensureVisible() {
    if (!ui.open || ui.inline) return;
    if (overlayVisible()) { dlog('panel visible'); return; }
    dlog('panel NOT visible, trying top layer');
    enterTopLayer();
    setTimeout(() => {
        if (!ui.open) return;
        if (overlayVisible()) {
            S().topLayer = true;
            saveSettingsDebounced();
            dlog('visible after top layer; remembered');
        } else {
            dlog('still hidden after top layer');
            window.toastr?.warning(t('t_hidden'));
        }
    }, 300);
}

function openPanelInner() {
    buildPanel();
    restoreSheet();
    ui.open = true;
    document.getElementById('hf-overlay').classList.remove('hf-hidden');
    document.body.classList.add('hf-lock');
    dlog('open panel');
    if (S().topLayer) enterTopLayer();
    if (hasChat() && C()) { ensureClock(); scanChat(); }
    renderBody();
    loadLoreNames();
    setTimeout(ensureVisible, 300);
}

/** Show the panel inside the Extensions drawer instead of a popup (always reachable). */
function openInline() {
    try {
        buildPanel();
        const host = document.getElementById('hf_inline_host');
        const sh = document.getElementById('hf-sheet');
        if (!host || !sh) return;
        host.appendChild(sh);
        host.hidden = false;
        ui.inline = true;
        ui.open = true;
        document.getElementById('hf-overlay').classList.add('hf-hidden');
        dlog('open inline');
        if (hasChat() && C()) { ensureClock(); scanChat(); }
        renderBody();
        host.scrollIntoView?.({ block: 'start' });
    } catch (e) {
        dlog('inline failed: ' + (e?.message || e));
        window.toastr?.error('Holiday Forge: ' + (e?.message || e));
    }
}

function closePanel() {
    const o = document.getElementById('hf-overlay');
    try { if (o?.matches?.(':popover-open')) o.hidePopover(); } catch { /* ignore */ }
    o?.removeAttribute('popover');
    ui.open = false;
    ui.editing = null;
    ui.editDraft = null;
    if (ui.inline) restoreSheet();
    o?.classList.add('hf-hidden');
    document.body.classList.remove('hf-lock');
}

function relocalize() {
    // keep the panel element (it may live in the browser's top layer); only refresh the texts
    const wasInline = ui.inline;
    if (wasInline) restoreSheet();
    document.getElementById('hf_drawer')?.remove();
    document.getElementById('hf_wand')?.remove();
    const nav = document.querySelector('#hf-sheet .hf-tabs');
    if (nav) nav.innerHTML = tabsHtml();
    mountDrawer();
    if (wasInline) openInline();
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
                <div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-calendar-days"></i> Holiday Forge</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
                <div class="inline-drawer-content">
                    <label class="checkbox_label"><input type="checkbox" id="hf_drawer_enabled"><span>${t('drawer_enabled')}</span></label>
                    <div class="menu_button" id="hf_drawer_open"><i class="fa-solid fa-calendar-days"></i> ${t('drawer_open')}</div>
                    <div class="menu_button" id="hf_drawer_inline"><i class="fa-solid fa-table-columns"></i> ${t('inline_btn')}</div>
                    <div class="menu_button" id="hf_drawer_diag"><i class="fa-solid fa-stethoscope"></i> ${t('diag_btn')}</div>
                    <textarea class="text_pole" id="hf_diag_out" rows="8" readonly hidden style="width:100%;font-size:12px"></textarea>
                    <div id="hf_inline_host" class="hf-inline-host" hidden></div>
                </div></div>`;
            host.appendChild(d);
            d.querySelector('#hf_drawer_enabled').addEventListener('change', (e) => { S().enabled = e.target.checked; saveSettingsDebounced(); refreshAll(); });
            d.querySelector('#hf_drawer_open').addEventListener('click', openPanel);
            d.querySelector('#hf_drawer_inline').addEventListener('click', openInline);
            d.querySelector('#hf_drawer_diag').addEventListener('click', runDiag);
            syncDrawer();
        }
    }
    const menu = document.getElementById('extensionsMenu');
    if (menu && !document.getElementById('hf_wand')) {
        const w = document.createElement('div');
        w.id = 'hf_wand';
        w.className = 'list-group-item flex-container flexGap5';
        w.innerHTML = '<div class="fa-solid fa-calendar-days extensionsMenuExtensionButton"></div><span>Holiday Forge</span>';
        w.dataset.hfWand = '1';
        menu.appendChild(w);
    }
}

async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* try the legacy way */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch { return false; }
}

const descEl = (el) => {
    if (!el) return null;
    const parts = [];
    for (let n = el, i = 0; n && i < 3; n = n.parentElement, i++) {
        parts.push(`${String(n.tagName || '').toLowerCase()}${n.id ? '#' + n.id : ''}${typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`);
    }
    return parts.join(' < ');
};

async function testOpen() {
    const res = {};
    try {
        openPanel();
        await new Promise((r) => setTimeout(r, 800));
        const sh = document.getElementById('hf-sheet');
        const r = sh?.getBoundingClientRect();
        res.open = ui.open;
        res.visible = overlayVisible();
        res.sheetRect = r && [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
        res.topAtSheet = r ? descEl(document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height - 8, 30))) : null;
        res.topAtCenter = descEl(document.elementFromPoint(innerWidth / 2, innerHeight / 2));
        res.popoverOpen = !!document.getElementById('hf-overlay')?.matches?.(':popover-open');
        closePanel();
    } catch (e) { res.error = e?.message || String(e); }
    return res;
}

async function collectDiag(withTest) {
    const out = [];
    const add = (k, v) => out.push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    const safe = (f) => { try { return f(); } catch (e) { return `ERR ${e?.message || e}`; } };
    const ctx = safe(() => getContext());
    add('Holiday Forge', VERSION);
    add('UA', safe(() => navigator.userAgent));
    add('viewport', safe(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, vv: visualViewport ? [Math.round(visualViewport.width), Math.round(visualViewport.height)] : null })));
    add('css', safe(() => ({ colorMix: CSS.supports('color', 'color-mix(in srgb, red 50%, blue)'), dvh: CSS.supports('height', '100dvh'), inset: CSS.supports('inset', '0'), backdrop: CSS.supports('backdrop-filter', 'blur(2px)'), popover: 'popover' in HTMLElement.prototype, dialog: typeof HTMLDialogElement })));
    add('ctx', safe(() => ({ keys: Object.keys(ctx).length, chatId: !!chatIdNow(), chatLen: (ctx.chat || []).length, chatHidden: (ctx.chat || []).filter((m) => m?.is_system).length, chatCounted: (ctx.chat || []).filter(isMsg).length, chatMetadata: !!ctx.chatMetadata, characterId: ctx.characterId, groupId: !!ctx.groupId, eventTypes: !!(ctx.eventTypes || ctx.event_types), connMgr: !!ctx.ConnectionManagerRequestService, profiles: profiles().length, quiet: typeof ctx.generateQuietPrompt, setPrompt: typeof ctx.setExtensionPrompt, saveMeta: typeof ctx.saveMetadataDebounced, extSettings: !!ctx.extensionSettings, headers: typeof ctx.getRequestHeaders })));
    add('settings', safe(() => { const s = { ...S() }; s.profiles = Object.keys(s.profiles).length; return s; }));
    add('state', safe(() => { const st = C(); return st ? { holidays: st.holidays.length, mentions: Object.keys(st.mentions).length, celebrated: Object.keys(st.celebrated).length, clock: st.clock } : null; }));
    add('ui', safe(() => ({ tab: ui.tab, open: ui.open, busy: ui.busy, inline: ui.inline })));
    add('dom', safe(() => {
        const q = (x) => document.querySelector(x);
        const o = q('#hf-overlay');
        const cs = o ? getComputedStyle(o) : null;
        const sh = q('#hf-sheet');
        const r = sh ? sh.getBoundingClientRect() : null;
        const bs = getComputedStyle(document.body);
        return {
            overlay: !!o, hiddenClass: o?.classList.contains('hf-hidden'), display: cs?.display, position: cs?.position, z: cs?.zIndex, visibility: cs?.visibility, opacity: cs?.opacity,
            parent: o?.parentElement?.tagName, popoverAttr: o?.getAttribute('popover'), sheetRect: r && [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
            body: { transform: bs.transform, filter: bs.filter, overflow: bs.overflow, position: bs.position, contain: bs.contain },
            openDialogs: document.querySelectorAll('dialog[open]').length, widgets: document.querySelectorAll('.hf-tracker-wrap').length,
            drawer: !!q('#hf_drawer'), wand: !!q('#hf_wand'), strip: !!q('#hf-strip'), extContainer: !!(q('#extensions_settings2') || q('#extensions_settings')),
        };
    }));
    if (withTest) add('openTest', await testOpen());
    add('log', diagLog.slice(-30));
    return out.join('\n');
}

function syncDiag() {
    document.querySelectorAll('.hf-diag-area, #hf_diag_out').forEach((el) => { el.value = ui.diagText; el.hidden = false; });
}

async function runDiag() {
    ui.diagText = '…';
    syncDiag();
    const text = await collectDiag(!ui.open);
    ui.diagText = text;
    syncDiag();
    ensureTracker(true);
    if (ui.open) renderBody();
    const ok = await copyText(text);
    window.toastr?.[ok ? 'success' : 'info'](t(ok ? 'diag_copied' : 'diag_ready'));
}

function mountPoll() {
    let n = 0;
    const iv = setInterval(() => {
        n++;
        try { mountDrawer(); } catch (e) { console.warn('[Holiday Forge] mount', e); }
        const done = document.getElementById('hf_drawer') && document.getElementById('hf_wand');
        if (done || n >= 60) clearInterval(iv);
    }, 500);
}

function syncDrawer() {
    const c = document.getElementById('hf_drawer_enabled');
    if (c) c.checked = S().enabled;
}

/* -------------------------------------------------------------------- init */

async function onChat() {
    if (ui.busy) { ui.runId++; ui.busy = false; runState = null; }
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
    document.querySelectorAll('.hf-ring').forEach((el) => { el.innerHTML = ringInner(+el.dataset.serial * 1440 - total); });
    if (S().flow > 0) { toastToday(); refreshInjection(); }
}

jQuery(async () => {
    try {
        S();
        mountPoll();
        buildPanel();

        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.open) closePanel(); });
        document.addEventListener('toggle', (e) => { if (e.target?.classList?.contains('hf-tracker')) ui.trackerOpen = e.target.open; }, true);
        document.addEventListener('click', (e) => {
            if (e.target.closest?.('[data-hf-wand]')) { dlog('wand click'); setTimeout(openPanel, 80); }
            else if (e.target.closest?.('[data-hf-diag]')) runDiag();
            else if (e.target.closest?.('[data-hf-open]')) openPanel();
        });

        const chatEl = document.getElementById('chat');
        if (chatEl) {
            new MutationObserver(() => {
                clearTimeout(obsTimer);
                obsTimer = setTimeout(() => ensureTracker(false), 150);
            }).observe(chatEl, { childList: true });
        }

        const ctx = getContext();
        const es = ctx.eventSource;
        const ev = ctx.eventTypes || ctx.event_types || {};
        const on = (name, fn) => { if (ev[name]) es.on(ev[name], fn); };
        const later = () => setTimeout(() => ensureTracker(false), 200);

        on('APP_READY', () => { mountDrawer(); onChat(); });
        on('CHAT_CHANGED', onChat);
        on('MESSAGE_RECEIVED', () => { scheduleScan(); refreshInjection(); later(); });
        on('MESSAGE_SENT', () => { scheduleScan(); refreshInjection(); });
        on('MESSAGE_DELETED', () => { scheduleScan(); later(); });
        ['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED'].forEach((n) => on(n, later));
        on('GENERATION_STARTED', async (type, _params, dryRun) => {
            if (type === 'quiet' || dryRun) return applyInjection();
            await refreshInjection();
        });

        setInterval(tick, 5000);
        onChat();
        if (S().seen !== VERSION) {
            S().seen = VERSION;
            saveSettingsDebounced();
            setTimeout(() => window.toastr?.success(`Holiday Forge ${VERSION} loaded`), 1500);
        }
    } catch (e) {
        console.error('[Holiday Forge] init failed', e);
        window.toastr?.error('Holiday Forge failed to start: ' + (e?.message || e));
    }
});

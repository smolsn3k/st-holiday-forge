# Holiday Forge

A SillyTavern extension that **generates and tracks holidays and celebrations for your RP world**, shows a live countdown right inside the bot's message, and makes characters aware of what is coming up.

Works on PC and mobile. Follows your active SillyTavern theme. English and Russian.

🇷🇺 [Русская версия ниже](#русская-версия)

---

## Features

- **LLM holiday generation**: reads the character card, world info and chat, then creates holidays with name, date, type (religious / cultural / seasonal / personal), description, traditions, tone and an icon.
- **World profiles**: world name, faith system, region, calendar (Gregorian or your own custom months) and custom rules. Each chat can use a different profile.
- **Manual editor**: add, edit, hide or delete holidays. Your own entries override generated ones. Pick an icon, choose "repeats every year" or one-off.
- **In-chat widget**: sits at the top or bottom of the bot's message. Collapsed, it shows a progress ring and a live countdown to the next holiday. Expanded, it shows the description, traditions and the closest holidays.
- **Calendar tab**: month grid with holiday icons, per-year "celebrated" marks, and a memory of which holiday happened in which year. Holidays repeat automatically next year.
- **Chat scan**: finds mentions of your holidays across the **whole** chat (hidden messages included, nothing gets unhidden) and marks what has already passed in the story. A timeline shows past celebrations.
- **Find new in chat**: asks the AI to read the chat (last 40 messages or the whole chat, with a progress bar and cancel) and add holidays that are not in your list yet.
- **Lorebook scan**: pull holidays out of your lorebooks, either the active ones or only the books you pick.
- **Character awareness**: injects a short summary of today's and upcoming holidays into the prompt, with a token budget, depth, frequency and look-ahead window.
- **Per-chat state**: holidays, in-world date and "celebrated" memory belong to the chat, so different RPs never clash.
- **API profile chooser**: run generation through any Connection Manager profile.
- **Import / export**: holidays, one world, one world with its holidays, or all worlds as JSON files. Paste-JSON import for phones.
- **Mobile first**: touch-sized controls, bottom-sheet panel, swipe down to close.

---

## Requirements

- SillyTavern (developed and tested on **1.19.0**, Android Chrome).
- Optional: the built-in **Connection Manager** extension, if you want to pick a separate API profile for generation.

---

## Install from GitHub

### Easiest: from inside SillyTavern

1. Open the **Extensions** panel (the puzzle-piece icon).
2. Click **Install extension**.
3. Paste this URL:

   ```
   https://github.com/smolsn3k/st-holiday-forge
   ```

4. Choose **Install just for me** (or **for all users**) and confirm.
5. Reload SillyTavern if it does not refresh by itself.

### Manual install

Clone or copy the repository into SillyTavern's third-party extensions folder:

```bash
cd SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/smolsn3k/st-holiday-forge
```

(For per-user installs, the folder is `SillyTavern/data/<your-user>/extensions/`.)

The folder must contain `manifest.json`, `index.js` and `style.css` directly inside it, not inside another subfolder.

### Updating

Open **Extensions → Manage extensions** and press the update button next to Holiday Forge, or run `git pull` inside the extension folder. Your settings and per-chat data are kept.

---

## Getting started

1. Open a chat. After a reload you will see a one-time "Holiday Forge loaded" toast.
2. Open the panel in any of these ways:
   - the **magic wand** menu → *Holiday Forge*;
   - **Extensions** list → *Holiday Forge* → *Open Holiday Forge*;
   - the **widget** under a bot message → *Open Holiday Forge*.
3. **Profiles** tab: fill in your world (faith, region, calendar, rules).
4. **Holidays** tab: write an optional hint and press **Generate**.
5. **Overview** tab: set the in-world date (or let time flow automatically in Settings).
6. Chat as usual. The widget shows the countdown; characters get the holiday summary in their prompt.

### Tabs

| Tab | What it does |
| --- | --- |
| Overview | Countdown to the next holiday, today's holidays, next 3, in-world date controls |
| Holidays | Generate, scan lorebook, add/edit/hide/delete, icon picker, export/import |
| Calendar | Month grid, per-year "celebrated" marks, memory of past years |
| History | Scan the chat, find new holidays in the chat, timeline of passed celebrations |
| Profiles | World profiles, plus import/export |
| Settings | Language, API profile, style, injection, tracker position, diagnostics |

---

## Import / export

*Profiles* tab → **Import / Export**.

- **Export**: holidays only, world + holidays, world only, or all worlds. Holiday exports include the "celebrated in year N" memory.
- **Import**: pick a file, or paste JSON. For holidays choose **Merge** (keep existing, add new) or **Replace**. Older v1 files and plain arrays of holidays are accepted too.

---

## Troubleshooting

- **The panel does not open or is hidden.** Settings → enable *Always show the panel above everything*. Or use **Open here (inline)** in the Extensions list, which shows the panel inside the extension drawer.
- **Something else is off.** Press **Diagnostics** (Extensions list, the widget, or the Settings tab). It runs a self-test and copies a technical report you can paste into a GitHub issue.
- **Generation fails or returns nothing.** Try another API profile in Settings, or press **Cancel** and retry. Models that wrap JSON in long reasoning text are handled, but very small models can still produce unusable output.
- **Scan finds fewer messages than expected.** Hidden messages are counted. Diagnostics shows how many messages SillyTavern reports and how many were counted.

### Notes

- The Gregorian calendar has fixed month lengths (no leap years), so in-world dates stay predictable. Use a custom calendar for fantasy worlds.
- Holiday data lives in the chat's metadata. Profiles and settings live in SillyTavern's extension settings.

---

# Русская версия

**Holiday Forge**: расширение для SillyTavern, которое **генерирует и отслеживает праздники вашего ролевого мира**, показывает живой обратный отсчёт прямо в сообщении бота и делает персонажей осведомлёнными о предстоящих праздниках.

Работает на ПК и телефоне, подстраивается под активную тему SillyTavern. Интерфейс на русском и английском.

## Возможности

- **Генерация праздников через LLM** по карточке персонажа, World Info и чату: название, дата, тип, описание, традиции, тон, значок.
- **Профили миров**: название, система верований, регион, календарь (григорианский или свои месяцы), свои правила. Для каждого чата можно выбрать свой профиль.
- **Ручной редактор**: свои праздники заменяют сгенерированные; выбор значка; «повторяется каждый год» или разовый.
- **Виджет в сообщении бота** (вверху или внизу): кольцо прогресса и живой отсчёт до ближайшего праздника; в раскрытом виде описание, традиции и ближайшие праздники.
- **Календарь**: сетка месяца, отметки «отпразднован» по годам, память о прошлых годах. На следующий год праздники повторяются сами.
- **Скан чата** по всему чату (скрытые сообщения тоже учитываются, показывать их не нужно) и хронология прошедших праздников.
- **«Найти новые в чате»** через ИИ: последние 40 сообщений или весь чат, с полосой прогресса и отменой.
- **Скан лорбука**: активные лорбуки или только выбранные вами.
- **Осведомлённость персонажей**: краткая сводка праздников попадает в промпт (лимит токенов, глубина, частота, горизонт).
- **Состояние на чат**: праздники, дата в мире и память не пересекаются между разными чатами.
- **Выбор API-профиля** (Connection Manager) для генерации.
- **Импорт / экспорт** праздников и миров в JSON, в том числе вставкой текста.

## Установка с GitHub

### Через SillyTavern (проще всего)

1. Откройте панель **Extensions** (значок пазла).
2. Нажмите **Install extension**.
3. Вставьте ссылку:

   ```
   https://github.com/smolsn3k/st-holiday-forge
   ```

4. Выберите **Install just for me** (или **for all users**) и подтвердите.
5. При необходимости перезагрузите SillyTavern.

### Вручную

```bash
cd SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/smolsn3k/st-holiday-forge
```

Для установки на пользователя: `SillyTavern/data/<ваш-пользователь>/extensions/`. Файлы `manifest.json`, `index.js`, `style.css` должны лежать прямо в папке расширения.

### Обновление

**Extensions → Manage extensions** → кнопка обновления рядом с Holiday Forge, либо `git pull` в папке расширения. Настройки и данные чатов сохраняются.

## Быстрый старт

1. Откройте чат. После перезагрузки один раз появится уведомление «Holiday Forge loaded».
2. Откройте панель: меню **волшебной палочки** → *Holiday Forge*, или список **Extensions** → *Open Holiday Forge*, или кнопка в виджете под сообщением бота.
3. Вкладка **Профили**: опишите мир (верования, регион, календарь, правила).
4. Вкладка **Праздники**: при желании напишите пожелание и нажмите **Сгенерировать**.
5. Вкладка **Обзор**: задайте дату в мире (или включите ход времени в настройках).

## Если что-то не работает

- **Панель не открывается или скрыта**: в Настройках включите «Всегда показывать панель поверх всего» или нажмите «Открыть здесь (во вкладке)» в списке расширений.
- **Другие проблемы**: кнопка **Диагностика** (список расширений, виджет или вкладка Настройки) запускает самопроверку и копирует технический отчёт, который можно приложить к issue на GitHub.
- **Скан находит меньше сообщений, чем ожидалось**: скрытые сообщения учитываются; в диагностике видно, сколько сообщений сообщает SillyTavern и сколько учтено.

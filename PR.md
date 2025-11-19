## 🔹 PR1 — Ввести модуль `NicesoftLicense` (loader + cache + helpers, без использования)

Ты — Senior-разработчик в форке Rocket.Chat, который я превращаю в NiceChat.

Цель этого шага (PR1):
Ввести НОВЫЙ модуль Nicesoft License Engine (loader + validator-заглушка + in-memory cache + helpers), НЕ трогая существующий @rocket.chat/license и ee-код. На этом этапе модуль НЕ должен использоваться ни в REST, ни в методах — только существовать и успешно собираться.

Контекст:
- Репозиторий пока в оригинальном виде, каталог `ee/` ещё присутствует.
- В дальнейшем я буду удалять `ee/` и `@rocket.chat/license`, но НЕ в этом PR.
- Архитектура будущего движка:
  - Storage: чтение лицензии из ENV или файла `/etc/nicechat/license.json`.
  - Validator: пока можно сделать упрощённый (только парс JSON, без криптографии).
  - Cache: Singleton-сервис, хранящий текущую лицензию в оперативке.
  - Helpers: `isLicensed()`, `hasFeature(id)`, `getLimit(key)`.

Сделай следующее:

1) Создай новый модуль лицензирования:
   - Предлагаемый путь:
     - `apps/meteor/server/lib/nicesoft-license/types.ts`
     - `apps/meteor/server/lib/nicesoft-license/storage.ts`
     - `apps/meteor/server/lib/nicesoft-license/cache.ts`
     - `apps/meteor/server/lib/nicesoft-license/helpers.ts`
     - `apps/meteor/server/lib/nicesoft-license/index.ts`

2) Определи минимальный формат лицензии:
   Структура TypeScript-интерфейса (можно расширять при желании):
   ```ts
   interface NicesoftLicenseDocument {
     product: string;           // "NiceChat"
     edition: string;           // "community" | "pro" | "enterprise"
     valid_from?: string;
     valid_to?: string;
     features?: string[];
     limits?: Record<string, number>;
   }
````

Никакой криптографии в PR1 — просто JSON.

3. Реализуй storage:

   * Чтение из:

     * ENV-переменной `NICECHAT_LICENSE_B64` (base64-строка JSON),
     * fallback: файл `/etc/nicechat/license.json` (или путь из `NICECHAT_LICENSE_PATH`).
   * Если ничего не найдено — возвращать `null` или статус “no license”.

4. Реализуй cache:

   * Singleton с функциями:

     * `reloadLicense(): Promise<void>`
     * `getCurrentLicense(): { valid: boolean; payload?: NicesoftLicenseDocument; reason?: string }`
   * Логика:

     * При reload → дернуть storage, распарсить JSON, сохранить в памяти.
     * Без строгой проверки дат/валидности на этом этапе — достаточно simple “valid if parsed”.

5. Реализуй helpers:

   * `isLicensed()` — true, если есть корректно распарсенный документ.
   * `hasFeature(id: string)` — проверяет `features` в payload.
   * `getLimit(key: string)` — возвращает `limits[key]` или `null`.

6. В `index.ts` экспортируй весь публичный API:

   * `reloadLicense`, `getCurrentLicense`, `isLicensed`, `hasFeature`, `getLimit`.

7. Подключи модуль к сборке:

   * Убедись, что TypeScript-конфиг и импорты не ломаются.
   * НЕ импортируй NicesoftLicense ни из одного другого модуля в этом PR.

8. Напиши базовые юнит-тесты для:

   * успешного чтения лицензии из ENV,
   * fallback на файл,
   * поведения `isLicensed`/`hasFeature`.

9. В конце:

   * Покажи список добавленных файлов и основных типов/функций.
   * Укажи, где лучше всего позже вызывать `reloadLicense()` при старте сервера (например, в `startRocketChatFOSS.ts`), но НЕ добавляй этот вызов в этом PR.

Выведи результат в формате:

* краткое описание архитектуры нового модуля,
* перечень файлов и их содержимое (ключевые части),
* пример использования helpers (комментарием, но без реальной интеграции).

````

---

## 🔹 PR2 — REST API + Admin-страница для лицензии

```text
Контекст:
- В репозитории уже есть модуль `NicesoftLicense` (loader + cache + helpers), добавленный в предыдущем PR.
- Пока он нигде не используется, но умеет:
  - читать JSON из ENV/file,
  - хранить текущее состояние,
  - отдавать `isLicensed()`, `hasFeature()`, `getLimit()`.

Цель PR2:
Добавить REST API и Admin UI для работы с Nicesoft License:
- админ может загрузить лицензию (upload),
- посмотреть текущую лицензию,
- увидеть статус (valid/invalid),
- всё это работает, даже если `ee/` ещё существует.

Задачи:

1) Добавь REST-эндпоинты для лицензии:
   - Файл: что-то вроде `apps/meteor/app/api/server/v1/nicesoftLicense.ts` (точное место подбери по структуре).
   - Маршруты:
     - `GET /api/v1/nicesoft.license.info`
       - authRequired: true, permission: `view-privileged-setting` или аналог.
       - Возвращает:
         - `status`: "valid" | "invalid" | "missing",
         - `payload`: поля лицензии, если есть,
         - `expiresAt`/`valid_to`, если указано.
     - `POST /api/v1/nicesoft.license.upload`
       - authRequired: true, permission: `edit-privileged-setting` или аналог.
       - Принимает JSON `{ license: "<raw JSON or base64>" }` или текст.
       - Сохраняет в файл (например, `/etc/nicechat/license.json`), затем вызывает `reloadLicense()`.
       - Возвращает текущий статус лицензии.

   - Реализуй простую обработку ошибок:
     - некорректный JSON -> 400,
     - ошибка записи файла -> 500.

2) Добавь настройки/setting’и для пути лицензии (по желанию):
   - Например, `Nicesoft_License_File_Path`, если это вписывается в текущую систему settings.
   - Но можно пока и жёстко `/etc/nicechat/license.json`, главное — чтобы это не ломало сборку.

3) Добавь Admin UI:
   - Создай новую страницу в админке, например:
     - `apps/meteor/client/admin/views/NicesoftLicensePage` (посмотри, как устроены остальные admin views).
   - Функционал страницы:
     - При загрузке вызывает `GET /api/v1/nicesoft.license.info`.
     - Показывает:
       - edition,
       - tenant (если есть),
       - valid_to (и сколько дней осталось),
       - список features,
       - список limits.
     - Индикация:
       - зелёный “Licensed” / жёлтый “Missing/Invalid”.
     - Форма загрузки:
       - textarea или file-upload,
       - отправка на `POST /api/v1/nicesoft.license.upload`,
       - показ результата (успех/ошибка).

4) НИГДЕ не делай ещё “гейтинг” по лицензии:
   - Не отключай фичи,
   - не меняй поведение методов,
   - не запрещай логин и т.п.
   - Это только информационный UI + REST.

5) Убедись, что:
   - все импорты не используют `@rocket.chat/license`,
   - админка собирается и работает без `ee`.

В конце:
- опиши, какие файлы ты создал/изменил,
- покажи структуру ответа `GET /api/v1/nicesoft.license.info`,
- покажи скриншот/описание UI (словами), как он выглядит для valid/invalid license.
````

---

## 🔹 PR3 — Перевод LDAP-лимитера на `NicesoftLicense`

```text
Контекст:
- В проекте всё ещё есть `ee/` и `@rocket.chat/license`.
- Уже существует модуль `NicesoftLicense` и admin API/UI для работы с лицензией.
- Но LDAP-импорт и создание пользователей всё ещё завязано на старый License (EE).

Цель PR3:
Переписать логіку ограничения количества активных пользователей (activeUsers) при LDAP-импорте и создании пользователей на новый `NicesoftLicense`, убрав зависимость от `@rocket.chat/license` в этих местах.

Сделай следующее:

1) Найди все места, где LDAP/создание пользователей используют License.*:
   - В частности:
     - `apps/meteor/server/lib/ldap/UserConverter.ts`
     - Любые другие импорты `@rocket.chat/license`, связанные с `activeUsers`.

2) Спроектируй замену:
   - Вместо `License.shouldPreventAction('activeUsers')`:
     - Используй `NicesoftLicense.getLimit('activeUsers')`.
     - Получай текущий `activeUsersCount` через `Users.getActiveLocalUserCount()` или аналогичный метод.
     - Если `maxUsers` задан и `activeUsersCount >= maxUsers`:
       - в LDAP-конвертере и при создании пользователя:
         - либо переводи пользователя в “deleted/blocked”,
         - либо бросай читаемую ошибку (в зависимости от текущего поведения Rocket.Chat).

3) Удали импорт `@rocket.chat/license` из LDAP-конвертера и связанных файлов:
   - Импортируй только `NicesoftLicense` (`isLicensed`, `getLimit`).
   - Убедись, что код компилируется без `@rocket.chat/license` в этих модулей.

4) Обеспечь graceful-degradation:
   - Если лицензии нет (`isLicensed() === false`) или нет лимита `activeUsers`:
     - НЕ блокируй создание пользователей.
     - Веди себя как community-версия без ограничений.

5) Напиши или обнови тесты:
   - Сценарий: нет лицензии → пользователи создаются.
   - Есть лицензия с `activeUsers = 10`, `activeCount = 9` → новый пользователь допускается.
   - Есть лицензия с `activeUsers = 10`, `activeCount = 10` → новый пользователь блокируется / помечается.

В конце:
- перечисли все файлы, где был удалён `@rocket.chat/license`,
- опиши новое поведение для случаев: нет лицензии, лицензия есть, лимит превышен,
- укажи, что это ещё НЕ затрагивает другие части (Omnichannel, cron и т.п.) — только LDAP/создание пользователей.
```

---

## 🔹 PR4 — Перевод Omnichannel (очередь/лимиты) на `NicesoftLicense`

```text
Контекст:
- NicesoftLicense уже умеет давать `getLimit()` и `isLicensed()`.
- LDAP-лимит уже переведён на NicesoftLicense (предыдущий PR).
- Omnichannel-очереди и сервисы всё ещё завязаны на `@rocket.chat/license` и `License.onLimitReached`.

Цель PR4:
Перевести Omnichannel (monthly active contacts, очередь) на NicesoftLicense и убрать зависимости от `@rocket.chat/license` в этих модулях.

Задачи:

1) Найди все точки Omnichannel, где используется License:
   - `apps/meteor/server/services/omnichannel/service.ts`
   - `apps/meteor/server/services/omnichannel/queue.ts`
   - `apps/meteor/app/importer-omnichannel-contacts/server/index.ts`
   - другие файлы, где встречаются `License.hasModule`, `License.onLimitReached`, `License.shouldPreventAction('monthlyActiveContacts')` и т.п.

2) Введи счётчик контактов через NicesoftLicense:
   - В `NicesoftLicense` добавь API для регистрации “счётчиков” (если его ещё нет), например:
     - `registerLimitCounter('monthlyActiveContacts', async () => number)`
   - Для Omnichannel:
     - реализуй функцию, которая считает текущий `monthlyActiveContacts`,
     - передаёт это в NicesoftLicense,
     - NicesoftLicense сравнивает с `limits.monthlyActiveContacts`.

3) Замените события/хэндлеры:
   - Вместо `License.onLimitReached('monthlyActiveContacts', handler)`:
     - используй события своего движка, например:
       - `NicesoftLicense.on('limitReached', (key) => { ... })`.
   - В очереди Omnichannel:
     - при достижении лимита → остановить приём новых задач или пометить их как “blocked by license”.
     - при восстановлении (изменение лицензии) → перезапуск очереди.

4) Удали все импорты `@rocket.chat/license` в Omnichannel-модулях:
   - Замени на импорт твоего `NicesoftLicense` (helpers + events).

5) Грейсфул-поведение:
   - Если нет лицензии или нет лимита `monthlyActiveContacts` → Omnichannel работает как безлимитный CE.
   - При invalid/expired лицензии (если уже реализовано) — можно логировать, но пока не обязательно блокировать.

6) Обнови/дополни тесты Omnichannel:
   - сценарий: нет лицензии → очередь работает;
   - лицензия: `monthlyActiveContacts = 100`, текущий usage=99 → новые задачи принимаются;
   - usage=100 → новые контакты блокируются согласно новой логике.

В конце:
- перечисли файлы, где `@rocket.chat/license` был удалён,
- опиши текущее поведение очередей при разных состояниях лицензии,
- зафиксируй, что другие части (Authorization, cron, REST) пока НЕ трогаем.
```

---

## 🔹 PR5 — Authorization, cron, statistics, federation на `NicesoftLicense`

```text
Контекст:
- LDAP и Omnichannel уже переведены на NicesoftLicense.
- Старый `@rocket.chat/license` всё ещё присутствует в других местах ядра:
  - Authorization service (guest permissions),
  - usageReport cron,
  - статистика EE,
  - federation checks,
  - disableCustomScripts и т.п.

Цель PR5:
Убрать `@rocket.chat/license` из оставшихся частей ядра (Authorization, cron, статистика, federation), заменив их на NicesoftLicense или graceful CE-поведение.

Сделай:

1) Authorization service:
   - Найди импорт `@rocket.chat/license` в:
     - `apps/meteor/server/services/authorization/service.ts`
     - связанных helper’ах.
   - Там, где сейчас `License.hasValidLicense()`/`License.hasModule()` управляет гостевыми правами, переведи на:
     - `NicesoftLicense.isLicensed()` или `hasFeature('guest.advanced')` (feature-ид придумай и зафиксируй).
   - При отсутствии лицензии:
     - возвращай CE-дефолты (минимум прав гостей),
     - не ломай существующих пользователей.

2) usageReport cron:
   - В `apps/meteor/server/cron/usageReport.ts`:
     - убери `AirGappedRestriction` и любые прямые вызовы старого License.
     - Используй `NicesoftLicense.isLicensed()` и `getLimit()` при необходимости.
   - Если лицензии нет → никакого “тайного” ограничения сверху, максимум лог о том, что usage-report работает в CE-режиме.

3) EE statistics:
   - `apps/meteor/app/statistics/server/lib/getEEStatistics.ts` и связанные места.
   - Там, где статистика зависит от наличия EE-модулей:
     - либо полностью отключи EE-поля,
     - либо сделай их условными по `NicesoftLicense.hasFeature('feature.id')`.
   - Удали импорт `@rocket.chat/license` и всё, что завязано на ee-пакеты.

4) Federation:
   - В `checkFederationConfiguration` (поищи по названию и `License.hasValidLicense()`):
     - замени проверку на `NicesoftLicense.isLicensed()` или нужный feature.
     - При отсутствии лицензии → включай только CE-вариант федерации / отключай EE-улучшения спокойно, без падения.

5) disableCustomScripts и прочие “ограничители по лиценции”:
   - `apps/meteor/app/lib/server/functions/disableCustomScripts.ts` и подобные.
   - Если они завязаны на trial/EE статус Rocket.Chat License, переведи на:
     - feature-флаги в NicesoftLicense,
     - или полностью вырежи RC Cloud-специфику.

6) После всех замен:
   - `grep -R "@rocket.chat/license" apps/meteor` — должен показывать только то, что **жёстко принадлежит ee/` (и будет удалено позже).
   - ядро должно собираться и работать даже без @rocket.chat/license (представь, что пакет исчез).

В конце:
- покажи список файлов ядра, где полностью убрана зависимость от @rocket.chat/license,
- опиши, как ведут себя:
  - Authorization,
  - usageReport,
  - EE-статистика,
  - federation —
  при наличии лицензии и без неё.
```

---

## 🔹 PR6 — REST/Meteor gate’ы по фичам (глобальные защиты)

```text
Контекст:
- NicesoftLicense уже работает и используется в LDAP, Omnichannel, Authorization, cron, статах.
- Старый License в ядре больше не нужен (для ee/ останется до fossify).
- Осталось ввести единый механизм “gate’ов” по фичам для REST и Meteor.

Цель PR6:
Добавить единый механизм проверки лицензии для:
- REST-эндпоинтов (до обработки маршрута),
- Meteor-методов (на уровне регистрации/декоратора),

и постепенно заменить использование старого EE-middleware (если ещё есть), чтобы “премиум”-функции могли быть отключены/скрыты.

Задачи:

1) REST gate:
   - Найди место, где регистрируются REST-маршруты:
     - `apps/meteor/app/api/server/api.ts`
     - или аналогичный ApiClass/Router.
   - Добавь механизм опции маршрута, например:
     - `routeOptions.licenseFeature: string | undefined`.
   - Реализуй middleware:
     - если у маршрута есть `licenseFeature`:
       - если `!NicesoftLicense.hasFeature(licenseFeature)` → 403 + JSON-ошибка `"error": "feature-not-licensed"`.
   - Аккуратно подключи этот middleware ко всем REST-маршрутам, не ломая существующую регистрацию.

2) Meteor gate:
   - Создай helper-декоратор, например:
     - `ensureLicensed(featureIds: string[])`.
   - Его задача:
     - оборачивать Meteor method handler:
       - перед выполнением проверять `NicesoftLicense.hasFeature(id)` хотя бы по одному,
       - если нет — бросать `Meteor.Error("feature-not-licensed", ...)`.
   - Применить его к нескольким явным premium-методам (где сейчас была зависимость от EE / лицензии).

3) Связать с feature map:
   - Зафиксируй карту `featureId → смысл` (например, в одном месте):
     - `livechat.enterprise`
     - `audit.log`
     - `omnichannel.advanced`
     - `guest.advanced`, etc.
   - Убедись, что эти id совпадают с теми, что будут приходить в лицензии.

4) Грейсфул-поведение:
   - Для CE-инсталляций (без лицензии или с edition=community):
     - скорее всего, часть featureId просто не будет в лицензии → gate вернёт 403.
   - Не трогай базовую функциональность, если она не должна быть платной.

5) Не трогай то, что будет удалено вместе с ee/:
   - Gate’ы вводим только для того, что останется в FOSS NiceChat и будет управляться NicesoftLicense.

В конце:
- опиши архитектуру gate’ов (REST + Meteor),
- приведите 2–3 примера маршрутов/методов, где ты включил gate,
- покажи, как это связано с `features[]` в лицензии.
```

---

## 🔹 PR7 — `fossify.ts`, удаление `ee/`, чистка импорта, FOSS + своё лицензирование

```text
Контекст:
- NicesoftLicense реализован и используется в ядре (LDAP, Omnichannel, Authorization, cron, etc.).
- REST/Meteor gate’ы готовы.
- @rocket.chat/license больше не нужен ядру — только EE-кодом.
- Цель — перейти к полностью FOSS-сборке NiceChat: без ee/, без RC License Engine, с собственным лицензированием.

Цель PR7:
Финализировать переход:
- гарантированно удалить ee/ и зависимость от @rocket.chat/license,
- убедиться, что FOSS-сборка (после `scripts/fossify.ts`) собирается и работает с NicesoftLicense,
- привести build/packaging (включая spec) в консистентное состояние.

Задачи:

1) Обнови/проверь `scripts/fossify.ts`:
   - Убедись, что скрипт:
     - удаляет каталог `ee/`,
     - удаляет `apps/meteor/ee/**`,
     - удаляет любые ссылки на EE-модули из точек входа (startRocketChat.ts → startRocketChatFOSS.ts).
   - Добавь комментарии/логирование, чтобы было понятно, что это “FOSS/MIT-only build”.

2) Убедись, что ядро НЕ импортирует @rocket.chat/license:
   - до запуска fossify:
     - `grep -R "@rocket.chat/license" apps/meteor` — должны остаться только `ee/` или файлы, которые fossify удалит.
   - при необходимости:
     - вырежи/замени остатки импортов в ядре на NicesoftLicense.

3) Прогон FOSS-сборки:
   - Локально (или в CI) прогоняешь:
     - `yarn install`
     - `yarn fossify`
     - `yarn build`
   - Чинишь ошибки сборки, если вдруг остались ссылки на ee-пакеты.

4) Интеграция с packaging (RPM spec / Docker / Helm):
   - Убедись, что в spec-файле:
     - используется тарбол Rocket.Chat,
     - вызывается `yarn fossify` до сборки,
     - далее — твой ребрендинг (NiceChat),
     - NicesoftLicense читает файл `/etc/nicechat/license.json` (или соответствующий путь).
   - При необходимости:
     - обнови systemd unit, пути `/opt/nicechat`, `/var/lib/nicechat`, `/etc/nicechat`.

5) Финальная чистка:
   - Убедись, что в репозитории:
     - нет каталога `ee/` в FOSS-ветке,
     - нет ссылок на Rocket.Chat Cloud License Engine,
     - NicesoftLicense — единственный движок лицензирования в ядре.

6) Smoke-тест:
   - Запусти FOSS-сборку:
     - без лицензии → приложение стартует, базовый функционал работает, premium-фичи gated.
     - с валидной лицензией → premium-фичи включены, лимиты работают (LDAP/Omnichannel).

В конце:
- опиши, как теперь выглядит FOSS-пайплайн (от tar.gz до работающего NiceChat),
- перечисли, какие зависимости/фичи Rocket.Chat EE полностью исчезли,
- зафиксируй, что весь лицензный функционал теперь основан на NicesoftLicense.
```

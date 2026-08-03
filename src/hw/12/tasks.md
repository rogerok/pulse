HW-EFF-12-ADD-CLI ★★ Реализуй pulse monitor add | list | remove. Args через Schema (URL валидируется), Options для
--interval и --expect-status с дефолтами, типизированные ошибки StorageError (already-exists, not-found) превращаются в
exit-код 1 с понятным сообщением. Тест: три сценария (add нового, add повторного, remove несуществующего) дают разные
коды возврата.

HW-EFF-12-WATCH ★★ Команда pulse watch рисует ANSI-таблицу со всеми мониторами и их состоянием. Перерисовка каждые 500
мс через Schedule.spaced. SIGINT очищает экран и возвращает alternate-screen через finalizer Scope, не через process.on.
Доп: клавиша q тоже завершает программу через Deferred и Effect.race.

init Команда pulse init спрашивает три вопроса через Prompt: имя проекта (текст с валидацией), интервал по умолчанию
(select из трёх вариантов), писать ли JSONL (toggle). Если включён JSONL, дополнительный prompt-вопрос про путь к файлу.
Конфиг пишется в ./pulse.json через сервис Config.

serve Команда pulse serve --port 8080 поднимает NodeHttpServer через HttpApiBuilder. Endpoint-ы: GET /status, GET
/api/monitors, GET /api/monitors/:id, POST /api/monitors. Схемы запросов и ответов из HttpApi, handler-ы тянут Storage и
Sla из MainLive. Тест: после двух pulse monitor add ... curl :8080/api/monitors отдаёт массив из двух элементов, curl :
8080/status отдаёт JSON с monitors: 2.

HW-EFF-12-SSE ★★★ Endpoint GET /events стримит события из MonitorEvents (урок 07) как SSE. Реализация через
Stream.fromPubSub плюс Stream.map (encodeSse) плюс HttpServerResponse.stream. Тест на TestClock: при интервале пробинга
30 секунд за виртуальные 90 секунд клиент получает ровно три SSE-фрейма с правильным event:
и валидным JSON в data:.
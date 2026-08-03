/*
Сделай Bootstrap-сервис через Effect.makeLatch(false).
Init-fiber через Effect.forkScoped зовёт loadConfig, потом latch.open.
Десять worker-ов делают bootstrap.ready.await и пишут “started” в журнал.
Тест: до open ни одного “started” нет, после open все десять появляются почти одновременно.
*/

import { Effect } from "effect";

import { ConfigService } from "./config.ts";

export class Bootstrap extends Effect.Service<Bootstrap>()("Pulse/Bootstrap", {
  scoped: Effect.gen(function* () {
    // Latch создаётся закрытым: все await-ы будут ждать, пока init-fiber не вызовет open.
    const ready = yield* Effect.makeLatch(false);
    const configService = yield* ConfigService;

    const init = Effect.gen(function* () {
      yield* Effect.log("bootstrap: started");

      // Bootstrap ждёт готовности ConfigService.
      // Если загрузка упадёт, latch не откроется и worker-ы не стартуют.
      yield* configService.load;

      // Один open отпускает все fiber-ы, которые уже стоят на ready.await.
      yield* ready.open;
    });

    // forkScoped привязывает init-fiber к lifetime сервиса:
    // при закрытии scope fiber будет корректно прерван.
    yield* Effect.forkScoped(init);

    // Наружу отдаём только сигнал готовности, без самого конфига.
    return { ready };
  }),
}) {}

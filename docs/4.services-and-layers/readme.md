## Сервис через Context.Tag

`Context.Tag` - тег (имя сервиса) + форма (методы с)

```ts
class HttpService extends Context.Tag('Pulse/HttpService')<
  HttpService,
  {
    readonly get: (url: string) => Effect.Effect<Response, NetworkError>;
    readonly post: (url: string, body: unknown) => Effect.Effect<Response, NetworkError>;
  }
>() {
}
```

В генераторе `Effect.gen` сервис достаётся через `yield*` - `const service = yield* HttpService`;

Подложить реализацию можно через `provideService`

```ts
const httpLive = {
  get: (url: string) =>
    Effect.tryPromise({
      try: () => fetch(url).then((r) => ({ status: r.status, body: '' })),
      catch: (cause) => new NetworkError({ url, cause }),
    }),
  post: (url: string, body: unknown) =>
    Effect.tryPromise({
      try: () =>
        fetch(url, { method: 'POST', body: JSON.stringify(body) }).then((r) => ({
          status: r.status,
          body: '',
        })),
      catch: (cause) => new NetworkError({ url, cause }),
    }),
};


const program = probe('https://github.com').pipe(Effect.provideService(HttpService, httpLive));
```

## Effectful constructor

Конструктор может быть эффектом, если требуется асинхронная инициализация: открыть соединение, прочитать конфиг и т.д.

```ts
const HttpServiceLive = Effect.gen(function* () {
  yield* Effect.logInfo('HttpService готов');

  return {
    get: (url: string) =>
      Effect.tryPromise({
        try: () => fetch(url).then((r) => ({ status: r.status, body: '' })),
        catch: (cause) => new NetworkError({ url, cause }),
      }),
    post: (url: string, body: unknown) => Effect.die('not implemented'),
  };
});

const program = probe('https://github.com').pipe(
  Effect.provideServiceEffect(HttpService, HttpServiceLive),
);
```

## Layer

Каждый `provideServiceEffect` создает новый экземпляр.
Layer мемоизирует сборку. Если один и тот же Layer используется в графе несколько раз, сервис строится один раз и
переиспользуется.

```ts
const HttpLive = Layer.effect(HttpService, Effect.gen(function* () {
  yield* Effect.logInfo('HttpService ready');

  return {
    get: (url) => Effect.succeed({ status: 200, body: '' })
  }
}))
```

Подкладывается Layer через `Effect.provide`

```ts
const program = probe('https://github.com').pipe(Effect.provide(HttpLive));
// program: Effect<Response, NetworkError, never>
```

Здесь слева от `.pipe(...)` стоит программа `Effect`, поэтому используется `Effect.provide`.
Он дает зависимости программе.

`Layer.provide` нужен в другой ситуации: когда слева от `.pipe(...)` стоит сам `Layer`, и мы хотим закрыть
зависимости одного слоя другим слоем.

### Layer с зависимостью

`Storage` требует `Logger`

```ts
import { Effect } from "effect";

class Logger extends Context.Tag('Module/Logger')<Logger, { readonly info: (msg: string) => Effect.Effect<void> }>() {
}

class Storage extends Context.Tag('Module/Storage')<Storage, {
  readonly append: (event: MonitorEvent) => Effect.Effect<void, StorageEvent>
}>() {
}

const StorageLive = Layer.effect(Storage, Effect.gen(function* () {
  const logger = yield* Logger;

  return {
    append: (event) => Effect.gen(function* () {
      yield* logger.info(`appending ${event._tag}`)
    })
  }
}))

```

### Подложить зависимость через `Layer.provide`

```ts
const LoggerLive = Layer.succeed(Logger, {
  info: (msg) => Effect.sync(() => console.log(msg))
})

const StorageWithLogger = StorageLive.pipe(Layer.provide(LoggerLive));

```

`Layer.succeed` - синхронный конструктор: подкладываем готовый объект.

В этом примере есть два слоя:

```ts
LoggerLive
StorageLive
```

Они делают разные вещи.

`LoggerLive` дает готовый `Logger`:

```ts
const LoggerLive = Layer.succeed(Logger, {
  info: (msg) => Effect.sync(() => console.log(msg)),
});
```

Тип можно читать так:

```ts
// Layer<что дает, ошибка, что требует>
Layer<Logger, never, never>
```

То есть:

```ts
LoggerLive: Layer<Logger, never, never>
```

Означает:

- слой дает `Logger`;
- слой не падает;
- слой ничего не требует.

`StorageLive` устроен иначе:

```ts
const StorageLive = Layer.effect(
  Storage,
  Effect.gen(function* () {
    const logger = yield* Logger;

    return {
      append: (event) =>
        Effect.gen(function* () {
          yield* logger.info(`appending ${event._tag}`);
        }),
    };
  }),
);
```

Внутри `StorageLive` есть строка:

```ts
const logger = yield * Logger;
```

Значит, чтобы собрать `Storage`, этому слою нужен `Logger`.

Тип такого слоя:

```ts
StorageLive: Layer<Storage, never, Logger>
```

Читается так:

- слой дает `Storage`;
- слой не падает;
- слой требует `Logger`.

Теперь подставляем `LoggerLive` внутрь `StorageLive`:

```ts
const StorageWithLogger = StorageLive.pipe(
  Layer.provide(LoggerLive),
);
```

`Layer.provide(LoggerLive)` говорит:

```ts
// Если StorageLive требует Logger,
// возьми Logger из LoggerLive.
```

До `provide`:

```ts
StorageLive: Layer<Storage, never, Logger>
```

После `provide`:

```ts
StorageWithLogger: Layer<Storage, never, never>
```

Требование `Logger` исчезло, потому что мы уже закрыли его через `LoggerLive`.

Итог:

```ts
const StorageWithLogger = StorageLive.pipe(
  Layer.provide(LoggerLive),
);
```

Это уже самодостаточный слой:

```ts
StorageWithLogger: Layer<Storage, never, never>
```

Его можно дать программе через `Effect.provide`:

```ts
const program = saveEvent(event).pipe(
  Effect.provide(StorageWithLogger),
);
```

Главное правило:

```ts
Layer.provide(A)
```

подкладывает слой `A` внутрь другого слоя и закрывает его зависимости.

Если слой требует `Logger`:

```ts
Layer<Storage, never, Logger>
```

а ты даешь слой, который производит `Logger`:

```ts
Layer<Logger, never, never>
```

результат больше не требует `Logger`:

```ts
Layer<Storage, never, never>
```

## Утечка зависимостей

Зависимости следует вытягивать в *конструкторе*, а не в методах

```ts
const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const database = yield* Database; // конструктор, тут можно

    return {
      getUser: (id) => database.query(`select * from users where id = ${id}`), // в методе дёргать зависимости нельзя
    };
  }),
).pipe(Layer.provide(DatabaseLive));
```

• `Layer.provideMerge` отличается от `Layer.provide` тем, **что происходит с предоставленной
зависимостью после сборки**.

Допустим, слой репозитория ещё требует базу:

  ```ts
  // производит UserRepository, требует Database
Layer<UserRepository, never, Database>
  ```

А `DatabaseLive`:

  ```ts
  // производит Database, ничего не требует
Layer<Database, never, never>
  ```

Обычный `provide` соединяет их, но оставляет снаружи только репозиторий:

  ```ts
  const AppLive = UserRepositoryLayer.pipe(
  Layer.provide(DatabaseLive),
);

// Layer<UserRepository, never, never>
  ```

Схематично:

  ```text
  DatabaseLive ──> UserRepositoryLayer ──> UserRepository
                    Database скрыта
  ```

`provideMerge` тоже передаёт `Database` репозиторию, но дополнительно сохраняет её в
результате:

  ```ts
  const AppLive = UserRepositoryLayer.pipe(
  Layer.provideMerge(DatabaseLive),
);

// Layer<UserRepository | Database, never, never>
  ```

  ```text
  DatabaseLive ──> UserRepositoryLayer ──> UserRepository
        └───────────────────────────────> Database
  ```

Поэтому программа может запросить оба сервиса:

  ```ts
  Effect.gen(function* () {
  const users = yield* UserRepository;
  const database = yield* Database;
});
  ```

Важная деталь: в первом шаге `UserRepositoryLive` у тебя **уже закрыт** через:

  ```ts
pipe(Layer.provide(DatabaseLive))
  ```

Для наглядности второго шага лучше сначала оставить слой репозитория с требованием
`Database`, а затем отдельно выбрать:

- `Layer.provide(DatabaseLive)` — база скрыта от внешней программы;
- `Layer.provideMerge(DatabaseLive)` — база остаётся доступна внешней программе.

Один и тот же слой `DatabaseLive` при совместной сборке по умолчанию мемоизируется, поэтому
используется один экземпляр, если не применять `Layer.fresh`.

Здесь разделяются зависимости с разным временем жизни:

- `Logger` создаётся один раз и используется всё время работы приложения;
- `CurrentMonitor` меняется при выполнении каждого монитора.

## Почему `Logger` получают в конструкторе

  ```ts
  const logger = yield * Logger;
  ```

Этот код выполняется при создании `StorageLive`. Полученный `logger` сохраняется в замыкании:

  ```ts
  return {
  append: (event) => logger.info(...),
};
  ```

Поэтому сам слой требует `Logger`:

  ```ts
  Layer<Storage, never, Logger>
  ```

После сборки слоя каждый вызов `append` использует один и тот же `Logger`.

## Почему `CurrentMonitor` получают внутри метода

  ```ts
  append: (event: ProbeResult) =>
  Effect.gen(function* () {
    const current = yield* CurrentMonitor;
  })
  ```

Код внутри `Effect.gen` выполняется не во время создания `Storage`, а при каждом запуске эффекта, возвращённого
`append`.

Поэтому разные вызовы могут получить разные значения:

  ```ts
  storage.append(eventA).pipe(
  CurrentMonitor.provide(monitorA),
);

storage.append(eventB).pipe(
  CurrentMonitor.provide(monitorB),
);
  ```

При этом существует один экземпляр `Storage`, но контекст каждого вызова отличается.

## Что означает тип `append`

  ```ts
  Effect<void, StorageError, CurrentMonitor>
  ```

Параметры `Effect` означают:

  ```ts
  Effect<результат, ошибка, требования>
  ```

Следовательно, `append`:

- при успехе возвращает `void`;
- может завершиться с `StorageError`;
- для запуска требует `CurrentMonitor`.

Это требование видно в типе, поэтому нельзя случайно запустить `append` без информации о текущем мониторе.

## Как работает `CurrentMonitor.provide`

  ```ts
  static readonly
provide = (monitor: {
  id: MonitorId;
  url: string;
}) => Effect.provideService(this, monitor);
  ```

Это вспомогательная функция, которая подкладывает конкретное значение `CurrentMonitor` в эффект:

  ```ts
  someEffect.pipe(CurrentMonitor.provide(monitor));
  ```

До предоставления сервиса:

  ```ts
  Effect<A, E, CurrentMonitor>
  ```

После предоставления:

  ```ts
  Effect<A, E, never>
  ```

`never` означает, что требование `CurrentMonitor` удовлетворено.

## Почему контекст ставят вокруг всей probe-операции

  ```ts
  const probeWithContext = (monitor: {
  id: MonitorId;
  url: string;
}) =>
  probe(monitor.url).pipe(
    CurrentMonitor.provide(monitor),
  );
  ```

`CurrentMonitor.provide(monitor)` действует на весь составной эффект `probe`, включая вложенный вызов `Storage.append`.

Схематично:

  ```text
  CurrentMonitor.provide(monitor)
  └── probe
      ├── HTTP-запрос
      ├── создание ProbeResult
      └── Storage.append
          └── yield* CurrentMonitor
  ```

Когда `append` запрашивает `CurrentMonitor`, он получает значение, предоставленное вокруг текущего запуска `probe`.

## Главное различие

  ```text
  Logger
  └── один на всё приложение
      └── получается при создании Storage

  CurrentMonitor
  └── отдельный для каждого запуска probe
      └── получается при выполнении append
  ```

Поэтому `CurrentMonitor` не следует получать при создании `Storage`: тогда один конкретный монитор оказался бы навсегда
привязан к общему экземпляру хранилища.

Формулировку про DI лучше понимать как практическое правило:

> Долгоживущие зависимости обычно получают при создании сервиса, а зависимости конкретной операции оставляют
> требованиями методов.

Это не жёсткое правило Effect, но здесь оно правильно отражает время жизни `Logger`, `Storage` и `CurrentMonitor`.

## `Effect.Service`

Для глобальных сервисов (тех, что строятся один раз и живут до конца программы) Effect ввёл короткую запись,
Effect.Service.

`Effect.Service`

- Объявляет тег
- Выводит форму сервиса из конструктора
- Собирает Layer(`.Default`)
- Подкладывает зависимости.

Не подходит для request-scoped штук (CurrentMonitor, CurrentUser).

`Effect.Service` под капотом добавляет к форме поле `_tag` (идентификатор сервиса).
Это нужно Effect-у, чтобы хранить и доставать сервисы из контекста.

Когда ты собираешь свою тестовую реализацию, не хочется писать _tag руками. Для этого есть Service.make:

```ts
const LoggerSilent = Layer.succeed(
  Logger,
  Logger.make({
    info: () => Effect.void,
    warn: () => Effect.void,
    error: () => Effect.void,
  }),
);
```

## Scoped layers. Ресурсы и фоновые процессы

Scope, область жизни ресурса. Когда scope открывается, в него можно добавлять finalizer-ы (через Effect.addFinalizer).
Когда scope закрывается, все finalizer-ы выполняются в обратном порядке, как в defer в Go. Scope это
явный аналог try/finally, только для асинхронного и параллельного кода.

Layer, требующий Scope, называется scoped layer

```ts
import { Effect } from "effect";

class Storage extends Effect.Service<Storage>()('Pulse/Storage', {
  scoped: Effect.gen(function* () {
    const handle = yield* Effect.aquireRelease(
      Effect.tryPromise(() => fs.open('events.jsonl', 'a')),
      (h) => Effect.promise(() => h.close())
    )

    return {
      append: (event: MonitorEvent) => Effect.tryPromise(() => handle.write(JSON.stringify(event) + '\n'))
    }
  })
}) {
}
```

`Effect.acquireRelease(acquire, release)` гарантирует что `release` выполнится *после* того, как программа использовала
ресурс, независимо от того успехом или провалом она закончилась.
`release` исполняется на закрытии Scope





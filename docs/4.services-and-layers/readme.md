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
const logger = yield* Logger;
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

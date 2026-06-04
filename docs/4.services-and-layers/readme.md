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

`Layer.succceed` - синхронный конструктор: подкладываем готовый объект.
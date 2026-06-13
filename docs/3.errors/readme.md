## Errors

Ошибки следует обрабатывать у вызывающего. Не следует давать им всплывать на пять уровней выше.

`orDie` - если ни одна из ошибок не actionable на уровне, то можно ее перевести в defect.
`Effect.orDie` забирает все ожидаемые ошибки и переводит в `defect`

## Tagged ошибки

```ts
class CustomError extends Data.TaggedError('CustomError')<{
  message: string;
}> {
}
```

Инстанс ошибки сам по себе Effect. `yield*` его внутри gen-блока без обёртки - в `Effect.fail`

```ts

const program = Effect.gen(function* () {
  if (Math.random() < 0.5) {
    return yield* new Boom({ reason: 'orelse' });// return перед yield* нужен для сужения типов
  }
  return 42;
});
```

## catchTag, catchTags, catchAll

| Комбинатор                                   | Что ловит                   | Что остается в типе              |
|----------------------------------------------|-----------------------------|----------------------------------|
| `Effect.catchTag('Tag', handler)`            | только ошибки с этим `_tag` | остальные классы из объединения  |
| `Effect.catchTags({Tag1: h1, Tag2: h2,...})` | несколько тегов сразу       | то, что не перечислено в объекте |
| `Effect.catchAll(handler)`                   | любую ошибку из E           | `never` - канал ошибок очищен    |

`mapError` - если есть необходимость сменить класс ошибки, можно ее мапнуть. Полезно на границах модулей

```ts
const remapped = fetchWithRetry.pipe(
  Effect.mapError((error) => {
    if (error._tag === 'NetworkError') return new StorageError({ cause: error });
    return error;
  }),
);
// remapped: Effect<Response, StorageError | HttpStatusError | TimeoutError, never>
```

## Cause

`Effect.runPromiseExit(p)`  возвращает не `Promise<Exit<A,E>>`.

У `Exit` две ветки `Success(a)`, `Failure(cause)`

В `cause` лежит дерево причин, в котором есть всё что Effect знает про падения.

### Effect.exit

`Effect.exit` - обёртка. Превращает `Effect<A,E,R>` в `Effect<Exit<A,E>, never, R>`: ошибки больше нет в канале `E`, она
вшите в результат как `Exit`-значение

```ts

const exit = await Effect.runPromise(Effect.exit(program))

if (exit._tag === 'Failure') {
  const cause = exit.cause;

  if (Cause.isFailureType(cause)) {
    cause.error // NetworkError
  } else if (Cause.isDie(cause)) {
    cause.defect // unknown
  }
} else {
  exit.value // number
}

```

С помощью type guards `Cause.isFailType`, `Cause.isDie`, `Cause.isInterruptType` можно сузить тип и обратиться безопасно
к полям.

### Effect.sandbox

`Effect.sandbox` - переводит `Cause` в канал `E`

```ts
const sandboxed = Effect.sandbox(program)
// sandboxed: Effect<number, Cause<NetworklError>, never> --- Ошибка имеет тип Cause<E>

sandboxed.pipe(Effect.catchTags({
  Die: (cause) => Effect.sync(() => {
    console.error('defect:', cause.defect)
  }),
  Fail: (cause) => Effect.succeed(0) // cause.error: NetworkError 
}))

```

`Effect.unsandbox` - делает обратное. Кладёт `Cause` назад в правильное место.

### Effect.catchAllCaused

Если поднимать `Cause` наверх не нужно (`sandbox` меняет тип), можно использовать `catchAllCause`:

```ts
const handled = program.pipe(Effect.catchAllCause((cause) => Effect.gen(function* () {
    if (Caus.isDie(cause)) {
      yield* Effect.logError("program failed", { defect: cause.defect })
      return -1
    }

    if (Cause.isInterruptedOnly(cause)) {
      yield* Effect.logInfo('program interrupted')

      return 0
    }

    //......

  }
)))

// handled: Effect<number, never,never> - канал ошибки закрыт 
```

### Typed error в defect: die, dieMessage, orDie

`Effect.die` на инвариант

Например, мы уверены, что в этом месте значение должно быть, если нет, то это баг кода.

```ts
const divideOrDie = (a: number, b: number): Effect.Effect<number> =>
  b === 0
    ? Effect.die(new Error('division by zero is a programmer error'))
    : Effect.succeed(a / b);

// divideOrDie: EffecT<number, never, never>


```

В `E` нет `Error`, `Defect` не виден в типе. Если `divideOrDie` упадет, она упадет через `Cause.die` и снаружи можно
поймать только через `Effect.exit`, `sandbox`, `catchAllCause`

`Effect.dieMessage` - когда сообщения достаточно, а `Error` не нужен

`Effect.orDie`

Если в канале ошибки ни один из классов не actionable, берем `orDie`

Например, конфиг не парсится, нет смысла продолжать. Превращае в `defect`, сверху ловим через единый `catchAllCause`

```ts
const main = loadConfig.pipe(Effect.orDie);

// main: Effect<A, never, never> - канал ошибки never
```

Вызывающий может умереть громко, поставить общий обработчик через `catchAllCause`

Иногда из union'a необходимо **одну** ошибку перевести в defect, остальные оставить

```ts
const program = fetchUser.pipe(Effect.catchTag('BodyContractError', (error) => Effect.die(new Error('api contract drift'))))
// program: Effect<User, NetworkEWrror, never>
```

`orDie` используем, когда решаем, что вверх по стеку реакция не нужна.

### Match

Ошибки можно match'тчить

```ts
export const formatAlert = (error: PulseError): string =>
  Match.value(error).pipe(
    Match.tag('NetworkError', (err) => `[network] ${err.url}:`),
    Match.tag('StorageError', () => `[storage]`),
    Match.exhaustive,
  );
```

Матчимся по полю - `Match.when`

```ts
const describeStatus = Match.type<{
  status: number
}>().pipe(
  Match.when({ status: 200 }, () => 'ok'),
  Match.when({ status: 404 }, () => 'not found'),
  Match.orElse(() => 'unknown')
)
```

## Effect.matchEffect
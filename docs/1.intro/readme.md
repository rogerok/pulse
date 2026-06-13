## Конструкторы

| Конструктор                       | Сигнатура                 | Когда брать                                        |
|-----------------------------------|---------------------------|----------------------------------------------------|
| `Effect.succeed(a)`               | `Effect<A, never, never>` | Когда значение уже есть и ошибок/асинхронности нет |
| `Effect.fail(e)`                  | `Effect<never E, never>`  | Готовая ошибка                                     |
| `Effect.fail(e)`                  | `Effect<never E, never>`  | Готовая ошибка                                     |
| `Effect.sync(() => a)`            | `Effect<A never, never>`  | Синхронный код, который **точно** не падает        |
| `Effect.try({try, catch})`        | `Effect<A E, never>`      | Синхронный код, который **может** упасть           |
| `Effect.tryPromise({try, catch})` | `Effect<A E, never>`      | Обертка над API, которая возвращает Promise        |

## Runtime

| Запуск                     | Возвращает           | Что делает                                                                                                          |
|----------------------------|----------------------|---------------------------------------------------------------------------------------------------------------------|
| `Effect.runPromise(p)`     | `Promise<A>`         | Нормальное завершение через `await`. Ошибка попадает в `catch`                                                      |
| `Effect.runPromiseExit(p)` | `Promise<Exit<A,E>>` | То же, но ошибка остается в `Exit`, а не превращается в `throw`                                                     |
| `Effect.runFork(p)`        | `RuntimeFiber<A,E>`  | Запуск без ожидание результата, можно прервать через `Fiber.interrupt`                                              |
| `Effect.runSync(p)`        | `A`                  | Синхронный запуск. Если внутри асинхронный шаг - падает с `AsyncFiberException`. **Только для синхронных операций** |

Если внутри программы есть хоть один tryPromise, delay, timeout, sleep - запускать через `tryPromise`, `runFork`,
`runPromiseExit`.
`runSync` - упадёт

### runFork

Позволяет запустить программу с возможностью прервать

```ts
const fiber = Effect.runFork(probe('https://example.com'));

process.on('SIGTERM', () => Effect.runFork(Fiber.interrupt(fiber)));
```


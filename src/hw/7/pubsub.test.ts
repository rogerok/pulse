import { Effect, PubSub, Queue, Ref } from "effect";
import { describe } from "vitest";

/*
 Подпиши три consumer-а на monitorEvents через PubSub.bounded(32).
 Каждый должен увидеть все опубликованные события.
 Третий после 5 событий падает с ошибкой через Effect.fail.
 Тест: первые два продолжают получать сообщения,
 число публикаций не падает (нет блокировки на упавшем).
 */

describe("PubSub hw", () => {
  it("", async () => {
    const program = Effect.gen(function* () {
      const pubsub = yield* PubSub.bounded<string>(32);
      // создаем хранилища для каждого подписчика
      const logsFirst = yield* Ref.make<string[]>([]);
      const logsSecond = yield* Ref.make<string[]>([]);
      const logsThirdWithFail = yield* Ref.make<string[]>([]);
      // нужен чтобы не публиковать раньше, чем все подписались
      const subscribedCount = yield* Ref.make(0);
      // нужен чтобы проверить что все публикации завершились
      const publishedCount = yield* Ref.make(0);

      const shouldFailMaxCount = 5;
      const totalSubscribers = 3;

      // Сценарий с одним сломанным подписчиком
      const subscriberWithFail = (name: string, logs: Ref.Ref<string[]>) =>
        // Effect.scoped для того, чтобы после падения подписчика, подписка закрылась
        Effect.scoped(
          Effect.gen(function* () {
            const queue = yield* PubSub.subscribe(pubsub);
            yield* Ref.update(subscribedCount, (n) => n + 1);

            const readOne = Effect.gen(function* () {
              const event = yield* Queue.take(queue);
              const log = `${name}: ${event}`;
              yield* Ref.update(logs, (arr) => [...arr, log]);

              const currentLogs = yield* Ref.get(logs);
              if (currentLogs.length === shouldFailMaxCount) {
                yield* Effect.fail(new Error(name));
              }
            });

            yield* readOne.pipe(Effect.forever);
          }),
        );

      const subscriber = (name: string, logs: Ref.Ref<string[]>) =>
        Effect.scoped(
          Effect.gen(function* () {
            const queue = yield* PubSub.subscribe(pubsub);
            yield* Ref.update(subscribedCount, (n) => n + 1);

            const readOne = Effect.gen(function* () {
              const event = yield* Queue.take(queue);
              const log = `${name}: ${event}`;
              yield* Ref.update(logs, (logs) => [...logs, log]);
            });

            yield* readOne.pipe(Effect.forever);
          }),
        );

      const waitForNumber = (subs: Ref.Ref<number>, expected: number) =>
        Effect.gen(function* () {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          while (true) {
            const curr = yield* Ref.get(subs);

            if (curr >= expected) {
              return curr;
            }

            yield* Effect.sleep("10 millis");
          }
        });

      const waitForLength = (logs: Ref.Ref<string[]>, expected: number) =>
        Effect.gen(function* () {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          while (true) {
            const curr = yield* Ref.get(logs);

            if (curr.length >= expected) {
              return curr;
            }

            yield* Effect.sleep("10 millis");
          }
        }).pipe(
          // таймаут чтобы тест не висел бесконечно, если события не дошли
          Effect.timeoutFail({
            duration: "1 second",
            onTimeout: () => new Error(`Timed out waiting for ${expected} events`),
          }),
        );

      // публикует событие и увеличивает счетчик только после успешного publish
      const publishOne = (event: string) =>
        Effect.gen(function* () {
          yield* PubSub.publish(pubsub, event);
          yield* Ref.update(publishedCount, (n) => n + 1);
        });

      yield* Effect.all([
        Effect.forkScoped(subscriber("first sub", logsFirst)),
        Effect.forkScoped(subscriber("second sub", logsSecond)),
        Effect.forkScoped(subscriberWithFail("sub with fail", logsThirdWithFail)),
      ]);
      // ждем подписки всех трех подписчиков
      yield* waitForNumber(subscribedCount, totalSubscribers);

      // первые пять событий нужны, чтобы подписчик с ошибкой получил 5 событий и упал
      const beforeFailure = Array.from(
        { length: shouldFailMaxCount },
        (_, i) => `beforeFailure-${i + 1}`,
      );
      // публикуем кол-во событий > bounded
      const afterFailure = Array.from({ length: 40 }, (_, i) => `afterFailure-${i + 1}`);

      yield* Effect.forEach(beforeFailure, publishOne);

      const third = yield* waitForLength(logsThirdWithFail, shouldFailMaxCount);

      yield* Effect.forEach(afterFailure, publishOne).pipe(
        Effect.timeoutFail({
          duration: "1 second",
          onTimeout: () => new Error(`Timed out waiting for ${afterFailure} events`),
        }),
      );

      const expectedTotal = beforeFailure.length + afterFailure.length;

      const first = yield* waitForLength(logsFirst, expectedTotal);
      const second = yield* waitForLength(logsSecond, expectedTotal);

      const published = yield* Ref.get(publishedCount);

      expect(published).toEqual(expectedTotal);
      expect(first.length).toEqual(expectedTotal);
      expect(second.length).toEqual(expectedTotal);
      expect(third.length).toEqual(shouldFailMaxCount);
    });

    await Effect.runPromise(program.pipe(Effect.scoped));
  });
});

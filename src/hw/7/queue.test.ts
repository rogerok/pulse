import { Effect, Option, Queue } from "effect";

describe("queue homework", () => {
  it("suspends offer for bounded queue when it's full", async () => {
    /**
     *  Тест создает bounded очередь размером 1, чтобы можно было заполнить одним элементом
     *  Сначала кладём один элемент в очередь, чтобы она считалась полной.
     *  Затем кладем второй элемент, но делаем это в отдельном файбере.
     *
     *  Затем проверяем закончил ли работу файбер с помощью poll.
     *  Если нет, то тест успешен т.к. очередь полная
     *  firstTaken забирает первый элемент из очереди.
     *  После этого в bounded-очереди освобождается место.
     *  offerFiber, который пытался положить 2, теперь может завершиться.
     *  yield* offerFiber ждёт, пока этот fiber реально завершится.
     *
     */
    const program = Effect.gen(function* () {
      const queue = yield* Queue.bounded<number>(1);

      // кладём первый элемент
      yield* Queue.offer(queue, 1);

      // запускаем в фоне, чтобы тест не заблокировался на offer
      const offerFiber = yield* Effect.fork(Queue.offer(queue, 2));

      // отдаём управление планировщику, чтобы Queue.offer(queue, 2) точно стартовал
      yield* Effect.yieldNow();

      // если файбер завершился, получаем Option.some,если нет Option.none

      const beforeTake = yield* offerFiber.poll;

      // Забираем первый элемент из очереди. В очереди освобождается место
      const firstTaken = yield* Queue.take(queue);

      //  завершаем файбер
      yield* offerFiber;

      const secondTaken = yield* Queue.take(queue);

      return { beforeTake, firstTaken, secondTaken };
    });

    const result = await Effect.runPromise(program);

    expect(Option.isNone(result.beforeTake)).toBe(true);
    expect(result.firstTaken).toBe(1);
    expect(result.secondTaken).toBe(2);
  });

  it(`doesn't suspend offer for unbounded queue`, async () => {
    const program = Effect.gen(function* () {
      // создаем очередь. consumer не запускаем
      const queue = yield* Queue.unbounded<number>();

      const offerFiber = yield* Effect.fork(
        Effect.gen(function* () {
          yield* Queue.offer(queue, 1);
          yield* Queue.offer(queue, 2);
          yield* Queue.offer(queue, 3);
        }),
      );

      // Даём файберу шанс выполниться
      yield* Effect.yieldNow();

      return yield* offerFiber.poll;
    });

    const result = await Effect.runPromise(program);
    // проверяем что файбер выполнился
    expect(Option.isSome(result)).toBe(true);
  });

  it(`doesn't suspend offer for sliding queue`, async () => {
    const program = Effect.gen(function* () {
      const queue = yield* Queue.sliding<number>(2);

      const offerFiber = yield* Effect.fork(
        Effect.gen(function* () {
          yield* Queue.offer(queue, 1);
          yield* Queue.offer(queue, 2);
          yield* Queue.offer(queue, 3);
        }),
      );

      yield* Effect.yieldNow();

      const offerResult = yield* offerFiber.poll;
      const values = yield* Queue.takeAll(queue);

      return {
        offerResult,
        values: Array.from(values),
      };
    });

    const result = await Effect.runPromise(program);

    expect(Option.isSome(result.offerResult)).toBe(true);
    expect(result.values).toEqual([2, 3]);
  });
});

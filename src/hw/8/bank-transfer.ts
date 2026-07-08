import { Effect, Ref, STM, TRef } from "effect";

/*
Реализуй transfer(from: Ref<number>, to: Ref<number>, amount: number) через Ref.get плюс две Ref.update.
Напиши тест, в котором 100 параллельных переводов между двумя счетами разрывают инвариант (сумма счетов меняется, или один счёт уходит в минус).
Затем перепиши transfer через TRef и STM.gen плюс STM.commit,
повтори тот же тест: инвариант держится, баланс сходится.
В отчёте опиши, на каком фазе race condition случилась, и почему STM-версия её исключает.
 */

export const transferRacy = (from: Ref.Ref<number>, to: Ref.Ref<number>, amount: number) =>
  Effect.gen(function* () {
    const balance = yield* Ref.get(from);

    // Используем Effect.yieldNow() для воспроизведения бага.
    // На этой фазе произойдет race condition
    yield* Effect.yieldNow();

    if (balance < amount) {
      return yield* Effect.fail("balance is less than amount");
    }

    yield* Ref.update(from, (n) => n - amount);
    yield* Ref.update(to, (n) => n + amount);
  });

/**
 * Journal - структура данных, которая записывает все изменения сделанные транзакциями в TRef.
 * Все изменения в TRef записываются в Journal без изменения значений в общей памяти.
 * На этапе коммита рантайм совершает глобальный лок.
 * И сравнивает для каждого ref что его текущая версия равна той, что была на чтении.
 * Если да, то write-set атомарно сливается, если нет, то транзакция запускается с нуля
 */

export const transfer = (from: TRef.TRef<number>, to: TRef.TRef<number>, amount: number) =>
  STM.gen(function* () {
    const balance = yield* TRef.get(from);

    if (balance < amount) {
      return yield* STM.fail("balance is less than amount");
    }

    yield* TRef.update(from, (n) => n - amount);
    yield* TRef.update(to, (n) => n + amount);
  });

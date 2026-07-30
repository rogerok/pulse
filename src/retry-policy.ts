import { Schedule } from "effect";

import { type ProbeError } from "./errors.ts";

export const retryPolicy = Schedule.exponential("100 millis", 2.0).pipe(
  Schedule.jittered, // подключаем джиттер
  Schedule.either(Schedule.spaced("30 seconds")), // максимум 30 секунд
  Schedule.intersect(Schedule.recurs(5)), // максимум 5 ретраев
  Schedule.whileInput<ProbeError>(
    (error) =>
      error._tag === "NetworkError" ||
      error._tag === "TimeoutError" ||
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (error._tag === "HttpStatusError" && error.status >= 500),
  ),
);

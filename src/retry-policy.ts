import { Schedule } from "effect";

import { ProbeError } from "./errors.ts";

export const rertryPolicy = Schedule.exponential("100 millis", 2.0).pipe(
  Schedule.either(Schedule.spaced("30 seconds")), // максимум 30 секунд
  Schedule.jittered, // подключаем джиттер
  Schedule.intersect(Schedule.recurs(5)), // максимум 5 ретраев
  Schedule.whileInput<ProbeError>(
    (error) =>
      error._tag === "NetworkError" ||
      error._tag === "TimeoutError" ||
       
      (error._tag === "HttpStatusError" && error.status >= 500),
  ),
);

import { Command } from "@effect/cli";
import { Terminal } from "@effect/platform";
import { Deferred, Effect, Mailbox, Match, Schedule, Stream } from "effect";

import type { MonitorEvent } from "../../events.ts";

import { program } from "../../program.ts";
import { Sla } from "../../services/sla.ts";
import { Storage } from "../../services/storage.ts";
import { makeWatch } from "../../watch.ts";

const enterAlternateScreen = (terminal: Terminal.Terminal) =>
  Effect.gen(function* () {
    yield* terminal.display("\x1b[?1049h\x1b[?25l"); // alternate screen + скрыть курсор
    yield* Effect.addFinalizer(() => terminal.display("\x1b[?25h\x1b[?1049l").pipe(Effect.ignore));
  });

const formatEventRow = (event: MonitorEvent): string =>
  Match.value(event).pipe(
    Match.tag("ProbeSuccess", ({ elapsedMs, status, url }) => {
      const colour = status < 400 ? "\x1b[32m" : "\x1b[31m";

      return `${colour}● \x1b[0m${url.padEnd(40)} ${String(status).padStart(3)}  ${String(elapsedMs).padStart(5)} ms\n`;
    }),
    Match.tag(
      "ProbeFailure",
      ({ reason, url }) =>
        `\x1b[31m● \x1b[0m${url.padEnd(40)} ---  ${"---".padStart(5)} ms  ${reason}\n`,
    ),
    Match.tag(
      "ProbeSkipped",
      ({ monitorId, reason }) =>
        `\x1b[33m● \x1b[0m${monitorId.padEnd(40)} ---  ${"---".padStart(5)} ms  skipped: ${reason}\n`,
    ),
    Match.tag(
      "MonitorPaused",
      ({ monitorId }) =>
        `\x1b[33m● \x1b[0m${monitorId.padEnd(40)} ---  ${"---".padStart(5)} ms  paused\n`,
    ),
    Match.tag(
      "MonitorResumed",
      ({ monitorId }) =>
        `\x1b[32m● \x1b[0m${monitorId.padEnd(40)} ---  ${"---".padStart(5)} ms  resumed\n`,
    ),
    Match.exhaustive,
  );

const renderFrame = (terminal: Terminal.Terminal) =>
  Effect.gen(function* () {
    const storage = yield* Storage;
    const sla = yield* Sla;

    const monitors = yield* storage.readAll();
    const slaState = yield* sla.snapshot;

    yield* terminal.display("\x1b[H\x1b[2J"); // курсор в (1,1), очистка экрана
    yield* terminal.display(
      `Pulse · ${monitors.length} мониторов · активный ${slaState.active}\n\n`,
    );

    for (const monitor of monitors) {
      yield* terminal.display(formatEventRow(monitor));
    }
  });

const inputs = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const mailbox = yield* terminal.readInput;
  return Mailbox.toStream(mailbox).pipe(Stream.map((e) => e.key.name));
});

const inputLoop = (signal: Deferred.Deferred<void>) =>
  Effect.gen(function* () {
    const stream = yield* inputs;

    yield* stream.pipe(
      Stream.runForEach((key) => (key === "q" ? Deferred.succeed(signal, undefined) : Effect.void)),
    );
  });

export const watchCommand = Command.make("watch", {}, () =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal;
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const stop = yield* Deferred.make<void>();

    yield* enterAlternateScreen(terminal);

    yield* makeWatch(program);

    const renderLoop = renderFrame(terminal).pipe(Effect.repeat(Schedule.spaced("500 millis")));

    const work = Effect.all([makeWatch(program), renderLoop], {
      concurrency: "unbounded",
      discard: true,
    });

    const controls = Effect.race(inputLoop(stop), Deferred.await(stop));

    yield* Effect.race(work, controls);
  }).pipe(Effect.scoped),
);

import { Command, Prompt } from "@effect/cli";
import { Effect, Schema } from "effect";

import { PulseConfig } from "../../config.ts";
import { ConfigService } from "../../services/config.ts";

const askName = Prompt.text({
  default: "pulse",
  message: "Имя проекта",
  validate: (input) =>
    input.length >= 2
      ? Effect.succeed(input)
      : Effect.fail("Имя должно быть не короче двух символов"),
});

const askInterval = Prompt.select({
  choices: [
    { title: "30 секунд", value: "30s" },
    { title: "1 минута", value: "1m" },
    { title: "5 минут", value: "5m" },
  ],
  message: "Интервал по умолчанию",
});

const askJsonl = Prompt.toggle({
  active: "да",
  inactive: "нет",
  initial: true,
  message: "Записывать события в JSONL?",
});

const askJsonlPath = Prompt.text({
  default: "pulse",
  message: "Имя JSONL файла",
  validate: (input) =>
    input.length >= 2
      ? Effect.succeed(input)
      : Effect.fail("Имя должно быть не короче двух символов"),
});

export const initCommand = Command.make("init", {}, () =>
  Effect.gen(function* () {
    const name = yield* askName;
    const interval = yield* askInterval;
    const writeJsonl = yield* askJsonl;
    const jsonlPath = writeJsonl ? yield* askJsonlPath : undefined;

    const configService = yield* ConfigService;

    const config = yield* Schema.decodeUnknown(PulseConfig)({
      defaults: {
        interval,
        jsonlPath,
        name,
        writeJsonl,
      },
      monitors: [],
    });

    yield* configService.initialize(config);
  }),
);

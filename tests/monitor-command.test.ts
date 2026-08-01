import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { expect } from "vitest";

import { addCommand, removeCommand } from "../src/cli/commands/monitor.ts";
import { PulseConfig } from "../src/config.ts";
import { ConfigPath, ConfigService } from "../src/services/config.ts";
import { FsService } from "../src/services/fs.ts";

const cliMetadata = {
  name: "pulse",
  version: "0.1.0",
};
const runAdd = Command.run(addCommand, cliMetadata);
const runRemove = Command.run(removeCommand, cliMetadata);
const ConfigPathMock = Layer.succeed(ConfigPath, { path: "test-config.json" });
const makeConfigService = (
  config: Schema.Schema.Encoded<typeof PulseConfig>,
  writeText: (_: string, text: string) => Effect.Effect<void>,
) => {
  const FsServiceTest = Layer.mock(FsService, {
    _tag: "Pulse/FsService",
    readText: () => Effect.succeed(JSON.stringify(config)),
    writeText,
  });

  return ConfigService.Default.pipe(Layer.provide(Layer.mergeAll(FsServiceTest, ConfigPathMock)));
};

describe("monitor commands", () => {
  const mockMonitor = {
    fallbackUrl: "https://github.com",
    id: "github-www",
    interval: "30s",
    url: "https://github.com",
  };

  it.effect("Ошибка not-found, если url не найден", () =>
    Effect.gen(function* () {
      const encodedConfig = {
        monitors: [mockMonitor],
      };

      const writeText = vi.fn(() => Effect.void);

      const ConfigServiceTest = makeConfigService(encodedConfig, writeText);

      const effect = runRemove(["node", "pulse", "https://example.com"]).pipe(
        Effect.provide([NodeContext.layer, ConfigServiceTest]),
      );
      const result = yield* effect.pipe(Effect.flip);

      expect(result).toMatchObject({
        _tag: "StorageError",
        cause: "not-found",
      });
      expect(writeText).not.toHaveBeenCalled();
    }),
  );

  it.effect("Ошибка last-item", () =>
    Effect.gen(function* () {
      const encodedConfig = {
        monitors: [mockMonitor],
      };

      const writeText = vi.fn(() => Effect.void);

      const ConfigServiceTest = makeConfigService(encodedConfig, writeText);

      const effect = runRemove(["node", "pulse", mockMonitor.url]).pipe(
        Effect.provide([NodeContext.layer, ConfigServiceTest]),
      );
      const result = yield* effect.pipe(Effect.flip);

      expect(result).toMatchObject({
        _tag: "StorageError",
        cause: "last-item",
      });
      expect(writeText).not.toHaveBeenCalled();
    }),
  );

  it.effect("add test", () =>
    Effect.gen(function* () {
      const encodedConfig = {
        monitors: [
          {
            fallbackUrl: "https://test.com",
            id: "test-www",
            interval: "30s",
            url: "https://test.com",
          },
        ],
      };

      let writtenConfig: PulseConfig | undefined;

      const writeText = vi.fn((_: string, text: string) =>
        Effect.sync(() => {
          writtenConfig = Schema.decodeUnknownSync(PulseConfig)(JSON.parse(text));
        }),
      );

      const ConfigServiceTest = makeConfigService(encodedConfig, writeText);

      const effect = runAdd([
        "node",
        "pulse",
        mockMonitor.url,
        mockMonitor.fallbackUrl,
        mockMonitor.id,
      ]).pipe(Effect.provide([NodeContext.layer, ConfigServiceTest]));

      yield* effect;

      expect(writtenConfig?.monitors.some((m) => m.url === mockMonitor.url)).toBe(true);
      expect(writeText).toHaveBeenCalledOnce();
    }),
  );

  it.effect("add test должен вернуть ошибку already-exists", () =>
    Effect.gen(function* () {
      const encodedConfig = {
        monitors: [mockMonitor],
      };

      const writeText = vi.fn(() => Effect.void);

      const ConfigServiceTest = makeConfigService(encodedConfig, writeText);

      const effect = runAdd([
        "node",
        "pulse",
        mockMonitor.url,
        mockMonitor.fallbackUrl,
        mockMonitor.id,
      ]).pipe(Effect.provide([NodeContext.layer, ConfigServiceTest]));

      const result = yield* effect.pipe(Effect.flip);

      expect(writeText).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        _tag: "StorageError",
        cause: "already-exists",
      });
    }),
  );
});

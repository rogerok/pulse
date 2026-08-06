import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "@effect/platform";
import { Effect, Layer, Option, Schema } from "effect";

import { generateMonitorId, Monitor, MonitorId } from "./config.ts";
import { ConfigService } from "./services/config.ts";
import { Sla } from "./services/sla.ts";

const NotFound = Schema.TaggedStruct("NotFound", { id: Schema.String });
const ServiceError = Schema.TaggedStruct("ServiceError", {
  reason: Schema.optionalWith(Schema.String, { default: () => "Внутренняя ошибка сервера" }),
});
const ConflictError = Schema.TaggedStruct("ConflictError", {
  reason: Schema.optionalWith(Schema.String, { default: () => "Сущность уже существует" }),
});

const ConfigLoadError = ServiceError.make({
  reason: "Не удалось загрузить конфигурацию",
});

export const monitorsGroup = HttpApiGroup.make("monitors")
  .add(
    HttpApiEndpoint.get("list")`/api/monitors`
      .addSuccess(Schema.Array(Monitor))
      .addError(ServiceError, { status: 500 }),
  )
  .add(
    HttpApiEndpoint.get("byId")`/api/monitors/${HttpApiSchema.param("id", MonitorId)}`
      .addSuccess(Monitor)
      .addError(NotFound, { status: 404 })
      .addError(ServiceError, { status: 500 }),
  )
  .add(
    HttpApiEndpoint.post("create")`/api/monitors`
      .setPayload(Monitor.pipe(Schema.omit("id")))
      .addSuccess(Monitor)
      .addError(ServiceError, { status: 500 })
      .addError(ConflictError, { status: 409 }),
  );

const Status = Schema.Struct({
  monitors: Schema.Number,
  ok: Schema.Boolean,
  sla: Schema.Struct({
    active: Schema.Literal("primary", "fallback"),
    consecutiveFailures: Schema.Number,
  }),
});

const statusGroup = HttpApiGroup.make("status").add(
  HttpApiEndpoint.get("snapshot")`/status`
    .addSuccess(Status)
    .addError(ServiceError, { status: 500 }),
);

export const PulseApi = HttpApi.make("pulse").add(monitorsGroup).add(statusGroup);

const StatusLive = HttpApiBuilder.group(PulseApi, "status", (handlers) =>
  handlers.handle("snapshot", () =>
    Effect.gen(function* () {
      const config = yield* ConfigService;
      const monitors = yield* config.list.pipe(
        Effect.tapError((err) => Effect.logError(err)),
        Effect.mapError(() => ConfigLoadError),
      );

      const sla = yield* Sla;
      const snapshot = yield* sla.snapshot;

      return Status.make({
        monitors: monitors.length,
        ok: snapshot.active === "primary",
        sla: snapshot,
      });
    }),
  ),
);

const MonitorsLive = HttpApiBuilder.group(PulseApi, "monitors", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        return yield* config.list.pipe(
          Effect.tapError((err) => Effect.logError(err)),
          Effect.mapError(() => ConfigLoadError),
        );
      }),
    )
    .handle("byId", (request) =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const id = request.path.id;

        return yield* config.get(id).pipe(
          Effect.tapError((err) => Effect.logError(err)),
          Effect.mapError(() => ConfigLoadError),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail({
                  _tag: "NotFound" as const,
                  id,
                }),
              onSome: Effect.succeed,
            }),
          ),
        );
      }),
    )
    .handle("create", (request) =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const id = yield* generateMonitorId;
        const monitor = Monitor.make({ ...request.payload, id });

        yield* config.addMonitor(monitor).pipe(
          Effect.tapError((error) => Effect.logError(error)),
          Effect.mapError((error) => {
            if (error._tag === "StorageError" && error.cause === "already-exists") {
              return {
                _tag: "ConflictError" as const,
                reason: "Монитор уже существует",
              };
            }

            return {
              _tag: "ServiceError" as const,
              reason: "Не удалось сохранить монитор",
            };
          }),
        );

        return monitor;
      }),
    ),
);

export const PulseApiLive = HttpApiBuilder.api(PulseApi).pipe(
  Layer.provide(MonitorsLive),
  Layer.provide(StatusLive),
);

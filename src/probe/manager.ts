import { Effect } from "effect";

import { Monitor } from "../config.ts";
import { probeLoop } from "./loop.ts";

export const startMonitors = (targets: ReadonlyArray<Monitor>) =>
  Effect.forEach(targets, (target) => Effect.forkScoped(probeLoop(target)));

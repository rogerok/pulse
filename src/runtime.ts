import { ManagedRuntime } from "effect";

import { MainLive } from "./main.ts";

export const runtime = ManagedRuntime.make(MainLive);

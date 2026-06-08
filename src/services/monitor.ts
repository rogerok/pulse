import { Context } from "effect";

export class CurrentMonitor extends Context.Tag("Pulse/CurrentMonitor")<CurrentMonitor, {}>() {}

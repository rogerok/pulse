import { MonitorEvent } from "./events.ts";

const encoder = new TextEncoder();

export const encodeSse = (event: MonitorEvent) =>
  encoder.encode(`event: ${event._tag}\n` + `data: ${JSON.stringify(event)}\n\n`);

import { Layer } from "effect";

import { ConfigPathLive, ConfigServiceLive } from "./services/config.ts";
import { FsLive } from "./services/fs.ts";
import { HttpLive } from "./services/http.ts";
import { StorageConfigLive, StorageLive } from "./services/storage.ts";

const Storage = StorageLive.pipe(Layer.provide(Layer.mergeAll(FsLive, StorageConfigLive)));
const Config = ConfigServiceLive.pipe(Layer.provide(Layer.mergeAll(FsLive, ConfigPathLive)));

export const MainLive = Layer.mergeAll(Storage, HttpLive, Config, FsLive);

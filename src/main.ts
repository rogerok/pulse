import { Layer } from "effect";

import { FsLive } from "./services/fs.ts";
import { HttpLive } from "./services/http.ts";
import { StorageConfigLive, StorageLive } from "./services/storage.ts";

const Storage = StorageLive.pipe(Layer.provide(Layer.mergeAll(FsLive, StorageConfigLive)));

export const MainLive = Layer.mergeAll(Storage, HttpLive);

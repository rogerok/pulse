import { Console, Effect, Option, Stream } from "effect";

type Event = {
  id: number;
};

const makeEvent = (id: number) => ({
  id: id,
});

type Page = { events: Event[]; nextPage: Option.Option<number> };

const makePage = (page: number) => {
  const start = (page - 1) * 10 + 1;
  return Array.from({ length: 10 }).map((_, i) => makeEvent(start + i));
};

const pages = Array.from({ length: 5 }).reduce<Record<number, Page>>((acc, _, i) => {
  const page = i + 1;
  acc[page] = {
    events: makePage(page),
    nextPage: page === 5 ? Option.none() : Option.some(page + 1),
  };
  return acc;
}, {});

export const fetchPage = (page: number) =>
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  Console.log(`fetch page ${page}`).pipe(Effect.as(pages[page]!));

export const fetchAllEventsFromApi = (fetchPageCb: (page: number) => Effect.Effect<Page>) =>
  Stream.paginateEffect(1, (page) =>
    fetchPageCb(page).pipe(Effect.map(({ events, nextPage }) => [events, nextPage] as const)),
  ).pipe(Stream.flattenIterables);

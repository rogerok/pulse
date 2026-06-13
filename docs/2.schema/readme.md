## Schema

| Schema                                              | Возвращает                     | Что делает                                         |
|-----------------------------------------------------|--------------------------------|----------------------------------------------------|
| `Schema.decodeUnknown(Schema)(value)`               | `Effect<A, ParseError, never>` | Decode для неизвестного значения                   |
| `Schema.decodeUnknownEither(Schema)(value)`         | `Either.Either<A, ParseError>` | Decode и возвращает `Either<Left, Right>`          |
| `Schema.decodeUnknownSync(Schema)(value)`           | `Either.Either<A, ParseError>` | Throws error если парсинг упал                     |
|                                                     |
| `Schema.encodeSync(Schema)(value)`                  |                                | Encode данные и throw ошибку, если encoding падает |
| `Schema.encodeOption(Schema)(value)`                |                                | Encode данные и возвращает `Option` type           |
| `Schema.encodeEither(Schema)(value)`                |                                | Encode данные и возвращает `Either` type           |
| `Schema.encodePromise(Schema)(value)`               |                                | Encode данные и возвращает `Promise` type          |
| `Schema.encode(Schema)(value)`                      |                                | Encode данные и возвращает `Effect` type           |
|                                                     |                                |                                                    |
| `Schema.TaggedStruct({'Tag', {url: Schema.String})` |                                | Создает схему с тегом                              |

Вытягиваем типы

```ts
type MonitorEncoded = Schema.Schema.Encoded<typeof Monitor>;
//   ^? { readonly id: string; readonly url: string; readonly interval: string }
type MonitorType = Schema.Schema.Type<typeof Monitor>;
//   ^? { readonly id: string; readonly url: string; readonly interval: string }
```

## Трансформации Schema

```ts
Schema.transform(
  fromSchema, // что на входе у decode и на выходе у encode
  toScema, // что на выходе у decode и на входе у encode
  {
    decode: (from, _options, ast) => to,
    encode: (to, _options, ast) => from,
    strict: true // лучше ставить, ловит несимметричные пары
  }
)
```

`transformOrFail` это transform, которому разрешено провалиться на decode.

## Рефайменты через filters

```ts
const Positive = Schema.number.pipe(Schema.greaterThan(0));
const NonEmpty = Schema.String.pipe(Schema.minLength(1))
const Shortname = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50))
```

Свой рефаймент

```ts
const EvenNumber = Schema.number.pipe(Schema.filter((n) => n % 2 === 0 || `ожидается чётное число, пришло ${n}`), {
  identifier: 'EvenNumber'
})
```

`Schema.filter(predicat, annotations)` - предикат либо `boolean` (`true` если ок), либо строка с сообщением (если не ок)

`Schema.filter` не делает branded. Если нужен `brand`, то его стоит добавлять отдельно.

```ts
const Url = Schema.String.pipe(
  Schema.pattern(/^https?:\/\//),
  Schema.brand('Url'),
);
```

## Композиция

`Schema.compose` для цепочки трансформаций

```ts
const Step1 = Schema.parseJson(RawMonitor);
const Step2 = StringIntervalToDuration;
const Pipeline = Schema.compose(Step1, Step2);
```

## typeSchema, encodedSchema

```Schema.typeSchema(Schema)``` - отбрасывает encoded сторону, получается схема с декодированным значением.
```Schema.encodedSchema(Schema)``` - отбрасывает type сторону, получается схема для голого wire-формата.

## Optional, default, NullOr

```ts
const Defaults = Schema.Struct({
  interval: Schema.optionalWith(Schema.Number, { default: () => 30_000 }),
  timeout: Schema.optionalWith(Schema.Number, { default: () => 5000 }),
  retries: Schema.optionalWith(Schema.Number, { default: () => 0 }),
});

type Defaults = Schema.Schema.Type<typeof Defaults>;
//   ^? { interval: number; timeout: number; retries: number }, всё обязательное

type DefaultsEncoded = Schema.Schema.Encoded<typeof Defaults>;
//   ^? { interval?: number; timeout?: number; retries?: number }, всё опциональное
```

```ts
const Tag = Schema.String.pipe(
  Schema.propertySignature,
  Schema.withConstructorDefault(() => 'general'),
);

const Note = Schema.Struct({
  text: Schema.String,
  tag: Tag,
});

const note = Note.make({ text: 'привет' });
// note: { text: 'привет', tag: 'general' }
```

```ts
class MonitorRef extends Schema.Class<MonitorRef>('MonitorRef')({
  tenant: Schema.String,
  monitor: Schema.String,
}) {
  toString() {
    return `${this.tenant}/${this.monitor}`;
  }
}

const ref = new MonitorRef({ tenant: 'acme', monitor: 'web' });
// ref instanceof MonitorRef === true
// String(ref) === 'acme/web'
```

`Schema.Class` - полноценный класс с конструктором, валидацией, методами и при этом он схема.
`Schema.decodeUnknown(MonitorRef)` работает.


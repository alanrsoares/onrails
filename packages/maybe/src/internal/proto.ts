import type { Maybe, MaybeMethods } from "../maybe.js";

/**
 * `util.inspect` / `Bun.inspect` / `console.log` hook: render `Ok(1)` instead of dumping the class
 * name and every prototype method. Symbol-keyed, so it adds no enumerable field and JSON is unchanged.
 */
const INSPECT = Symbol.for("nodejs.util.inspect.custom");
type Inspect = (value: unknown, options?: unknown) => string;

/**
 * Live carrier classes. `_tag` and `value` are own enumerable fields, so JSON
 * and `structuredClone` see plain data; every method lives on the prototype
 * and is therefore non-enumerable. Internal only: build carriers with
 * `some` / `none`.
 */
class SomeImpl<T> implements MaybeMethods<T> {
  readonly _tag: "Some";
  readonly value: T;
  // explicit assignment order keeps `_tag` first, so JSON key order matches the plain-data shape
  constructor(value: T) {
    this._tag = "Some";
    this.value = value;
  }
  [INSPECT](_depth: number, options: unknown, inspect: Inspect): string {
    return `Some(${inspect(this.value, options)})`;
  }
  map<U>(fn: (value: T) => U): Maybe<U> {
    return new SomeImpl(fn(this.value));
  }
  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    return fn(this.value);
  }
  andThen<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    return fn(this.value);
  }
  match<U>(onSome: (value: T) => U, _onNone: () => U): U {
    return onSome(this.value);
  }
  unwrapOr(_defaultValue: T): T {
    return this.value;
  }
  tap(fn: (value: T) => void): Maybe<T> {
    fn(this.value);
    return this;
  }
  tapNone(_fn: () => void): Maybe<T> {
    return this;
  }
}

class NoneImpl<T> implements MaybeMethods<T> {
  readonly _tag: "None";
  constructor() {
    this._tag = "None";
  }
  [INSPECT](): string {
    return "None";
  }
  map<U>(_fn: (value: T) => U): Maybe<U> {
    return new NoneImpl<U>();
  }
  flatMap<U>(_fn: (value: T) => Maybe<U>): Maybe<U> {
    return new NoneImpl<U>();
  }
  andThen<U>(_fn: (value: T) => Maybe<U>): Maybe<U> {
    return new NoneImpl<U>();
  }
  match<U>(_onSome: (value: T) => U, onNone: () => U): U {
    return onNone();
  }
  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }
  tap(_fn: (value: T) => void): Maybe<T> {
    return this;
  }
  tapNone(fn: () => void): Maybe<T> {
    fn();
    return this;
  }
}

export const newSome = <T>(value: T): Maybe<T> => new SomeImpl(value);
export const newNone = <T>(): Maybe<T> => new NoneImpl<T>();

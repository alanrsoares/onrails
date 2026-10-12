import type { Result, ResultMethods } from "../types.js";

/**
 * Live carrier classes. `_tag` and `value` / `error` are own enumerable
 * fields, so JSON and `structuredClone` see plain data; every method lives on
 * the prototype and is therefore non-enumerable.
 *
 * Internal only: reach carriers through {@link newOk} / {@link newErr}
 * (aliased as `mkOk` / `mkErr` for unlocked internals) or the public
 * `ok` / `err`.
 */
class OkImpl<T, E> implements ResultMethods<T, E> {
  readonly _tag: "Ok";
  readonly value: T;
  // explicit assignment order keeps `_tag` first, so JSON key order matches the plain-data shape
  constructor(value: T) {
    this._tag = "Ok";
    this.value = value;
  }
  map<U>(fn: (value: T) => U): Result<U, E> {
    return new OkImpl<U, E>(fn(this.value));
  }
  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return new OkImpl<T, F>(this.value);
  }
  flatMap<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return fn(this.value);
  }
  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return fn(this.value);
  }
  recover<F>(_fn: (error: E) => Result<T, F>): Result<T, F> {
    return new OkImpl<T, F>(this.value);
  }
  tap(fn: (value: T) => void): Result<T, E> {
    fn(this.value);
    return this;
  }
  tapErr(_fn: (error: E) => void): Result<T, E> {
    return this;
  }
  match<U>(onOk: (value: T) => U, _onErr: (error: E) => U): U {
    return onOk(this.value);
  }
  unwrapOr<U>(_defaultValue: U): T | U {
    return this.value;
  }
}

class ErrImpl<T, E> implements ResultMethods<T, E> {
  readonly _tag: "Err";
  readonly error: E;
  constructor(error: E) {
    this._tag = "Err";
    this.error = error;
  }
  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new ErrImpl<U, E>(this.error);
  }
  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new ErrImpl<T, F>(fn(this.error));
  }
  flatMap<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return new ErrImpl<U, E | F>(this.error);
  }
  andThen<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return new ErrImpl<U, E | F>(this.error);
  }
  recover<F>(fn: (error: E) => Result<T, F>): Result<T, F> {
    return fn(this.error);
  }
  tap(_fn: (value: T) => void): Result<T, E> {
    return this;
  }
  tapErr(fn: (error: E) => void): Result<T, E> {
    fn(this.error);
    return this;
  }
  match<U>(_onOk: (value: T) => U, onErr: (error: E) => U): U {
    return onErr(this.error);
  }
  unwrapOr<U>(defaultValue: U): T | U {
    return defaultValue;
  }
}

export const newOk = <T, E>(value: T): Result<T, E> => new OkImpl<T, E>(value);
export const newErr = <T, E>(error: E): Result<T, E> => new ErrImpl<T, E>(error);

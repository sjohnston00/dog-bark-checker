export type PickTuple<T, Keys extends (keyof T)[]> = { [I in keyof Keys]: T[Keys[I] & keyof T] };

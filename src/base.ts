export class ColumnsBase {
  protected __nominal = undefined
}

export class TableBase {
  protected __nominal = undefined
}

export type ElementType<T> = T extends (infer E)[] ? E : T

// intellisense helper
// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type
// expands object types recursively
export type ExpandRecursively<T> = T extends object
  ? T extends infer O
    ? { [K in keyof O]: O[K] extends Date ? Date : ExpandRecursively<O[K]> }
    : never
  : T

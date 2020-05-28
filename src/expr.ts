import { ExpandRecursively } from './base'

export class Expr<_> {
  static readonly number = (expr: string) => new Expr<number>(expr)
  static readonly string = (expr: string) => new Expr<string>(expr)
  static readonly enum = <T extends string>(expr: string) => new Expr<T>(expr)
  static readonly date = (expr: string) => new Expr<Date>(expr)
  static readonly boolean = (expr: string) => new Expr<boolean>(expr)
  static readonly any = <T = any>(expr: string) => new Expr<T>(expr)

  toString() {
    return this.expr
  }

  private constructor(private expr: string) {}
}

export type Computed<O extends object> = {
  [K in keyof O]: O[K] extends Expr<infer _> ? O[K] : never
}

export type Extend<T, O extends object> = ExpandRecursively<
  T &
    {
      [K in keyof O]: O[K] extends Expr<infer T> ? T : never
    }
>

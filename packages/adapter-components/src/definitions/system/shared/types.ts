/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { types } from '@salto-io/lowerdash'

/**
 * Use this type to specify a default with customizations by key (usually type).
 * This should be supplemented with merge logic - specifically, the final definition for a key
 * is the customization if available, and otherwise it is the default.
 * Note that there are some edge cases - merging should be done based on mergeSingleDefWithDefault.
 */
export type DefaultWithCustomizations<T, K extends string = string> = {
  // if the customization is an array, the default will be applied to each array item
  // (if the customization is empty, it will not be used)
  default?: types.RecursivePartial<T extends (infer U)[] ? U : T>
  // hack to avoid requiring all keys of an enum
  customizations?: string extends K ? Record<K, T> : Partial<Record<K, T>>
}

export type ArgsWithCustomizer<ResultType, Args, Input = unknown, AdditionalArgs = {}> = Args & {
  custom?: (args: Partial<Args> & AdditionalArgs) => (input: Input) => ResultType
}

export type OptionsWithDefault<T, K extends string> = {
  options: Record<K, T>
  default: K
}

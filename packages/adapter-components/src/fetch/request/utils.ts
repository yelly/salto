/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { Values, isPrimitiveValue } from '@salto-io/adapter-api'
import { ContextParams } from '../../definitions'

export const ARG_PLACEHOLDER_MATCHER = /\{([\w_.]+)\}/g

export const findUnresolvedArgs = (value: string, definedParams: Set<string> = new Set()): string[] => {
  const urlParams = value.match(ARG_PLACEHOLDER_MATCHER)?.map(m => m.slice(1, -1)) ?? []
  return urlParams.filter(p => !definedParams.has(p))
}

export const findAllUnresolvedArgs = (value: unknown, definedParams: Set<string> = new Set()): string[] => {
  const allParams: string[] = []
  _.cloneDeepWith(value, (v: unknown) => {
    if (_.isString(v)) {
      allParams.push(...findUnresolvedArgs(v, definedParams))
    }
    return undefined
  })
  return _.uniq(allParams)
}

export const replaceArgs = (
  valueToReplace: string,
  args: Record<string, unknown>,
  throwOnUnresolvedArgs?: boolean,
): string => {
  const res = valueToReplace.replace(ARG_PLACEHOLDER_MATCHER, val => {
    const replacement = _.get(args, val.slice(1, -1)) ?? val
    if (!isPrimitiveValue(replacement)) {
      throw new Error(`Cannot replace param ${val} in ${valueToReplace} with non-primitive value ${replacement}`)
    }
    return replacement.toString()
  })
  if (throwOnUnresolvedArgs) {
    const unresolved = findUnresolvedArgs(res)
    if (unresolved.length > 0) {
      throw new Error(`value ${res} still contains unresolved args: ${unresolved}`)
    }
  }
  return res
}

// replace all placeholder args recursively
export const replaceAllArgs = <T extends Values = Values>({
  context,
  value,
  throwOnUnresolvedArgs,
}: {
  context: ContextParams
  value: T
  throwOnUnresolvedArgs?: boolean
}): T => _.cloneDeepWith(value, val => (_.isString(val) ? replaceArgs(val, context, throwOnUnresolvedArgs) : undefined))

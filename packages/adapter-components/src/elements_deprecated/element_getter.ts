/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element } from '@salto-io/adapter-api'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { TypeConfig } from '../config_deprecated'
import { ElementQuery } from '../fetch/query'
import { FetchElements } from '../fetch'

const { isDefined } = lowerdashValues

/**
 * Get all dependencies types (by the usage of "dependsOn")
 * of a list of types from the configuration
 */
export const getDependencies = (types: string[], typeConfigs: Record<string, TypeConfig>): string[] =>
  // for now assuming flat dependencies for simplicity.
  types.flatMap(typeName => typeConfigs[typeName]?.request?.dependsOn?.map(({ from }) => from.type)).filter(isDefined)

/**
 * Helper for fetch orchestration - concurrently fetch elements for the types specified in the
 * configuration, allowing one level of dependencies between the type's endpoints based on the
 * dependsOn field.
 */
export const getElementsWithContext = async <E extends Element>({
  fetchQuery,
  supportedTypes,
  types,
  typeElementGetter,
}: {
  fetchQuery: Pick<ElementQuery, 'isTypeMatch'>
  supportedTypes: Record<string, string[]>
  types: Record<string, TypeConfig>
  typeElementGetter: (args: { typeName: string; contextElements?: Record<string, E[]> }) => Promise<FetchElements<E[]>>
}): Promise<FetchElements<E[]>> => {
  const includeTypes = _(supportedTypes)
    .entries()
    .filter(([typeName]) => fetchQuery.isTypeMatch(typeName))
    .map(([_typeName, wrapperTypes]) => wrapperTypes)
    .flatten()
    .value()

  // for now assuming flat dependencies for simplicity.
  // will replace with a DAG (with support for concurrency) when needed
  const [independentEndpoints, dependentEndpoints] = _.partition(includeTypes, typeName =>
    _.isEmpty(types[typeName]?.request?.dependsOn),
  ).map(list => new Set(list))

  // some type requests need to extract context and parameters from other types -
  // if these types are not listed in the include config, they will be fetched but not persisted
  const additionalContextTypes: string[] = getDependencies([...dependentEndpoints], types).filter(
    typeName => !independentEndpoints.has(typeName),
  )

  const contextElements: Record<
    string,
    FetchElements<E[]> & {
      // if the type is only fetched as context for another type, do not persist it
      persistInstances: boolean
    }
  > = Object.fromEntries(
    await Promise.all(
      [...independentEndpoints, ...additionalContextTypes].map(async typeName => {
        const res = await typeElementGetter({ typeName })
        return [
          typeName,
          {
            elements: res.elements,
            persistInstances: independentEndpoints.has(typeName),
            errors: res.errors,
          },
        ]
      }),
    ),
  )
  const dependentElements = await Promise.all(
    [...dependentEndpoints].map(async typeName =>
      typeElementGetter({
        typeName,
        contextElements: _.mapValues(contextElements, val => val.elements),
      }),
    ),
  )

  return {
    elements: Object.values(contextElements)
      .flatMap(({ persistInstances, elements }) => (persistInstances ? elements : []))
      .concat(Object.values(dependentElements).flatMap(({ elements }) => elements)),
    errors: Object.values(contextElements)
      .flatMap(({ errors }) => errors ?? [])
      .concat(Object.values(dependentElements).flatMap(({ errors }) => errors ?? [])),
  }
}

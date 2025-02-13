/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import wu from 'wu'
import { DAG, WalkError } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ElementGenerator } from '../element/element'
import { ElementQuery } from '../query'
import { Requester } from '../request/requester'
import { DefQuery } from '../../definitions'
import { createTypeResourceFetcher } from './type_fetcher'
import { FetchResourceDefinition } from '../../definitions/system/fetch/resource'
import { TypeFetcherCreator, ValueGeneratedItem } from '../types'
import { AbortFetchOnFailure } from '../errors'

const log = logger(module)

type ResourceManager = {
  // orchestrate all requests and transformations needed to fetch all entries matching the specified query,
  // and pass them to the element generator that will turn them into elements
  fetch: (query: ElementQuery) => Promise<void>
}

/*
 * Create a graph with dependencies between resources based on the dependsOn definitions
 */
const createDependencyGraph = (defs: Record<string, FetchResourceDefinition>): DAG<undefined> => {
  const graph = new DAG<undefined>()
  Object.entries(_.pickBy(defs, def => def.directFetch)).forEach(([typeName, resource]) => {
    if (resource?.context?.dependsOn === undefined) {
      graph.addNode(typeName, [], undefined)
      return
    }
    const dependsOnTypes = _.uniq(Object.values(resource.context.dependsOn).map(arg => arg.parentTypeName))
    graph.addNode(typeName, dependsOnTypes, undefined)
  })

  return graph
}

export const createResourceManager = <ClientOptions extends string>({
  adapterName,
  resourceDefQuery,
  requester,
  elementGenerator,
  initialRequestContext,
  customItemFilter,
}: {
  adapterName: string
  resourceDefQuery: DefQuery<FetchResourceDefinition>
  requester: Requester<ClientOptions>
  elementGenerator: ElementGenerator
  initialRequestContext?: Record<string, unknown>
  customItemFilter?: (item: ValueGeneratedItem) => boolean
}): ResourceManager => ({
  fetch: query =>
    log.timeDebug(
      async () => {
        const createTypeFetcher: TypeFetcherCreator = ({ typeName, context }) =>
          createTypeResourceFetcher({
            adapterName,
            typeName,
            resourceDefQuery,
            query,
            requester,
            handleError: elementGenerator.handleError,
            initialRequestContext: _.defaults({}, context, initialRequestContext),
            customItemFilter,
          })
        const directFetchResourceDefs = _.pickBy(resourceDefQuery.getAll(), def => def.directFetch)
        const resourceFetchers = _.pickBy(
          _.mapValues(directFetchResourceDefs, (_def, typeName) => createTypeFetcher({ typeName })),
          lowerdashValues.isDefined,
        )
        const graph = createDependencyGraph(resourceDefQuery.getAll())
        try {
          await graph.walkAsync(typeName =>
            log.timeDebug(
              async () => {
                const resourceFetcher = resourceFetchers[typeName]
                if (resourceFetcher === undefined) {
                  log.debug('no resource fetcher defined for type %s:%s', adapterName, typeName)
                  return
                }
                const availableResources = _.mapValues(
                  _.pickBy(resourceFetchers, fetcher => fetcher.done()),
                  fetcher => fetcher.getItems(),
                )

                const res = await resourceFetcher.fetch({
                  contextResources: availableResources, // used to construct the possible context args for the request
                  typeFetcherCreator: createTypeFetcher, // used for recurseInto calls
                })

                const typeNameAsStr = String(typeName)
                if (!res.success) {
                  elementGenerator.handleError({ typeName: typeNameAsStr, error: res.error })
                  return
                }

                elementGenerator.pushEntries({
                  typeName: typeNameAsStr,
                  entries: resourceFetcher.getItems()?.map(item => item.value) ?? [],
                })
              },
              'fetching resources for type %s.%s',
              adapterName,
              typeName,
            ),
          )
        } catch (e) {
          if (e instanceof WalkError) {
            // In case we decided to fail the entire fetch we don't want the error to be wrapped in a WalkError
            const failFetchError = wu(e.handlerErrors.values()).find(err => err instanceof AbortFetchOnFailure)
            if (failFetchError !== undefined) {
              // Since there may be other errors in the handlerErrors, we log them all
              log.error(
                `Received at least one AbortFetchOnFailure error, failing the entire fetch. Full error: ${e}, stack: ${e.stack}`,
              )
              throw failFetchError
            }
          }
          // If we got here, it means that the error is not an AbortFetchOnFailure error, so we throw the error as is
          // and let the caller decide how to handle it
          throw e
        }
      },
      'fetching resources for account %s',
      adapterName,
    ),
})

/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isObjectType, isField, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import {
  getInternalId,
  setInternalId,
  ensureSafeFilterFetch,
  isMetadataInstanceElementSync,
  isStandardField,
  isInstanceOfTypeSync,
  getFullName,
} from './utils'
import {
  GLOBAL_VALUE_SET_TRANSLATION_METADATA_TYPE,
  NON_LISTED_ELEMENT_IDS,
  TOPICS_FOR_OBJECTS_METADATA_TYPE,
} from '../constants'

const log = logger(module)
const { awu, groupByAsync } = collections.asynciterable
const TYPES_WITH_NO_INTERNAL_IDS = [TOPICS_FOR_OBJECTS_METADATA_TYPE, GLOBAL_VALUE_SET_TRANSLATION_METADATA_TYPE]

// Used for logging
const shouldHaveInternalId = (element: Element): boolean => {
  if (NON_LISTED_ELEMENT_IDS.includes(element.elemID.getFullName())) {
    return false
  }
  if (isInstanceElement(element)) {
    return isMetadataInstanceElementSync(element) && !isInstanceOfTypeSync(...TYPES_WITH_NO_INTERNAL_IDS)(element)
  }
  if (isField(element)) {
    return !isStandardField(element)
  }
  return false
}

const getIdsForType = async (client: SalesforceClient, type: string): Promise<Record<string, string>> => {
  const { result, errors } = await client.listMetadataObjects({ type })
  if (errors && errors.length > 0) {
    log.debug(`Encountered errors while listing ${type}: ${errors}`)
  }
  return Object.fromEntries(result.map(info => [getFullName(info), info.id]))
}

/**
 * Try to add internal ids for the remaining types using listMetadataObjects.
 *
 * @param client          The salesforce client to use for the query
 * @param elementsByType  Elements missing internal ids, grouped by type
 */
const addMissingIds = async (client: SalesforceClient, typeName: string, elements: Element[]): Promise<Element[]> => {
  const errorElements: Element[] = []
  const allIds = await getIdsForType(client, typeName)
  await awu(elements).forEach(async element => {
    const id = allIds[await apiName(element)]
    if (id === undefined) {
      errorElements.push(element)
    } else {
      setInternalId(element, id)
    }
  })
  return errorElements
}

const elementsWithMissingIds = async (elements: Element[]): Promise<Element[]> =>
  awu(elements)
    .flatMap(e => (isObjectType(e) ? Object.values(e.fields) : [e]))
    .filter(async e => (isInstanceElement(e) && !(await e.getType()).isSettings) || isField(e))
    .filter(async e => (await apiName(e)) !== undefined && getInternalId(e) === undefined)
    .toArray()

const WARNING_MESSAGE =
  'Encountered an error while trying populate internal IDs for some of your salesforce configuration elements. This might result in some missing configuration dependencies in your workspace and/or affect the availability of the ‘go to service’ functionality.'

/**
 * Add missing env-specific ids using listMetadataObjects.
 */
const filter: FilterCreator = ({ client, config }) => ({
  name: 'addMissingIdsFilter',
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    fetchFilterFunc: async (elements: Element[]) => {
      if (client === undefined) {
        return
      }
      const groupedElements = await groupByAsync(await elementsWithMissingIds(elements), metadataType)
      log.debug(`Getting missing ids for the following types: ${Object.keys(groupedElements)}`)
      const errorElements = (
        await Promise.all(
          Object.entries(groupedElements).map(([typeName, typeElements]) =>
            addMissingIds(client, typeName, typeElements),
          ),
        )
      )
        .flat()
        .filter(shouldHaveInternalId)
      if (errorElements.length > 0) {
        /**
         * If this warning shows up, please investigate the issue. Update the implementation
         * of shouldHaveInternalId if the element should not have an internal id.
         */
        log.warn(
          'Could not add internalIds on the following elements (first 100): %s',
          safeJsonStringify(errorElements.slice(0, 100).map(e => e.elemID.getFullName())),
        )
      }
    },
  }),
})

export default filter

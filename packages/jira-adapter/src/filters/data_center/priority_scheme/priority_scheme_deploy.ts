/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
  ModificationChange,
  RemovalChange,
} from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { resolveChangeElement, resolveValues } from '@salto-io/adapter-components'
import Joi from 'joi'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../../filter'
import { PRIORITY_SCHEME_TYPE_NAME } from '../../../constants'
import { deployChanges } from '../../../deployment/standard_deployment'
import JiraClient from '../../../client/client'
import { getLookUpName } from '../../../reference_mapping'
import { addAnnotationRecursively, findObject, setTypeDeploymentAnnotations } from '../../../utils'

const log = logger(module)

type PrioritySchemeResponse = {
  id: number
}

const PRIORITY_SCHEME_RESPONSE_SCHEME = Joi.object({
  id: Joi.number().required(),
})
  .unknown(true)
  .required()

export const isPrioritySchemeResponse = createSchemeGuard<PrioritySchemeResponse>(
  PRIORITY_SCHEME_RESPONSE_SCHEME,
  'Received an invalid priority scheme response',
)

const createScheme = async (change: AdditionChange<InstanceElement>, client: JiraClient): Promise<void> => {
  const instance = getChangeData(change)
  const resolvedInstance = await resolveValues(instance, getLookUpName)

  const response = await client.post({
    url: '/rest/api/2/priorityschemes',
    data: resolvedInstance.value,
  })

  if (!isPrioritySchemeResponse(response.data)) {
    throw new Error('Received an invalid create priority scheme response.')
  }

  instance.value.id = response.data.id
}

/**
 * The default priority scheme contains all the priorities and can't be modified.
 * Therefore if the user adds or removes a priority, we don't want to really send the
 * request to update the default scheme with the priorities because it will fail,
 * so we should just skip it.
 */
const shouldSkipChange = async (change: ModificationChange<InstanceElement>): Promise<boolean> => {
  const instance = getChangeData(change)
  if (!instance.value.defaultScheme) {
    return false
  }

  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  const beforeWithoutIds = _.omit(resolvedChange.data.before.value, 'optionIds')
  const afterWithoutIds = _.omit(resolvedChange.data.after.value, 'optionIds')

  return _.isEqual(beforeWithoutIds, afterWithoutIds)
}

const updateScheme = async (change: ModificationChange<InstanceElement>, client: JiraClient): Promise<void> => {
  if (await shouldSkipChange(change)) {
    log.debug('Skipping priority scheme change')
    return
  }
  const instance = getChangeData(change)
  const resolvedInstance = await resolveValues(instance, getLookUpName)

  await client.put({
    url: `/rest/api/2/priorityschemes/${resolvedInstance.value.id}`,
    data: resolvedInstance.value,
  })
}

const deleteScheme = async (change: RemovalChange<InstanceElement>, client: JiraClient): Promise<void> => {
  const instance = getChangeData(change)

  await client.delete({
    url: `/rest/api/2/priorityschemes/${instance.value.id}`,
  })
}

const filter: FilterCreator = ({ client }) => ({
  name: 'prioritySchemeDeployFilter',
  onFetch: async elements => {
    if (!client.isDataCenter) {
      return
    }

    const schemeType = findObject(elements, PRIORITY_SCHEME_TYPE_NAME)
    if (schemeType === undefined) {
      return
    }

    setTypeDeploymentAnnotations(schemeType)
    await addAnnotationRecursively(schemeType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(schemeType, CORE_ANNOTATIONS.UPDATABLE)
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === PRIORITY_SCHEME_TYPE_NAME,
    )

    if (relevantChanges.length !== 0 && !client.isDataCenter) {
      // We should never get here since there is a change validator that will stop us before
      throw new Error('Deploying priority schemes is not supported on Jira Cloud')
    }

    const deployResult = await deployChanges(
      // relevantChanges already contains only instances at this point,
      // but the TS compiler is not aware of that
      relevantChanges.filter(isInstanceChange),
      async change => {
        if (isAdditionChange(change)) {
          await createScheme(change, client)
        } else if (isModificationChange(change)) {
          await updateScheme(change, client)
        } else {
          await deleteScheme(change, client)
        }
      },
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter

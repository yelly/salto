/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  Element,
  ElemID,
  isInstanceElement,
  isReferenceExpression,
  ActionName,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { DeployApiDefinitions, DeployableRequestDefinition } from '../../definitions/system/deploy'
import { DefaultWithCustomizations, queryWithDefault } from '../../definitions'
import { ERROR_MESSAGE, detailedErrorMessage } from './check_deployment_based_on_config'
import {
  APIDefinitionsOptions,
  ResolveAdditionalActionType,
  ResolveClientOptionsType,
} from '../../definitions/system/api'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const createChangeErrors = <Options extends APIDefinitionsOptions = {}>(
  typeRequestDefinition: DefaultWithCustomizations<
    DeployableRequestDefinition<ResolveClientOptionsType<Options>>[],
    ActionName
  >,
  instanceElemID: ElemID,
  action: ActionName,
): ChangeError[] => {
  const actionRequests = makeArray(queryWithDefault(typeRequestDefinition).query(action))
  if (
    actionRequests.length === 0 ||
    actionRequests.every(req => req.request.endpoint === undefined && req.request.earlySuccess !== true)
  ) {
    return [
      {
        elemID: instanceElemID,
        severity: 'Error',
        message: ERROR_MESSAGE,
        detailedMessage: detailedErrorMessage(action, instanceElemID),
      },
    ]
  }
  return []
}

// This is the new version of the createCheckDeploymentBasedOnConfigValidator CV that support definitions
export const createCheckDeploymentBasedOnDefinitionsValidator = <Options extends APIDefinitionsOptions = {}>({
  deployDefinitions,
  typesDeployedViaParent = [],
  typesWithNoDeploy = [],
}: {
  deployDefinitions: DeployApiDefinitions<ResolveAdditionalActionType<Options>, ResolveClientOptionsType<Options>>
  typesDeployedViaParent?: string[]
  typesWithNoDeploy?: string[]
}): ChangeValidator => {
  const typeConfigQuery = queryWithDefault(deployDefinitions.instances)
  return async changes =>
    awu(changes)
      .map(async (change: Change<Element>): Promise<(ChangeError | undefined)[]> => {
        const element = getChangeData(change)
        if (!isInstanceElement(element)) {
          return []
        }
        const getChangeErrorsByTypeName = (typeName: string): ChangeError[] => {
          const requestsByAction = typeConfigQuery.query(typeName)?.requestsByAction ?? {}
          return createChangeErrors(requestsByAction, element.elemID, change.action)
        }
        if (typesWithNoDeploy.includes(element.elemID.typeName)) {
          return []
        }
        if (typesDeployedViaParent.includes(element.elemID.typeName)) {
          const parents = getParents(element)
          if (
            !_.isEmpty(parents) &&
            parents.every(isReferenceExpression) &&
            parents.every(parent => isInstanceElement(parent.value))
          ) {
            const parentTypeName = _.uniq(parents.map(p => p.value.elemID.typeName))
            return parentTypeName.flatMap(getChangeErrorsByTypeName)
          }
        }
        return getChangeErrorsByTypeName(element.elemID.typeName)
      })
      .flat()
      .toArray()
}

/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isRemovalChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import _ from 'lodash'
import { getParents } from '@salto-io/adapter-utils'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { CUSTOM_OBJECT_FIELD_TYPE_NAME, CUSTOM_OBJECT_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues

/**
 * It is possible for a custom_object_field to have a reference to its parent custom_object.
 * In the case we can't delete the custom_object before deleting the custom_object_field
 * We need to remove the parent's dependency and add a reversed one to make sure the field is deleted first
 */
export const customObjectAndFieldDependencyChanger: DependencyChanger = async changes => {
  const relevantInstanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(
      (change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
        isInstanceChange(change.change) &&
        isRemovalChange(change.change) &&
        [CUSTOM_OBJECT_TYPE_NAME, CUSTOM_OBJECT_FIELD_TYPE_NAME].includes(getChangeData(change.change).elemID.typeName),
    )

  const customObjectFieldRemovals = relevantInstanceChanges.filter(
    ({ change }) => getChangeData(change).elemID.typeName === CUSTOM_OBJECT_FIELD_TYPE_NAME,
  )
  const customObjectRemovalsByName = _.keyBy(
    relevantInstanceChanges.filter(({ change }) => getChangeData(change).elemID.typeName === CUSTOM_OBJECT_TYPE_NAME),
    ({ change }) => getChangeData(change).elemID.name,
  )

  return customObjectFieldRemovals
    .flatMap(({ key, change }) => {
      const parentObject = getParents(getChangeData(change))[0]
      if (!isReferenceExpression(parentObject) || customObjectRemovalsByName[parentObject.elemID.name] === undefined) {
        return undefined
      }
      return [
        dependencyChange('add', customObjectRemovalsByName[parentObject.elemID.name].key, key),
        dependencyChange('remove', key, customObjectRemovalsByName[parentObject.elemID.name].key),
      ]
    })
    .filter(isDefined)
}

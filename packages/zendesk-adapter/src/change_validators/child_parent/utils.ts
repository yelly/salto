/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { fetch as fetchUtils } from '@salto-io/adapter-components'
import {
  AdditionChange,
  InstanceElement,
  isAdditionChange,
  isReferenceExpression,
  ModificationChange,
  ElemID,
} from '@salto-io/adapter-api'
import { ZendeskApiConfig } from '../../user_config'

const { makeArray } = collections.array

export type ChildParentRelationship = {
  parent: string
  child: string
  fieldName: string
}

const ADDITIONAL_CHILD_PARENT_RELATIONSHIPS: ChildParentRelationship[] = [
  { parent: 'macro', child: 'macro_attachment', fieldName: 'attachments' },
  { parent: 'brand', child: 'brand_logo', fieldName: 'logo' },
  { parent: 'article', child: 'article_attachment', fieldName: 'attachments' },
]

export const getChildAndParentTypeNames = (config: ZendeskApiConfig): ChildParentRelationship[] => {
  const parentTypes = Object.keys(
    _.omitBy(config.types, typeConfig => _.isEmpty(typeConfig.transformation?.standaloneFields)),
  )
  return parentTypes
    .flatMap(parentType => {
      const fields = config.types[parentType].transformation?.standaloneFields ?? []
      return fields.map(field => {
        const fullChildTypeName = fetchUtils.element.toNestedTypeName(parentType, field.fieldName)
        const childTypeName =
          Object.entries(config.types).find(
            ([_typeName, typeConfig]) => typeConfig.transformation?.sourceTypeName === fullChildTypeName,
          )?.[0] ?? fullChildTypeName
        return { parent: parentType, child: childTypeName, fieldName: field.fieldName }
      })
    })
    .concat(ADDITIONAL_CHILD_PARENT_RELATIONSHIPS)
}

const getIdsFromReferenceExpressions = (values: unknown): ElemID[] =>
  makeArray(values)
    .filter(isReferenceExpression)
    .map(ref => ref.elemID)

export const getRemovedAndAddedChildren = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  fieldName: string,
): { removed: ElemID[]; added: ElemID[] } => {
  const childrenBefore = isAdditionChange(change)
    ? []
    : getIdsFromReferenceExpressions(change.data.before.value[fieldName])
  const childrenAfter = getIdsFromReferenceExpressions(change.data.after.value[fieldName])
  const childrenBeforeLookup = new Set(childrenBefore.map(id => id.getFullName()))
  const childrenAfterLookup = new Set(childrenAfter.map(id => id.getFullName()))
  return {
    removed: childrenBefore.filter(child => !childrenAfterLookup.has(child.getFullName())),
    added: childrenAfter.filter(child => !childrenBeforeLookup.has(child.getFullName())),
  }
}

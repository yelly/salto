/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  Field,
  InstanceElement,
  isInstanceElement,
  ListType,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { GetLookupNameFunc, naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { findObject } from '../../utils'
import { FIELD_CONTEXT_TYPE_NAME } from './constants'

const log = logger(module)

export const getFieldsLookUpName: GetLookupNameFunc = ({ ref, path }) => {
  if (
    path !== undefined &&
    path.typeName === 'CustomFieldContext' &&
    (['optionId', 'cascadingOptionId'].includes(path.name) || path.createParentID().name === 'optionIds')
  ) {
    return ref.value.id
  }
  return ref
}

const getDefaultOptions = (
  instance: InstanceElement,
): {
  referencedDefaultOptions: Values[]
  referencedCascadingDefaultOption?: Values
} => {
  if (instance.value.defaultValue.optionIds !== undefined) {
    const optionsSet = new Set(instance.value.defaultValue?.optionIds)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const referencedDefaultOptions = (Object.values(instance.value.options ?? {}) as Values[]).filter(
      (option: Values) => optionsSet.has(option.id),
    )
    return { referencedDefaultOptions }
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const referencedDefaultOptions = (Object.values(instance.value.options ?? {}) as Values[]).filter(
    (option: Values) => instance.value.defaultValue.optionId === option.id,
  )
  const referencedCascadingDefaultOption =
    referencedDefaultOptions.length > 0
      ? _.values(referencedDefaultOptions[0].cascadingOptions ?? {}).find(
          (option: Values) => option.id === instance.value.defaultValue.cascadingOptionId,
        )
      : undefined
  return { referencedDefaultOptions, referencedCascadingDefaultOption }
}

const hasOptionValue = (defaultValue: Values): boolean =>
  defaultValue !== undefined && (defaultValue.optionId !== undefined || defaultValue.optionIds !== undefined)

const filter: FilterCreator = ({ config }) => ({
  name: 'fieldTypeReferencesFilter',
  onFetch: async (elements: Element[]) => {
    const optionType = findObject(elements, 'CustomFieldContextOption')
    const defaultValueType = findObject(elements, 'CustomFieldContextDefaultValue')

    if (optionType !== undefined && defaultValueType !== undefined) {
      defaultValueType.fields.optionId = new Field(defaultValueType, 'optionId', optionType)
      defaultValueType.fields.cascadingOptionId = new Field(defaultValueType, 'optionId', optionType)
      defaultValueType.fields.optionIds = new Field(defaultValueType, 'optionIds', new ListType(optionType))
    }
    if (config.fetch.splitFieldContextOptions) {
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(instance => hasOptionValue(instance.value.defaultValue))
      .forEach(instance => {
        const optionsElemId = instance.elemID.createNestedID('options')
        const { referencedDefaultOptions, referencedCascadingDefaultOption } = getDefaultOptions(instance)

        if (referencedDefaultOptions.length === 0) {
          if (
            (instance.value.defaultValue.optionIds !== undefined && instance.value.defaultValue.optionIds.length > 0) ||
            instance.value.defaultValue.optionId !== undefined
          ) {
            log.warn(
              `Could not find reference for default options ids ${instance.value.defaultValue.optionIds} in instance ${instance.elemID.getFullName()}`,
            )
          }
          return
        }
        const optionIdsReferences = referencedDefaultOptions.map(
          option => new ReferenceExpression(optionsElemId.createNestedID(naclCase(option.value)), option),
        )
        if (instance.value.defaultValue.optionIds !== undefined) {
          const optionRefIds = _.keyBy(optionIdsReferences, ref => ref.value.id)
          instance.value.defaultValue.optionIds = optionIdsReferences.concat(
            instance.value.defaultValue.optionIds.filter((id: string) => optionRefIds[id] === undefined),
          )
        } else {
          ;[instance.value.defaultValue.optionId] = optionIdsReferences

          if (referencedCascadingDefaultOption === undefined) {
            if (instance.value.defaultValue.cascadingOptionId !== undefined) {
              log.warn(
                `Could not find reference for default cascading option id ${instance.value.defaultValue.cascadingOptionId} in instance ${instance.elemID.getFullName()}`,
              )
            }
            return
          }
          instance.value.defaultValue.cascadingOptionId = new ReferenceExpression(
            optionsElemId
              .createNestedID(naclCase(referencedDefaultOptions[0].value))
              .createNestedID('cascadingOptions', naclCase(referencedCascadingDefaultOption.value)),
            referencedCascadingDefaultOption,
          )
        }
      })
  },
})

export default filter

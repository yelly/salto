/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  Element,
  isObjectType,
  Field,
  BuiltinTypes,
  ReferenceExpression,
  isRemovalChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { addIdsToChildrenUponAddition, deployChange, deployChanges, deployChangesByGroups } from '../../deployment'
import { applyforInstanceChangesOfType, getCustomFieldOptionsFromChanges } from '../utils'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../constants'

export const DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME = 'default_custom_field_option'

const log = logger(module)

export type CustomFieldOptionsFilterCreatorParams = {
  filterName: string
  parentTypeName: string
  childTypeName: string
  onFetch?: (elements: Element[]) => Promise<void>
}

const { makeArray } = collections.array

export const createCustomFieldOptionsFilterCreator =
  ({ filterName, parentTypeName, childTypeName }: CustomFieldOptionsFilterCreatorParams): FilterCreator =>
  ({ oldApiDefinitions, client, elementSource, definitions }) => ({
    name: filterName,
    onFetch: async (elements: Element[]): Promise<void> => {
      const parentType = elements.filter(isObjectType).find(inst => inst.elemID.typeName === parentTypeName)
      if (parentType === undefined) {
        return
      }
      parentType.fields[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME] = new Field(
        parentType,
        DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME,
        BuiltinTypes.STRING,
      )
      const parentInstances = elements
        .filter(isInstanceElement)
        .filter(inst => inst.elemID.typeName === parentTypeName)
        .filter(inst => inst.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] !== undefined)
      const parentIdToChildInstances = _(elements)
        .filter(isInstanceElement)
        .filter(inst => inst.elemID.typeName === childTypeName)
        .filter(childInst => getParents(childInst)?.[0] !== undefined)
        .groupBy(childInst => getParents(childInst)[0].value.value.id)
        .value()
      parentInstances.forEach(inst => {
        const options = parentIdToChildInstances[inst.value.id] ?? []
        const defaultOption = options.find(option => option?.value?.default === true)
        if (defaultOption) {
          inst.value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME] = new ReferenceExpression(
            defaultOption.elemID,
            defaultOption,
          )
        }
        options.forEach(option => {
          delete option.value.default
        })
      })
    },
    preDeploy: async changes => {
      await applyforInstanceChangesOfType(changes, [parentTypeName], (instance: InstanceElement) => {
        const defaultValue = instance.value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]
        const options = makeArray(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME])
        if (options.length > 0) {
          options.forEach(option => {
            option.default = defaultValue !== undefined && option.value === defaultValue
          })
        }
        return instance
      })
      getCustomFieldOptionsFromChanges(parentTypeName, childTypeName, changes).forEach(option => {
        option.name = option.raw_name
      })
    },
    onDeploy: async changes => {
      await applyforInstanceChangesOfType(changes, [parentTypeName], async (instance: InstanceElement) => {
        const options = makeArray(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME])
        if (options.length > 0) {
          // replace with the original references - since the current restore logic
          // does not restore references correctly when the resolved values contain templates
          const originalInstance = await elementSource.get(instance.elemID)
          if (originalInstance === undefined) {
            log.warn('Could not find original instance for %s, not replacing options', instance.elemID.getFullName())
            return instance
          }
          const originalOptions = makeArray(originalInstance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME])
          if (originalOptions.every(isReferenceExpression)) {
            instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = originalOptions
          }
        }
        return instance
      })
      getCustomFieldOptionsFromChanges(parentTypeName, childTypeName, changes).forEach(option => {
        delete option.name
      })
    },
    deploy: async (changes: Change<InstanceElement>[]) => {
      const [relevantChanges, leftoverChanges] = _.partition(changes, change =>
        [parentTypeName, childTypeName].includes(getChangeData(change).elemID.typeName),
      )
      if (relevantChanges.length === 0) {
        return {
          leftoverChanges: changes,
          deployResult: {
            errors: [],
            appliedChanges: [],
          },
        }
      }
      const [parentChanges, childrenChanges] = _.partition(
        relevantChanges,
        change => getChangeData(change).elemID.typeName === parentTypeName,
      )

      if (parentChanges.length === 0) {
        // The service does not allow us to have an field with no options - therefore, we need to do
        //  the removal changes last
        const [removalChanges, nonRemovalChanges] = _.partition(childrenChanges, isRemovalChange)
        const deployResult = await deployChangesByGroups(
          [nonRemovalChanges, removalChanges] as Change<InstanceElement>[][],
          async change => {
            await deployChange({
              change,
              client,
              apiDefinitions: oldApiDefinitions,
              definitions,
            })
          },
        )
        return { deployResult, leftoverChanges }
      }
      const deployResult = await deployChanges(parentChanges, async change => {
        const response = await deployChange({
          change,
          client,
          apiDefinitions: oldApiDefinitions,
          definitions,
          fieldsToIgnore: [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        })
        return addIdsToChildrenUponAddition({
          response,
          parentChange: change,
          childrenChanges,
          apiDefinitions: oldApiDefinitions,
          definitions,
          childFieldName: CUSTOM_FIELD_OPTIONS_FIELD_NAME,
          childUniqueFieldName: 'value',
        })
      })
      return { deployResult, leftoverChanges }
    },
  })

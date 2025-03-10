/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Change, getChangeData, InstanceElement, isRemovalChange, Value, Values } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { applyforInstanceChangesOfType } from './utils'
import { VIEW_TYPE_NAME } from '../constants'

const valToString = (val: Value): string | string[] => (_.isArray(val) ? val.map(String) : val?.toString())

/**
 * Deploys views
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'viewFilter',
  preDeploy: async changes => {
    await applyforInstanceChangesOfType(changes, [VIEW_TYPE_NAME], (instance: InstanceElement) => {
      instance.value = {
        ...instance.value,
        restriction: instance.value.restriction ?? null,
        all: (instance.value.conditions.all ?? []).map((e: Values) => ({ ...e, value: valToString(e.value) })),
        any: (instance.value.conditions.any ?? []).map((e: Values) => ({ ...e, value: valToString(e.value) })),
        output: {
          ...instance.value.execution,
          group_by: instance.value.execution.group_by?.toString(),
          sort_by: instance.value.execution.sort_by?.toString(),
          columns:
            instance.value.execution.columns
              ?.filter(_.isPlainObject)
              .map((c: Values) => c.id)
              .filter(values.isDefined) ?? [],
        },
        // copying raw_title to title means that title might now be a dynamic content token
        // and not a raw string. Since the title field is hidden, this should be safe
        title: instance.value.raw_title,
      }
      return instance
    })
  },
  onDeploy: async changes => {
    await applyforInstanceChangesOfType(changes, [VIEW_TYPE_NAME], (instance: InstanceElement) => {
      const baseValuesToOmit = ['all', 'any', 'output']
      const valuesToOmit = instance.value.restriction === null ? [...baseValuesToOmit, 'restriction'] : baseValuesToOmit
      instance.value = _.omit(instance.value, valuesToOmit)
      return instance
    })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [viewChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === VIEW_TYPE_NAME && !isRemovalChange(change),
    )
    const deployResult = await deployChanges(viewChanges, async change => {
      await deployChange({
        change,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
        fieldsToIgnore: ['conditions', 'execution'],
      })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator

/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import {
  DependencyChange,
  isInstanceChangeEntry,
  InstanceElement,
  ChangeEntry,
  DependencyChanger,
  getChangeData,
  isField,
  isDependentAction,
  addReferenceDependency,
} from '@salto-io/adapter-api'

const { awu } = collections.asynciterable

export const addInstanceToFieldsDependency: DependencyChanger = async changes => {
  const fieldChanges = collections.iterable.groupBy(
    wu(changes).filter(([_id, change]) => isField(getChangeData(change))),
    ([_id, change]) => getChangeData(change).elemID.getFullName(),
  )

  const addChangeFieldDependency = async ([id, change]: ChangeEntry<InstanceElement>): Promise<DependencyChange[]> => {
    const fieldsElemIDs = Object.values((await getChangeData(change).getType()).fields).map(field =>
      field.elemID.getFullName(),
    )
    return fieldsElemIDs
      .flatMap(fieldName => fieldChanges.get(fieldName) ?? [])
      .filter(([_id, fieldChange]) => isDependentAction(change.action, fieldChange.action))
      .map(([fieldChangeId, fieldChange]) => addReferenceDependency(fieldChange.action, id, fieldChangeId))
  }

  return awu(changes).filter(isInstanceChangeEntry).flatMap(addChangeFieldDependency).toArray()
}

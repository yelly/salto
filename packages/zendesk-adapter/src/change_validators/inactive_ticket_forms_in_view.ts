/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'

import {
  ChangeValidator,
  Value,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'

import { VIEW_TYPE_NAME, TICKET_FORM_TYPE_NAME } from '../constants'
import { ConditionWithReferenceValue } from './utils'

const log = logger(module)

const isConditionWithReference = (condition: Value): condition is ConditionWithReferenceValue =>
  _.isString(condition.field) && isReferenceExpression(condition.value)

/*
 * This change validator checks that a user does not reference deactivated
 * Ticket Forms from within a View's conditions
 */
export const inactiveTicketFormInViewValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run inactiveTicketFormInViewValidator because element source is undefined')
    return []
  }

  const changedViewsInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === VIEW_TYPE_NAME)
    .filter(change => getChangeData(change).value?.conditions !== undefined)
    .map(getChangeData)

  if (changedViewsInstances.length === 0) {
    return []
  }

  const existingTicketFormInstances = await getInstancesFromElementSource(elementSource, [TICKET_FORM_TYPE_NAME])
  const deactivatedTicketFormIDs = new Set(
    existingTicketFormInstances
      .filter(ticketForm => ticketForm.value.active === false)
      .map(form => form.elemID.getFullName()),
  )

  return changedViewsInstances.flatMap(instance => {
    const conditions = (instance.value.conditions.all ?? []).concat(instance.value.conditions.any ?? [])

    // cross-reference deactivated ticket forms with conditions in the view
    const deactivatedTicketsReferenced: string[] = conditions
      .filter(isConditionWithReference)
      .filter((condition: ConditionWithReferenceValue) => condition.field === 'ticket_form_id')
      .filter((condition: ConditionWithReferenceValue) =>
        deactivatedTicketFormIDs.has(condition.value.elemID.getFullName()),
      )
      .map((condition: ConditionWithReferenceValue) => condition.value.elemID.name)

    if (deactivatedTicketsReferenced.length === 0) {
      return []
    }

    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: 'View uses deactivated ticket forms',
      detailedMessage: `Deactivated ticket forms cannot be used in the conditions of a view. The Deactivated forms used are: ${_.uniq(deactivatedTicketsReferenced).join(', ')}`,
    }
  })
}

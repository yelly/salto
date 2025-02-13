/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
  UnresolvedReference,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { TICKET_FORM_ORDER_TYPE_NAME, TICKET_FORM_TYPE_NAME, ZENDESK } from '../../src/constants'
import { ticketFormDependencyChanger } from '../../src/dependency_changers/ticket_form_change'

describe('ticketFormDependencyChanger', () => {
  const addTicketFormIncluded = new InstanceElement(
    'addTicketFormIncluded',
    new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }),
  )
  const addTicketFormExcluded = new InstanceElement(
    'addTicketFormExcluded',
    new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }),
  )
  const removeTicketFormIncluded = new InstanceElement(
    'removeTicketFormIncluded',
    new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }),
  )
  const removeTicketFormExcluded = new InstanceElement(
    'removeTicketFormExcluded',
    new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }),
  )
  const ticketFormModify = new InstanceElement(
    'ticketFormModify',
    new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }),
  )
  const ticketFormOrder = new InstanceElement(
    'ticketFormOrder',
    new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_ORDER_TYPE_NAME) }),
    {
      active: [new ReferenceExpression(addTicketFormIncluded.elemID, addTicketFormIncluded)],
      inactive: [
        new ReferenceExpression(removeTicketFormIncluded.elemID, removeTicketFormIncluded),
        // Should be filtered
        new ReferenceExpression(removeTicketFormIncluded.elemID, new UnresolvedReference(addTicketFormExcluded.elemID)),
      ],
    },
  )

  it('should create the correct dependencies', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: addTicketFormIncluded })], // Should have nothing
      [1, toChange({ after: addTicketFormExcluded })], // ticket_form_order should depend on this
      [2, toChange({ before: removeTicketFormIncluded })], // Should depend on ticket_form_order
      [3, toChange({ before: removeTicketFormExcluded })], // Should depend on ticket_form_order
      [4, toChange({ before: ticketFormModify, after: ticketFormModify })], // Should have nothing
      [5, toChange({ before: ticketFormOrder, after: ticketFormOrder })],
    ])

    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
      [2, new Set()],
      [3, new Set()],
      [4, new Set()],
      [5, new Set()],
    ])

    const dependencyChanges = [...(await ticketFormDependencyChanger(inputChanges, inputDeps))]

    expect(dependencyChanges).toHaveLength(3)
    expect(dependencyChanges[0].dependency).toMatchObject({ source: 1, target: 5 })
    expect(dependencyChanges[1].dependency).toMatchObject({ source: 5, target: 2 })
    expect(dependencyChanges[2].dependency).toMatchObject({ source: 5, target: 3 })
  })
})

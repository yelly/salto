/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  InstanceElement,
  ElemID,
  toChange,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { fieldContextDependencyChanger } from '../../src/dependency_changers/field_contexts'
import { JIRA } from '../../src/constants'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../src/filters/fields/constants'

describe('fieldContextsDependencyChanger', () => {
  let contextType: ObjectType
  let fieldType: ObjectType
  let contextInstance: InstanceElement
  let fieldInstance: InstanceElement
  let modifiedFieldInstance: InstanceElement

  beforeEach(() => {
    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
    })
    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    fieldInstance = new InstanceElement('inst', fieldType, {
      description: 'description',
    })
    modifiedFieldInstance = new InstanceElement('inst', fieldType, {
      description: 'change description',
    })
    contextInstance = new InstanceElement('inst', contextType, undefined, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
    })
  })
  it('should reverse the dependency between the field and the context', async () => {
    const inputChanges = new Map([
      [0, toChange({ before: fieldInstance, after: modifiedFieldInstance })],
      [1, toChange({ after: contextInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([[0, new Set([1])]])

    const dependencyChanges = [...(await fieldContextDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)
  })
  it('should not reverse any dependency because we do not add new context', async () => {
    const inputChanges = new Map([
      [0, toChange({ before: fieldInstance, after: modifiedFieldInstance })],
      [1, toChange({ before: contextInstance, after: contextInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([[0, new Set([1])]])

    const dependencyChanges = [...(await fieldContextDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toBeEmpty()
  })
  it('should not reverse any dependency because the dependency does not in the input dependencies', async () => {
    const inputChanges = new Map([
      [0, toChange({ before: fieldInstance, after: modifiedFieldInstance })],
      [1, toChange({ after: contextInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await fieldContextDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toBeEmpty()
  })

  it('should not reverse any dependency because the modified field does not have a relevant dependency', async () => {
    const inputChanges = new Map([[0, toChange({ before: fieldInstance, after: modifiedFieldInstance })]])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([[0, new Set([1])]])

    const dependencyChanges = [...(await fieldContextDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toBeEmpty()
  })
})

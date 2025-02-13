/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeId,
  Change,
  DependencyChange,
  InstanceElement,
  ObjectType,
  toChange,
  getChangeData,
} from '@salto-io/adapter-api'
import { dependencyChanger } from '../src/dependency_changer'
import { mockTypes } from './mock_elements'
import { Types } from '../src/transformers/transformer'

const createChangeId = (change: Change): ChangeId => getChangeData(change).elemID.getFullName()

const createChangeMapFromChanges = (changes: Change[]): Map<ChangeId, Change> =>
  new Map(changes.map(change => [createChangeId(change), change]))

describe('Dependency Changer', () => {
  let instanceChange: Change<InstanceElement>
  let objectType: ObjectType
  let typeChange: Change<ObjectType>
  let changes: Map<ChangeId, Change>
  let deps: DependencyChange[]
  beforeEach(() => {
    objectType = mockTypes.Account
    typeChange = toChange({ after: objectType })
  })
  describe('if there is no matching type', () => {
    beforeEach(async () => {
      instanceChange = toChange({
        after: new InstanceElement('testInstance', objectType),
      })
      changes = createChangeMapFromChanges([instanceChange])
      deps = Array.from(await dependencyChanger(changes, new Map()))
    })

    it('should not create a dep', () => {
      expect(deps).toBeEmpty()
    })
  })
  describe('if the change is not of a custom object', () => {
    beforeEach(async () => {
      const standardType = Types.createObjectType('SomeType', false)
      instanceChange = toChange({
        after: new InstanceElement('testInstance', standardType),
      })
      changes = createChangeMapFromChanges([instanceChange, toChange({ after: standardType })])
      deps = Array.from(await dependencyChanger(changes, new Map()))
    })

    it('should not create a dep', () => {
      expect(deps).toBeEmpty()
    })
  })
  describe('if there are no instance changes', () => {
    beforeEach(async () => {
      changes = createChangeMapFromChanges([typeChange])
      deps = Array.from(await dependencyChanger(changes, new Map()))
    })
    it('should not create a dep', () => {
      expect(deps).toBeEmpty()
    })
  })
  describe('if the change is instance removal', () => {
    beforeEach(async () => {
      instanceChange = toChange({
        before: new InstanceElement('testInstance', objectType),
      })
      changes = createChangeMapFromChanges([typeChange, instanceChange])
      deps = Array.from(await dependencyChanger(changes, new Map()))
    })
    it('should not create a dep', () => {
      expect(deps).toBeEmpty()
    })
  })
  describe('if the change is instance addition', () => {
    beforeEach(async () => {
      instanceChange = toChange({
        after: new InstanceElement('testInstance', objectType),
      })
      changes = createChangeMapFromChanges([instanceChange, typeChange])
      deps = Array.from(await dependencyChanger(changes, new Map()))
    })
    it('should create a dep', () => {
      expect(deps).toEqual([
        {
          action: 'add',
          dependency: {
            source: createChangeId(instanceChange),
            target: createChangeId(typeChange),
          },
        },
      ])
    })
  })
  describe('if the change is instance modification', () => {
    beforeEach(async () => {
      const instanceElement = new InstanceElement('testInstance', objectType)
      instanceChange = toChange({
        before: instanceElement,
        after: instanceElement,
      })
      changes = createChangeMapFromChanges([instanceChange, typeChange])
      deps = Array.from(await dependencyChanger(changes, new Map()))
    })
    it('should create a dep', () => {
      expect(deps).toEqual([
        {
          action: 'add',
          dependency: {
            source: createChangeId(instanceChange),
            target: createChangeId(typeChange),
          },
        },
      ])
    })
  })
})

/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  DetailedChangeWithBaseChange,
  ElemID,
  InstanceElement,
  isInstanceElement,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { setPath } from '@salto-io/adapter-utils'
import * as workspace from '@salto-io/workspace'
import * as rename from '../../src/core/rename'
import * as mockElements from '../common/elements'
import { mockWorkspace } from '../common/workspace'

describe('rename.ts', () => {
  let ws: workspace.Workspace
  let sourceElemId: ElemID
  let elements: workspace.ElementsSource
  beforeAll(async () => {
    const workspaceElements = mockElements.getAllElements()
    ws = mockWorkspace({ elements: workspaceElements })
    elements = await ws.elements()
    sourceElemId = new ElemID('salto', 'employee', 'instance', 'original')
  })

  describe('renameChecks', () => {
    it('should pass checks', async () => {
      const targetElemId = new ElemID(sourceElemId.adapter, sourceElemId.typeName, sourceElemId.idType, 'renamed')
      expect(await rename.renameChecks(ws, sourceElemId, targetElemId)).toBeUndefined()
    })
    it('should throw when source and target ids are the same', async () =>
      expect(rename.renameChecks(ws, sourceElemId, sourceElemId)).rejects.toThrow(
        `Source and target element ids are the same: ${sourceElemId.getFullName()}`,
      ))
    it('should throw when source element is not top level', async () => {
      const fieldElemId = new ElemID('salto', 'address', 'field', 'country')
      const targetElemId = new ElemID('salto', 'address', 'field', 'renamed')
      return expect(rename.renameChecks(ws, fieldElemId, targetElemId)).rejects.toThrow(
        'Source element should be top level',
      )
    })
    it('should throw when target element is not top level', async () => {
      const fieldElemId = new ElemID('salto', 'address', 'instance', 'country')
      const targetElemId = new ElemID('salto', 'address', 'field', 'renamed')
      return expect(rename.renameChecks(ws, fieldElemId, targetElemId)).rejects.toThrow(
        'Target element should be top level',
      )
    })
    it('should throw when source element is not InstanceElement', async () => {
      const objectElemId = new ElemID('salto', 'address')
      const targetElemId = new ElemID('salto', 'renamed')
      return expect(rename.renameChecks(ws, objectElemId, targetElemId)).rejects.toThrow(
        `Currently supporting InstanceElement only (${objectElemId.getFullName()} is of type '${objectElemId.idType}')`,
      )
    })
    it('should throw when trying to rename something else than instance name', async () => {
      const targetElemId = new ElemID(sourceElemId.adapter, 'renamed')
      return expect(rename.renameChecks(ws, sourceElemId, targetElemId)).rejects.toThrow(
        'Only instance name renaming is allowed',
      )
    })
    it("should throw when sourceElementId doesn't exists", async () => {
      const notSourceElemId = new ElemID(sourceElemId.adapter, sourceElemId.typeName, sourceElemId.idType, 'notExist')
      const targetElemId = new ElemID(sourceElemId.adapter, sourceElemId.typeName, sourceElemId.idType, 'renamed')
      return expect(rename.renameChecks(ws, notSourceElemId, targetElemId)).rejects.toThrow(
        `Did not find any matches for element ${notSourceElemId.getFullName()}`,
      )
    })
    it('should throw when targetElementId already exists', async () => {
      const existElementId = mockElements
        .getAllElements()
        .filter(isInstanceElement)
        .map(e => e.elemID)
        .find(e => e.getFullName() !== sourceElemId.getFullName()) as ElemID
      return expect(rename.renameChecks(ws, sourceElemId, existElementId)).rejects.toThrow(
        `Element ${existElementId.getFullName()} already exists`,
      )
    })
    it('should throw when targetElementId exists only in the state', async () => {
      const workspaceElements = mockElements.getAllElements()
      const removedElemId = workspaceElements
        .filter(isInstanceElement)
        .map(e => e.elemID)
        .find(e => !e.isEqual(sourceElemId)) as ElemID

      const newWs = mockWorkspace({
        elements: workspaceElements.filter(e => !e.elemID.isEqual(removedElemId)),
        stateElements: workspaceElements,
      })
      return expect(rename.renameChecks(newWs, sourceElemId, removedElemId)).rejects.toThrow(
        `Cannot rename to the removed element id ${removedElemId.getFullName()}`,
      )
    })
  })
  describe('renameElement', () => {
    let expectedChanges: DetailedChangeWithBaseChange[]
    let changes: DetailedChangeWithBaseChange[]
    let targetElement: InstanceElement
    beforeAll(async () => {
      const sourceElement = await ws.getValue(sourceElemId)

      targetElement = new InstanceElement(
        'renamed',
        sourceElement.refType,
        _.merge({}, sourceElement.value, {
          friend: new ReferenceExpression(ElemID.fromFullName('salto.employee.instance.renamed')),
        }),
        sourceElement.path,
        sourceElement.annotations,
      )

      const refElemId = new ElemID('salto', 'employee', 'instance', 'anotherInstance', 'friend')
      const beforeRef = new ReferenceExpression(sourceElemId)
      const afterRef = new ReferenceExpression(targetElement.elemID)

      const elementWithReference = await ws.getValue(refElemId.createTopLevelParentID().parent)
      const elementWithRenamedReference = elementWithReference.clone()
      setPath(elementWithRenamedReference, refElemId, afterRef)

      const baseRemoveChange = toChange({ before: sourceElement })
      const baseAddChange = toChange({ after: targetElement })
      const baseModifyChange = toChange({ before: elementWithReference, after: elementWithRenamedReference })

      expectedChanges = [
        { id: sourceElemId, baseChange: baseRemoveChange, ...baseRemoveChange },
        { id: targetElement.elemID, baseChange: baseAddChange, ...baseAddChange },
        {
          id: refElemId,
          action: 'modify',
          data: { before: beforeRef, after: afterRef },
          elemIDs: { before: refElemId, after: refElemId },
          baseChange: baseModifyChange,
        },
      ]

      changes = await rename.renameElement(elements, sourceElemId, targetElement.elemID)
    })
    it('should return changes', () => {
      expect(changes).toEqual(expectedChanges)
    })
    it('should update pathIndex', async () => {
      const topLevelPaths = [
        ['salto', 'records', 'instance', 'main'],
        ['salto', 'records', 'instance', 'personal'],
      ]
      const specificPath = [topLevelPaths[1]]

      const workspaceElements = mockElements.getAllElements()
      const newWs = mockWorkspace({ elements: workspaceElements })
      const index = await newWs.state().getPathIndex()
      await index.set(sourceElemId.getFullName(), topLevelPaths)
      const nestedElemId = sourceElemId.createNestedID('name')
      await index.set(nestedElemId.getFullName(), specificPath)

      const targetElemId = new ElemID(sourceElemId.adapter, sourceElemId.typeName, sourceElemId.idType, 'renamed')

      await rename.renameElement(await newWs.elements(), sourceElemId, targetElemId, index)
      expect(await index.get(sourceElemId.getFullName())).toBeUndefined()
      expect(await index.get(nestedElemId.getFullName())).toBeUndefined()
      expect(await index.get(targetElemId.getFullName())).toEqual(topLevelPaths)
      expect(await index.get(targetElemId.createNestedID('name').getFullName())).toEqual(specificPath)
    })
  })
})

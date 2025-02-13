/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import path from 'path'
import { logger } from '@salto-io/logging'
import {
  getChangeData,
  isElement,
  isField,
  ObjectType,
  ElemID,
  isType,
  isAdditionChange,
  Value,
  StaticFile,
  isStaticFile,
  TypeReference,
  isTypeReference,
  DetailedChangeWithBaseChange,
  toChange,
  isRemovalOrModificationChange,
  isAdditionOrModificationChange,
  DetailedChange,
} from '@salto-io/adapter-api'
import { ActionName } from '@salto-io/dag'
import {
  inspectValue,
  getPath,
  walkOnElement,
  WalkOnFunc,
  WALK_NEXT_STEP,
  getDetailedChanges,
} from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { parser } from '@salto-io/parser'

const { awu } = collections.asynciterable
const { isDefined } = values

const log = logger(module)

// Declared again to prevent cyclic dependency
const FILE_EXTENSION = '.nacl'

type Location = parser.SourceRange & { indexInParent?: number }

export type DetailedChangeWithSource = DetailedChange & {
  location: Location
  requiresIndent?: boolean
}

type DetailedAddition = DetailedChangeWithBaseChange & { action: 'add' }

const createFileNameFromPath = (pathParts?: ReadonlyArray<string>): string =>
  `${path.join(...(pathParts ?? ['unsorted']))}${FILE_EXTENSION}`

type PositionInParent = {
  followingElementIDs: ElemID[]
  indexInParent?: number
}

const getPositionInParent = (change: DetailedAddition): PositionInParent => {
  if (change.baseChange === undefined) {
    // this can happen only if there was a casting of a DetailedChange to a DetailedChangeWithBaseChange somewhere in the way.
    log.warn('No base change: %s', inspectValue(change))
    return { followingElementIDs: [] }
  }

  const changeData = getChangeData(change)
  const parent = isField(changeData) ? changeData.parent : getChangeData(change.baseChange)
  const pathInParent = getPath(parent, change.id)
  if (pathInParent === undefined) {
    log.warn('Could not get path for %s in parent: %s', change.id.getFullName(), inspectValue(parent))
    return { followingElementIDs: [] }
  }
  if (pathInParent.length === 0) {
    // This is a top level element
    return { followingElementIDs: [] }
  }

  const container = _.get(parent, pathInParent.slice(0, -1))
  if (!_.isObjectLike(container)) {
    log.warn(
      'Got non object container at path %s: %s',
      change.id.createParentID().getFullName(),
      inspectValue(container),
    )
    return { followingElementIDs: [] }
  }

  const elementName = change.id.name
  const containerKeys = Object.keys(container)
  const index = containerKeys.indexOf(elementName)
  if (index === -1) {
    log.warn('Element %s not found in container: %s', elementName, inspectValue(container))
    return { followingElementIDs: [] }
  }

  return {
    followingElementIDs: containerKeys.slice(index + 1).map(k => change.id.createSiblingID(k)),
    indexInParent: index,
  }
}

export const getChangeLocations = (
  change: DetailedChangeWithBaseChange,
  sourceMap: parser.SourceMap,
): DetailedChangeWithSource[] => {
  const lastNestedLocation = (parentScope: parser.SourceRange): parser.SourceRange => {
    // We want to insert just before the scope's closing bracket, so we place the change
    // one byte before the closing bracket.
    const nestedPosition = {
      line: parentScope.end.line,
      col: parentScope.start.col,
      byte: parentScope.end.byte - 1,
    }
    return {
      filename: parentScope.filename,
      start: nestedPosition,
      end: nestedPosition,
    }
  }

  const findLocations = (): { location: Location; requiresIndent?: boolean }[] => {
    if (change.action !== 'add') {
      // We want to get the location of the existing element
      const possibleLocations = sourceMap.get(change.id.getFullName()) ?? []
      if (change.action === 'remove') {
        return possibleLocations.map(location => ({
          location,
        }))
      }
      if (possibleLocations.length > 0) {
        // TODO: figure out how to choose the correct location if there is more than one option
        return [{ location: possibleLocations[0] }]
      }
    } else if (!change.id.isTopLevel()) {
      const fileName = createFileNameFromPath(change.path)
      const { followingElementIDs, indexInParent } = getPositionInParent(change)
      const possibleFollowingElementsRange = followingElementIDs
        .flatMap(elemID => sourceMap.get(elemID.getFullName()))
        .filter(isDefined)
        .find(sr => sr.filename === fileName)
      if (possibleFollowingElementsRange !== undefined) {
        // Returning the start location of the first element following the one we are adding in the same file
        return [
          {
            location: {
              filename: fileName,
              start: possibleFollowingElementsRange.start,
              end: possibleFollowingElementsRange.start,
              indexInParent,
            },
          },
        ]
      }

      // If we can't find an element after this one in the parent we put it at the end
      const parentID = change.id.createParentID()
      const possibleLocations = sourceMap.get(parentID.getFullName()) ?? []
      if (possibleLocations.length > 0) {
        const foundInPath = possibleLocations.find(sr => sr.filename === fileName)
        // When adding a nested change we need to increase one level of indentation because
        // we get the placement of the closing brace of the next line. The closing brace will
        // be indented one line less then wanted change.
        // TODO: figure out how to choose the correct location if there is more than one option
        return [{ location: lastNestedLocation(foundInPath ?? possibleLocations[0]), requiresIndent: true }]
      }
      log.error('No possible locations found for %s.', parentID.getFullName())
    }
    // Fallback to using the path from the element itself
    const naclFilePath = change.path ?? getChangeData(change).path
    const endOfFileLocation = { col: 1, line: Infinity, byte: Infinity }
    return [
      {
        location: {
          filename: createFileNameFromPath(naclFilePath),
          start: endOfFileLocation,
          end: endOfFileLocation,
        },
      },
    ]
  }

  return findLocations().map(location => ({
    ...change,
    ...location,
  }))
}

const fixEdgeIndentation = (data: string, action: ActionName, initialIndentationLevel: number): string => {
  if (action === 'remove' || initialIndentationLevel === 0) return data
  const lines = data.split('\n')
  const [firstLine] = lines
  const lastLine = lines.pop()
  if (lastLine !== undefined && lastLine !== '') {
    // This currently never happens. The last line that is returned from hclDump is empty.
    lines.push(lastLine)
  }
  if (action === 'add') {
    // When adding the placement we are given is right before following member or the closing bracket of the parent.
    // The string that dump gave us has an empty last line, meaning we have to recreate the
    // indentation that was there previously. We also have to slice from the beginning of the first
    // line the initial indentation that was there in the beginning.
    return [
      firstLine.slice(initialIndentationLevel),
      ...lines.slice(1),
      firstLine.slice(0, initialIndentationLevel),
    ].join('\n')
  }
  // If we reached here we are handling modify.
  // The first line is already indented. We need to remove the excess indentation in the first line.
  return [firstLine.trimLeft(), ...lines.slice(1)].join('\n')
}

const isAnnotationTypeAddChange = (change: DetailedChangeWithBaseChange): change is DetailedAddition =>
  change.id.isAnnotationTypeID() && isAdditionChange(change)

const createGroupedAddAnnotationTypesChange = (
  annotationTypesAddChanges: DetailedAddition[],
): DetailedChangeWithBaseChange => {
  const change = annotationTypesAddChanges[0]
  const addedAnnotations = Object.fromEntries(annotationTypesAddChanges.map(c => [c.id.name, c.data.after]))

  const baseBefore = isRemovalOrModificationChange(change.baseChange)
    ? change.baseChange.data.before.clone()
    : undefined
  if (baseBefore !== undefined) {
    baseBefore.annotationRefTypes = {}
  }

  const baseAfter = isAdditionOrModificationChange(change.baseChange) ? change.baseChange.data.after.clone() : undefined
  if (baseAfter !== undefined) {
    baseAfter.annotationRefTypes = addedAnnotations
  }

  return {
    id: new ElemID(change.id.adapter, change.id.typeName, 'annotation'),
    action: 'add',
    data: {
      after: addedAnnotations,
    },
    baseChange: toChange({ before: baseBefore, after: baseAfter }),
  }
}

const objectHasAnnotationTypesBlock = (topLevelIdFullName: string, sourceMap: parser.SourceMap): boolean =>
  sourceMap.has(ElemID.fromFullName(topLevelIdFullName).createNestedID('annotation').getFullName())

const groupAnnotationTypeChanges = (
  fileChanges: DetailedChangeWithBaseChange[],
  sourceMap: parser.SourceMap,
): DetailedChangeWithBaseChange[] => {
  const [annotationTypesAddChanges, otherChanges] = _.partition(fileChanges, isAnnotationTypeAddChange)
  const topLevelIdToAnnoTypeAddChanges = _.groupBy(annotationTypesAddChanges, change =>
    change.id.createTopLevelParentID().parent.getFullName(),
  )
  const transformedAnnotationTypeChanges = Object.entries(topLevelIdToAnnoTypeAddChanges).flatMap(
    ([topLevelIdFullName, objectAnnotationTypesAddChanges]) => {
      if (objectHasAnnotationTypesBlock(topLevelIdFullName, sourceMap)) {
        return objectAnnotationTypesAddChanges
      }
      return createGroupedAddAnnotationTypesChange(objectAnnotationTypesAddChanges)
    },
  )
  return transformedAnnotationTypeChanges.concat(otherChanges)
}

const removeBracketLines = (dumpedObject: string): string =>
  // We remove the first line that has the opening bracket and the two last lines, the second
  // to last has the closing bracket, and the last line is always an empty line
  dumpedObject.split('\n').slice(1, -2).join('\n').concat('\n')

export const updateNaclFileData = async (
  currentData: string,
  changes: DetailedChangeWithSource[],
  functions: parser.Functions,
): Promise<string> => {
  type BufferChange = {
    newData: string
    start: number
    end: number
    indexInParent?: number
    action?: ActionName
  }

  const toBufferChange = async (change: DetailedChangeWithSource): Promise<BufferChange> => {
    const elem = change.action === 'remove' ? undefined : change.data.after
    let newData: string
    let indentationLevel = (change.location.start.col - 1) / 2
    if (change.requiresIndent) {
      indentationLevel += 1
    }
    if (elem !== undefined) {
      const changeKey = change.id.name
      const isListElement = changeKey.match(/^\d+$/) !== null
      if (change.id.isAnnotationTypeID()) {
        if (isType(elem) || isTypeReference(elem)) {
          newData = parser.dumpSingleAnnotationType(changeKey, new TypeReference(elem.elemID), indentationLevel)
        } else {
          newData = parser.dumpAnnotationTypes(elem, indentationLevel)
        }
      } else if (isElement(elem)) {
        newData = await parser.dumpElements([elem], functions, indentationLevel)
      } else if (isListElement) {
        newData = await parser.dumpValues(elem, functions, indentationLevel)
      } else {
        // We create a "dummy object" as the scope in which we are going to write this value
        // We do this because we need to dump the key as well as the value and this is the easiest
        // way to ensure we remain consistent
        const dumpedObj = await parser.dumpValues({ [changeKey]: elem }, functions, indentationLevel - 1)
        // once we have the "new scope", we want to take just the serialized values because the
        // brackets already exist in the original scope.
        newData = removeBracketLines(dumpedObj)
      }
      newData = fixEdgeIndentation(newData, change.action, change.location.start.col - 1)
    } else {
      // This is a removal, we want to replace the original content with an empty string
      newData = ''
    }
    return {
      newData,
      start: change.location.start.byte,
      end: change.location.end.byte,
      indexInParent: change.location.indexInParent,
      action: change.action,
    }
  }

  const bufferChanges = await awu(changes).map(toBufferChange).toArray()

  const sortedChanges = _.sortBy(bufferChanges, ['start', 'indexInParent'])
  const allBufferParts = sortedChanges
    // Add empty change at the end of the file to make sure we keep the current content
    // that appears after the last change
    .concat([{ start: Infinity, end: Infinity, newData: '' }])
    .reduce(
      (parts, change) => {
        const lastPartEnd = parts.slice(-1)[0].end
        const nextChangeStart = change.start
        if (lastPartEnd !== nextChangeStart) {
          // Add slice from the current data to fill the gap between the last part and the next
          let data = currentData.slice(lastPartEnd, nextChangeStart)

          if (change.action === 'remove') {
            // For removals, dropping newline and indent at the end of the block to avoid empty lines
            data = data.trimEnd()
          }

          parts.push({
            start: lastPartEnd,
            end: nextChangeStart,
            newData: data,
          })
        }
        parts.push(change)
        return parts
      },
      // Add empty change at the beginning of the file to make sure we keep the current content
      // that appears before the first change
      [{ start: 0, end: 0, newData: '' }],
    )

  // Some changes can end in extra newlines at the beginning and end of the file, so just dropping them
  return allBufferParts
    .map(part => part.newData)
    .join('')
    .trim()
    .concat('\n')
}

const createObjectTypeFromNestedAdditions = (additions: DetailedAddition[]): ObjectType =>
  new ObjectType(
    additions.reduce(
      (prev, addition) => {
        switch (addition.id.idType) {
          case 'field':
            return {
              ...prev,
              fields: {
                ...prev.fields,
                [addition.id.name]: addition.data.after,
              },
            }
          case 'attr':
            return {
              ...prev,
              annotations: {
                ...prev.annotations,
                [addition.id.name]: addition.data.after,
              },
            }
          case 'annotation': {
            return {
              ...prev,
              annotationRefsOrTypes: {
                ...prev.annotationRefsOrTypes,
                [addition.id.name]: addition.data.after,
              },
            }
          }
          default:
            return prev
        }
      },
      {
        elemID: additions[0].id.createTopLevelParentID().parent,
        fields: {},
        annotationRefsOrTypes: {},
        annotations: {},
        path: additions[0].path,
      },
    ),
  )

const wrapAdditions = (additions: DetailedAddition[]): DetailedChangeWithBaseChange[] => {
  const wrapperObject = createObjectTypeFromNestedAdditions(additions)
  return getDetailedChanges(toChange({ after: wrapperObject })).map(change => ({
    ...change,
    path: wrapperObject.path,
  }))
}

const parentElementExistsInPath = (dc: DetailedChangeWithBaseChange, sourceMap: parser.SourceMap): boolean => {
  const { parent } = dc.id.createTopLevelParentID()
  return _.some(sourceMap.get(parent.getFullName())?.map(range => range.filename === createFileNameFromPath(dc.path)))
}

export const getChangesToUpdate = (
  changes: DetailedChangeWithBaseChange[],
  sourceMap: parser.SourceMap,
): DetailedChangeWithBaseChange[] => {
  const isNestedAddition = (change: DetailedChangeWithBaseChange): change is DetailedAddition =>
    change.path !== undefined &&
    change.action === 'add' &&
    change.id.idType !== 'instance' &&
    change.id.nestingLevel === (change.id.isAnnotationTypeID() ? 2 : 1) &&
    !parentElementExistsInPath(change, sourceMap)

  const [nestedAdditionsWithPath, otherChanges] = _.partition(changes, isNestedAddition)
  const additionsByTypeAndPath = _.groupBy(nestedAdditionsWithPath, addition => [
    addition.path,
    addition.id.createTopLevelParentID().parent,
  ])
  const wrappedNestedAdditions = Object.values(additionsByTypeAndPath).flatMap(wrapAdditions)
  return groupAnnotationTypeChanges(wrappedNestedAdditions.concat(otherChanges), sourceMap)
}

export const getNestedStaticFiles = (value: Value): StaticFile[] => {
  if (isElement(value)) {
    const allStaticFiles = new Set<StaticFile>()
    const func: WalkOnFunc = ({ value: val }) => {
      if (isStaticFile(val)) {
        allStaticFiles.add(val)
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    }
    walkOnElement({ element: value, func })
    return Array.from(allStaticFiles.values())
  }
  if (_.isArray(value)) {
    return value.flatMap(getNestedStaticFiles)
  }
  if (_.isPlainObject(value)) {
    return Object.values(value).flatMap(getNestedStaticFiles)
  }
  if (isStaticFile(value)) {
    return [value]
  }
  return []
}

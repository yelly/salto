/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  isTemplateExpression,
  TemplateExpression,
} from '@salto-io/adapter-api'
import { ERROR_MESSAGES, setPath, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { AUTOMATION_TYPE, ESCALATION_SERVICE_TYPE, QUEUE_TYPE, WORKFLOW_TYPE_NAME } from '../../constants'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME } from '../fields/constants'
import {
  generateTemplateExpression,
  generateJqlContext,
  removeCustomFieldPrefix,
} from './template_expression_generator'

const { awu } = collections.asynciterable

const log = logger(module)

const JQL_FIELDS = [
  { type: 'Filter', path: ['jql'] },
  { type: 'Board', path: ['subQuery'] },
  { type: 'Webhook', path: ['filters', 'issue_related_events_section'] },
  { type: ESCALATION_SERVICE_TYPE, path: ['jql'] },
  { type: QUEUE_TYPE, path: ['jql'] },
]

type JqlDetails = {
  jql: string | TemplateExpression
  path: ElemID
}

type StringJqlDetails = JqlDetails & { jql: string }
type TemplateJqlDetails = JqlDetails & { jql: TemplateExpression }
// maps between the automation component type (which is determined by 'type' field)
// and the corresponding jql relative paths
const AUTOMATION_JQL_RELATIVE_PATHS_BY_TYPE: Record<string, string[][]> = {
  'jira.jql.condition': [['rawValue']],
  'jira.issue.assign': [['value', 'jql']],
  'jira.issue.related': [['value', 'jql']],
  'jira.issues.related.condition': [
    ['value', 'compareJql'],
    ['value', 'relatedJql'],
    ['value', 'jql'],
  ],
  'jira.jql.scheduled': [['value', 'jql']],
  JQL: [['query', 'value']],
}

const SCRIPT_RUNNER_JQL_RELATIVE_PATHS_BY_TYPE: Record<string, string[][]> = {
  'com.onresolve.jira.groovy.GroovyCondition': [['configuration', 'FIELD_JQL_QUERY']],
}

const instanceTypeToString: Record<string, string[][]> = {
  SLA: [['jqlQuery']],
  [FIELD_CONTEXT_TYPE_NAME]: [['objectFilterQuery'], ['issueScopeFilterQuery']],
}

const instanceTypeToMap: Map<string, Record<string, string[][]>> = new Map([
  [AUTOMATION_TYPE, AUTOMATION_JQL_RELATIVE_PATHS_BY_TYPE],
  [WORKFLOW_TYPE_NAME, SCRIPT_RUNNER_JQL_RELATIVE_PATHS_BY_TYPE],
])

const getRelativePathJqls = (instance: InstanceElement, pathMap: Record<string, string[][]>): JqlDetails[] => {
  const jqlPaths: JqlDetails[] = []
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      const jqlRelativePaths = pathMap[value?.type]
      if (jqlRelativePaths !== undefined) {
        jqlRelativePaths.forEach(relativePath => {
          const jqlValue = _.get(value, relativePath)
          if (_.isString(jqlValue) || isTemplateExpression(jqlValue)) {
            jqlPaths.push({
              path: path.createNestedID(...relativePath),
              jql: jqlValue,
            })
          }
        })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return jqlPaths
}

const getRelativePathJqlsJsm = (instance: InstanceElement, pathMap: Record<string, string[][]>): JqlDetails[] => {
  const jqlPaths: JqlDetails[] = []
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      const jqlRelativePaths = pathMap[instance.elemID.typeName]
      if (jqlRelativePaths !== undefined) {
        jqlRelativePaths.forEach(jqlRelativePath => {
          const jqlValue = _.get(value, jqlRelativePath)
          if (_.isString(jqlValue) || isTemplateExpression(jqlValue)) {
            jqlPaths.push({
              path: path.createNestedID(...jqlRelativePath),
              jql: jqlValue,
            })
          }
        })
      }

      return WALK_NEXT_STEP.RECURSE
    },
  })
  return jqlPaths
}

const getJqls = (instance: InstanceElement): JqlDetails[] => {
  if (instanceTypeToMap.has(instance.elemID.typeName)) {
    return getRelativePathJqls(instance, instanceTypeToMap.get(instance.elemID.typeName) as Record<string, string[][]>)
  }
  if (Object.keys(instanceTypeToString).includes(instance.elemID.typeName)) {
    return getRelativePathJqlsJsm(instance, instanceTypeToString)
  }
  return JQL_FIELDS.filter(({ type }) => type === instance.elemID.typeName)
    .map(({ path }) => ({
      path: instance.elemID.createNestedID(...path),
      jql: _.get(instance.value, path),
    }))
    .filter(({ jql }) => jql !== undefined)
}

const filter: FilterCreator = ({ config, elementsSource }) => {
  const jqlToTemplateExpression: Record<string, TemplateExpression> = {}

  return {
    name: 'jqlReferencesFilter',
    onFetch: async elements => {
      if (config.fetch.parseTemplateExpressions === false) {
        log.debug('Parsing JQL template expression was disabled')
        return {}
      }

      const instances = elements.filter(isInstanceElement)

      const jqls = instances.flatMap(getJqls).filter((jql): jql is StringJqlDetails => _.isString(jql.jql))

      const jqlContext = generateJqlContext(instances)

      log.debug(`About to parse ${jqls.length} unique JQLs`)

      const jqlToTemplate = Object.fromEntries(
        jqls.map(jql => [jql.jql, generateTemplateExpression(jql.jql, jqlContext)]),
      )

      const idToInstance = _.keyBy(instances, instance => instance.elemID.getFullName())

      const ambiguityWarnings = jqls
        .map(({ jql, path }) => {
          const instance = idToInstance[path.createTopLevelParentID().parent.getFullName()]
          const { template, ambiguousTokens } = jqlToTemplate[jql]

          if (template !== undefined) {
            setPath(instance, path, template)
          }

          if (ambiguousTokens.size !== 0) {
            return {
              message: ERROR_MESSAGES.OTHER_ISSUES,
              detailedMessage: `JQL in ${path.getFullName()} has tokens that cannot be translated to a Salto reference because there is more than one instance with the token name and there is no way to tell which one is applied. The ambiguous tokens: ${Array.from(ambiguousTokens).join(', ')}.`,
              severity: 'Warning' as const,
            }
          }

          return undefined
        })
        .filter(values.isDefined)

      return {
        errors: ambiguityWarnings,
      }
    },

    preDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .map(getChangeData)
        .forEach(async instance => {
          await awu(getJqls(instance))
            .filter((jql): jql is TemplateJqlDetails => isTemplateExpression(jql.jql))
            .forEach(async jql => {
              const resolvedJql = (
                await Promise.all(
                  jql.jql.parts.map(async part => {
                    if (!isReferenceExpression(part)) {
                      return part
                    }
                    const refValue = part.value !== undefined ? part.value : await part.getResolvedValue(elementsSource)
                    if (part.elemID.isTopLevel()) {
                      return removeCustomFieldPrefix(refValue.value.id)
                    }

                    return refValue
                  }),
                )
              ).join('')

              jqlToTemplateExpression[jql.path.getFullName()] = jql.jql

              setPath(instance, jql.path, resolvedJql)
            })
        })
    },

    onDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .map(getChangeData)
        .forEach(async instance => {
          getJqls(instance)
            .filter((jql): jql is JqlDetails & { jql: string } => _.isString(jql.jql))
            .filter(jql => jqlToTemplateExpression[jql.path.getFullName()] !== undefined)
            .forEach(jql => {
              setPath(instance, jql.path, jqlToTemplateExpression[jql.path.getFullName()])
            })
        })
    },
  }
}

export default filter

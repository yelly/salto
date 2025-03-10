/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { configType } from '../src/types'
import {
  DEPRECATED_OPTIONS_MESSAGE,
  PACKAGES_INSTANCES_REGEX,
  updateDeprecatedConfiguration,
} from '../src/deprecated_config'

describe('deprecated config', () => {
  const includedObjectName = '.*Object.*'
  const refToObjectName = '.*refTo.*'
  const currentConfig: Values = {
    fetch: {
      metadata: {
        exclude: [{ metadataType: 'Type1' }],
      },
      data: {
        includeObjects: [includedObjectName],
        excludeObjects: [],
        allowReferenceTo: [refToObjectName],
        saltoIDSettings: {
          defaultIdFields: ['Name'],
        },
      },
      fetchAllCustomSettings: true,
    },
  }
  describe('convert from old options to new options', () => {
    it('dataManagement should be converted to fetch.data', () => {
      const configWithOldOptions = {
        fetch: {
          metadata: {
            exclude: [{ metadataType: 'Type1' }],
          },
        },
        dataManagement: {
          includeObjects: ['aaa', '^eee', 'hhh\\.*'],
          excludeObjects: ['bbb.*', 'fff$'],
          allowReferenceTo: ['.*ccc', '^ggg$'],
          saltoIDSettings: {
            defaultIdFields: ['Name'],
            overrides: [
              {
                objectsRegex: '.*ddd.*',
                idFields: [],
              },
            ],
          },
        },
      }

      const updatedConfig = {
        fetch: {
          metadata: {
            exclude: [{ metadataType: 'Type1' }],
          },
          data: {
            includeObjects: ['.*aaa.*', 'eee.*', '.*hhh\\.*.*'],
            excludeObjects: ['.*bbb.*', '.*fff'],
            allowReferenceTo: ['.*ccc.*', 'ggg'],
            saltoIDSettings: {
              defaultIdFields: ['Name'],
              overrides: [
                {
                  objectsRegex: '.*ddd.*',
                  idFields: [],
                },
              ],
            },
          },
        },
      }

      const config = updateDeprecatedConfiguration(
        new InstanceElement(ElemID.CONFIG_NAME, configType, configWithOldOptions),
      )
      expect(config?.config.value).toEqual(updatedConfig)
      expect(config?.message).toBe(DEPRECATED_OPTIONS_MESSAGE)
    })

    it('dataManagement without all the properties should be converted to fetch.data', () => {
      const configWithOldOptions = {
        fetch: {
          metadata: {
            exclude: [{ metadataType: 'Type1' }],
          },
        },
        dataManagement: {
          includeObjects: ['aaa', '^eee', 'hhh\\.*'],
          saltoIDSettings: {
            defaultIdFields: ['Name'],
          },
        },
      }

      const updatedConfig = {
        fetch: {
          metadata: {
            exclude: [{ metadataType: 'Type1' }],
          },
          data: {
            includeObjects: ['.*aaa.*', 'eee.*', '.*hhh\\.*.*'],
            saltoIDSettings: {
              defaultIdFields: ['Name'],
            },
          },
        },
      }

      const config = updateDeprecatedConfiguration(
        new InstanceElement(ElemID.CONFIG_NAME, configType, configWithOldOptions),
      )
      // _.isEqual is used instead of '.toEqual' because '.toEqual'
      // will return true of objects like {a: undefined} and {}
      expect(_.isEqual(config?.config.value, updatedConfig)).toBeTruthy()
      expect(config?.message).toBe(DEPRECATED_OPTIONS_MESSAGE)
    })

    it('metadataTypesSkippedList should be converted to fetch.metadata.exclude', () => {
      const configWithOldOptions = _.cloneDeep(currentConfig)
      configWithOldOptions.metadataTypesSkippedList = ['a', 'b']

      const expectedConfig = _.cloneDeep(currentConfig)
      expectedConfig.fetch?.metadata?.exclude?.push(...[{ metadataType: 'a' }, { metadataType: 'b' }])

      const config = updateDeprecatedConfiguration(
        new InstanceElement(ElemID.CONFIG_NAME, configType, configWithOldOptions),
      )
      expect(config?.config.value).toEqual(expectedConfig)
      expect(config?.message).toBe(DEPRECATED_OPTIONS_MESSAGE)
    })

    it('instancesRegexSkippedList should be converted correctly', () => {
      const configWithOldOptions = _.cloneDeep(currentConfig)
      configWithOldOptions.instancesRegexSkippedList = ['a', 'a.b', 'a.b.c', PACKAGES_INSTANCES_REGEX]

      const expectedConfig = _.cloneDeep(currentConfig)
      expectedConfig.fetch?.metadata?.exclude?.push(
        ...[{ name: '.*a.*' }, { metadataType: '.*a', name: 'b.*' }, { metadataType: '.*a', name: 'b.c.*' }],
      )

      _.assign(expectedConfig.fetch?.metadata, {
        include: [{ name: '.*', metadataType: '.*', namespace: '' }],
      })

      const config = updateDeprecatedConfiguration(
        new InstanceElement(ElemID.CONFIG_NAME, configType, configWithOldOptions),
      )
      expect(config?.config.value).toEqual(expectedConfig)
      expect(config?.message).toBe(DEPRECATED_OPTIONS_MESSAGE)
    })
  })
})

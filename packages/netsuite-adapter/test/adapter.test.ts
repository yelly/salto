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
  StaticFile,
  ChangeDataType,
  DeployResult,
  getChangeData,
  FetchOptions,
  ObjectType,
  Change,
  isObjectType,
  toChange,
  BuiltinTypes,
  SaltoError,
  SaltoElementError,
  ProgressReporter,
  isInstanceElement,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { collections } from '@salto-io/lowerdash'
import createClient from './client/sdf_client'
import NetsuiteAdapter from '../src/adapter'
import { getMetadataTypes, isCustomRecordType, metadataTypesToList, SUITEAPP_CONFIG_RECORD_TYPES } from '../src/types'
import {
  ENTITY_CUSTOM_FIELD,
  SCRIPT_ID,
  SAVED_SEARCH,
  FILE,
  FOLDER,
  PATH,
  TRANSACTION_FORM,
  CONFIG_FEATURES,
  INTEGRATION,
  NETSUITE,
  REPORT_DEFINITION,
  FINANCIAL_LAYOUT,
  ROLE,
  METADATA_TYPE,
  CUSTOM_RECORD_TYPE,
  CUSTOM_RECORDS_PATH,
  IS_LOCKED,
} from '../src/constants'
import { createInstanceElement, toCustomizationInfo } from '../src/transformer'
import { LocalFilterCreator } from '../src/filter'
import resolveValuesFilter from '../src/filters/element_references'
import { configType, NetsuiteConfig } from '../src/config/types'
import { getConfigFromConfigChanges } from '../src/config/suggestions'
import { mockGetElemIdFunc } from './utils'
import NetsuiteClient from '../src/client/client'
import {
  CustomizationInfo,
  CustomTypeInfo,
  FileCustomizationInfo,
  FolderCustomizationInfo,
  ImportFileCabinetResult,
  SDFObjectNode,
} from '../src/client/types'
import * as changesDetector from '../src/changes_detector/changes_detector'
import * as deletionCalculator from '../src/deletion_calculator'
import SdfClient from '../src/client/sdf_client'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import { SERVER_TIME_TYPE_NAME } from '../src/server_time'
import { SDF_CREATE_OR_UPDATE_GROUP_ID } from '../src/group_changes'
import getChangeValidator from '../src/change_validator'
import { getStandardTypesNames } from '../src/autogen/types'
import { createCustomRecordTypes } from '../src/custom_records/custom_record_type'
import { Graph, GraphNode } from '../src/client/graph_utils'
import { getDataElements } from '../src/data_elements/data_elements'
import * as elementsSourceIndexModule from '../src/elements_source_index/elements_source_index'
import { fullQueryParams, fullFetchConfig } from '../src/config/config_creator'
import { FetchByQueryFunc } from '../src/config/query'
import {
  createObjectIdListElements,
  OBJECT_ID_LIST_TYPE_NAME,
  OBJECT_ID_LIST_FIELD_NAME,
  getOrCreateObjectIdListElements,
} from '../src/scriptid_list'
import { getTypesToInternalId } from '../src/data_elements/types'
import { getSuiteQLTableElements } from '../src/data_elements/suiteql_table_elements'

const DEFAULT_SDF_DEPLOY_PARAMS = {
  manifestDependencies: {
    optionalFeatures: [],
    requiredFeatures: [],
    excludedFeatures: [],
    includedObjects: [],
    excludedObjects: [],
    includedFiles: [],
    excludedFiles: [],
  },
  validateOnly: false,
}

jest.mock('../src/config/suggestions', () => ({
  ...jest.requireActual<{}>('../src/config/suggestions'),
  getConfigFromConfigChanges: jest.fn(),
}))

jest.mock('../src/data_elements/data_elements', () => ({
  ...jest.requireActual<{}>('../src/data_elements/data_elements'),
  getDataElements: jest.fn(() => ({ elements: [], largeTypesError: [] })),
}))

const suiteAppImportFileCabinetMock = jest.fn()
jest.mock('../src/client/suiteapp_client/suiteapp_file_cabinet', () => ({
  ...jest.requireActual<{}>('../src/client/suiteapp_client/suiteapp_file_cabinet'),
  importFileCabinet: jest.fn((...args) => suiteAppImportFileCabinetMock(...args)),
}))

jest.mock('../src/change_validator')
const getChangeValidatorMock = getChangeValidator as jest.Mock

getChangeValidatorMock.mockImplementation(
  // eslint-disable-next-line no-empty-pattern
  ({}: {
    withSuiteApp: boolean
    warnStaleData: boolean
    fetchByQuery: FetchByQueryFunc
    deployReferencedElements?: boolean
  }) =>
    (_changes: ReadonlyArray<Change>) =>
      Promise.resolve([]),
)

jest.mock('../src/changes_detector/changes_detector')

const onFetchMock = jest.fn().mockImplementation(async _arg => undefined)
const firstDummyFilter: LocalFilterCreator = () => ({
  name: 'firstDummyFilter',
  onFetch: () => onFetchMock(1),
})

const secondDummyFilter: LocalFilterCreator = () => ({
  name: 'secondDummyFilter',
  onFetch: () => onFetchMock(2),
})

const nullProgressReporter: ProgressReporter = {
  reportProgress: () => {},
}

describe('Adapter', () => {
  const client = createClient()
  const config = {
    fetch: {
      include: fullQueryParams(),
      exclude: {
        types: [
          { name: 'account', ids: ['aaa'] },
          { name: 'subsidiary', ids: ['.*'] },
          { name: SAVED_SEARCH },
          { name: TRANSACTION_FORM },
        ],
        fileCabinet: ['^Some/File/Regex$', '.*\\.(csv|pdf|png)'],
        customRecords: [],
      },
    },
    client: {
      fetchAllTypesAtOnce: true,
      fetchTypeTimeoutInMinutes: 1,
    },
    withPartialDeletion: true,
  }

  const netsuiteAdapter = new NetsuiteAdapter({
    client: new NetsuiteClient(client),
    elementsSource: buildElementsSourceFromElements([]),
    filtersCreators: [firstDummyFilter, secondDummyFilter, resolveValuesFilter],
    config,
    originalConfig: config,
    getElemIdFunc: mockGetElemIdFunc,
  })

  const mockFetchOpts: MockInterface<FetchOptions> = {
    progressReporter: { reportProgress: jest.fn() },
  }

  const { standardTypes, additionalTypes, innerAdditionalTypes } = getMetadataTypes()
  const metadataTypes = metadataTypesToList({ standardTypes, additionalTypes, innerAdditionalTypes }).concat(
    createCustomRecordTypes([], standardTypes.customrecordtype.type),
  )

  const getSystemInformationMock = jest.fn().mockResolvedValue({
    time: new Date(1000),
    appVersion: [0, 1, 0],
  })

  const getConfigRecordsMock = jest.fn()
  const getCustomRecordsMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
      elements: [],
      instancesIds: [],
      failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
      failedToFetchAllAtOnce: false,
    })
    client.importFileCabinetContent = mockFunction<SdfClient['importFileCabinetContent']>().mockResolvedValue({
      elements: [],
      failedPaths: { lockedError: [], otherError: [], largeSizeFoldersError: [], largeFilesCountFoldersError: [] },
      largeFilesCountFolderWarnings: [],
    })

    const suiteAppImportFileCabinetResult: ImportFileCabinetResult = {
      elements: [],
      failedPaths: { lockedError: [], otherError: [], largeFilesCountFoldersError: [], largeSizeFoldersError: [] },
      largeFilesCountFolderWarnings: [],
    }
    suiteAppImportFileCabinetMock.mockResolvedValue(suiteAppImportFileCabinetResult)
  })

  describe('fetch', () => {
    describe.each([false, true])('when fetch.fetchPluginImplementations is %s', fetchPluginImplementations => {
      it(`should fetch all types and instances that are not in fetch.exclude ${fetchPluginImplementations ? 'including' : 'excluding'} pluginimplementation`, async () => {
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
            fetch: {
              ...config.fetch,
              lockedElementsToExclude: {
                types: [
                  {
                    name: 'customrecordtype',
                    ids: ['customrecord_locked2', 'customrecord_locked3'],
                  },
                ],
                fileCabinet: [],
              },
              fetchPluginImplementations,
            },
          },
          originalConfig: config,
          getElemIdFunc: mockGetElemIdFunc,
        })

        const folderCustomizationInfo: FolderCustomizationInfo = {
          typeName: FOLDER,
          values: {},
          path: ['a', 'b'],
        }

        const fileCustomizationInfo: FileCustomizationInfo = {
          typeName: FILE,
          values: {},
          path: ['a', 'b'],
          fileContent: Buffer.from('Dummy content'),
        }

        const featuresCustomTypeInfo: CustomTypeInfo = {
          typeName: CONFIG_FEATURES,
          scriptId: CONFIG_FEATURES,
          values: {
            feature: [{ id: 'feature', label: 'Feature', status: 'ENABLED' }],
          },
        }

        const customTypeInfo = {
          typeName: 'entitycustomfield',
          values: {
            '@_scriptid': 'custentity_my_script_id',
            label: 'elementName',
          },
          scriptId: 'custentity_my_script_id',
        }

        client.importFileCabinetContent = mockFunction<SdfClient['importFileCabinetContent']>().mockResolvedValue({
          elements: [folderCustomizationInfo, fileCustomizationInfo],
          failedPaths: { lockedError: [], otherError: [], largeSizeFoldersError: [], largeFilesCountFoldersError: [] },
          largeFilesCountFolderWarnings: [],
        })
        client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
          elements: [customTypeInfo, featuresCustomTypeInfo],
          instancesIds: [],
          failedToFetchAllAtOnce: false,
          failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
        })
        const { elements, partialFetchData } = await adapter.fetch(mockFetchOpts)
        expect(partialFetchData?.isPartial).toBeFalsy()
        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1].updatedFetchQuery
        const typesToSkip = [SAVED_SEARCH, TRANSACTION_FORM, INTEGRATION, REPORT_DEFINITION, FINANCIAL_LAYOUT].concat(
          !fetchPluginImplementations ? 'pluginimplementation' : [],
        )
        expect(_.pull(getStandardTypesNames(), ...typesToSkip).every(customObjectsQuery.isTypeMatch)).toBeTruthy()
        expect(typesToSkip.every(customObjectsQuery.isTypeMatch)).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('subsidiary')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('account')).toBeTruthy()

        const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
        expect(fileCabinetQuery.isFileMatch('Some/File/Regex')).toBeFalsy()
        expect(fileCabinetQuery.isFileMatch('Some/anotherFile/Regex')).toBeTruthy()

        const scriptIdListElements = await getOrCreateObjectIdListElements(
          [],
          buildElementsSourceFromElements([]),
          false,
        )
        const suiteQLTableElements = await getSuiteQLTableElements(config, buildElementsSourceFromElements([]), false)

        expect(elements.map(elem => elem.elemID.getFullName()).sort()).toEqual(
          [...metadataTypes, ...scriptIdListElements, ...suiteQLTableElements.elements]
            .map(elem => elem.elemID.getFullName())
            .concat([
              'netsuite.companyFeatures.instance',
              'netsuite.entitycustomfield.instance.custentity_my_script_id',
              'netsuite.file.instance.a_b@d',
              'netsuite.folder.instance.a_b@d',
            ])
            .sort(),
        )

        const customFieldType = elements.find(element =>
          element.elemID.isEqual(new ElemID(NETSUITE, ENTITY_CUSTOM_FIELD)),
        )
        expect(isObjectType(customFieldType)).toBeTruthy()
        expect(elements).toContainEqual(
          await createInstanceElement(customTypeInfo, customFieldType as ObjectType, mockGetElemIdFunc),
        )

        const file = elements.find(element => element.elemID.isEqual(new ElemID(NETSUITE, FILE)))
        expect(isObjectType(file)).toBeTruthy()
        expect(elements).toContainEqual(
          await createInstanceElement(fileCustomizationInfo, file as ObjectType, mockGetElemIdFunc),
        )

        const folder = elements.find(element => element.elemID.isEqual(new ElemID(NETSUITE, FOLDER)))
        expect(isObjectType(folder)).toBeTruthy()
        expect(elements).toContainEqual(
          await createInstanceElement(folderCustomizationInfo, folder as ObjectType, mockGetElemIdFunc),
        )

        const featuresType = elements.find(element => element.elemID.isEqual(new ElemID(NETSUITE, CONFIG_FEATURES)))
        expect(isObjectType(featuresType)).toBeTruthy()
        expect(elements).toContainEqual(
          await createInstanceElement(featuresCustomTypeInfo, featuresType as ObjectType, mockGetElemIdFunc),
        )

        expect(suiteAppImportFileCabinetMock).not.toHaveBeenCalled()
      })
    })

    describe('fetchConfig', () => {
      const createAdapter = (configInput: NetsuiteConfig): NetsuiteAdapter =>
        new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configInput,
          originalConfig: configInput,
          getElemIdFunc: mockGetElemIdFunc,
        })
      it('should fetch all types and instances without those in Types To Skip, skipList and exclude when fetch config, skipList and typeToSkip are defined', async () => {
        const configWithAllFormats = {
          ...config,
          skipList: {
            types: {
              typeToSkip: ['.*'],
            },
            filePaths: ['someFilePathToSkip'],
          },
          typesToSkip: ['skipThisType'],
        }
        const adapter = createAdapter(configWithAllFormats)
        const { partialFetchData } = await adapter.fetch(mockFetchOpts)
        expect(partialFetchData?.isPartial).toBeFalsy()
        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1].updatedFetchQuery
        expect(customObjectsQuery.isTypeMatch('any kind of type')).toBeTruthy()
        expect(customObjectsQuery.isTypeMatch('typeToSkip')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('skipThisType')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('subsidiary')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('account')).toBeTruthy()
        expect(customObjectsQuery.isTypeMatch(SAVED_SEARCH)).toBeFalsy()
        const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
        expect(fileCabinetQuery.isFileMatch('any/kind/of/path')).toBeTruthy()
        expect(fileCabinetQuery.isFileMatch('someFilePathToSkip')).toBeFalsy()
        expect(fileCabinetQuery.isFileMatch('Some/File/Regex')).toBeFalsy()
      })
    })

    describe('fetchWithChangesDetection', () => {
      const withChangesDetection = true
      const conf = {
        fetch: {
          include: fullQueryParams(),
          exclude: {
            types: [{ name: SAVED_SEARCH }, { name: TRANSACTION_FORM }],
            fileCabinet: ['Some/File/Regex'],
            customRecords: [],
          },
        },
      }
      const dummyElement = new ObjectType({ elemID: new ElemID('dum', 'test') })
      const adapter = new NetsuiteAdapter({
        client: new NetsuiteClient(client),
        elementsSource: buildElementsSourceFromElements([dummyElement]),
        filtersCreators: [firstDummyFilter, secondDummyFilter],
        config: conf,
        originalConfig: conf,
        getElemIdFunc: mockGetElemIdFunc,
      })

      it('isPartial should be true', async () => {
        const { partialFetchData } = await adapter.fetch({ ...mockFetchOpts, withChangesDetection })
        expect(partialFetchData?.isPartial).toBeTruthy()
      })
    })

    describe('fetchTarget', () => {
      const conf = {
        fetch: {
          include: fullQueryParams(),
          exclude: {
            types: [{ name: SAVED_SEARCH }, { name: TRANSACTION_FORM }],
            fileCabinet: ['Some/File/Regex'],
            customRecords: [],
          },
        },
        fetchTarget: {
          types: {
            [SAVED_SEARCH]: ['.*'],
            addressForm: ['.*'],
          },
          filePaths: ['Some/File/.*'],
        },
      }

      describe('define fetchTarget for the first fetch', () => {
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: conf,
          originalConfig: conf,
          getElemIdFunc: mockGetElemIdFunc,
        })

        it('should throw an error when defining fetchTarget for the first fetch', async () => {
          await expect(() => adapter.fetch(mockFetchOpts)).rejects.toThrow(
            "Can't define fetchTarget for the first fetch. Remove fetchTarget from adapter config file",
          )
        })
      })

      describe('define fetchTarget after a full fetch', () => {
        const dummyElement = new ObjectType({ elemID: new ElemID('dum', 'test') })
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([dummyElement]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: conf,
          originalConfig: conf,
          getElemIdFunc: mockGetElemIdFunc,
        })

        it('isPartial should be true', async () => {
          const { partialFetchData } = await adapter.fetch(mockFetchOpts)
          expect(partialFetchData?.isPartial).toBeTruthy()
        })

        it('should match the types that match fetchTarget and exclude', async () => {
          await adapter.fetch(mockFetchOpts)

          const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1].updatedFetchQuery
          expect(customObjectsQuery.isTypeMatch('addressForm')).toBeTruthy()
          expect(
            _.pull(getStandardTypesNames(), 'addressForm', SAVED_SEARCH, TRANSACTION_FORM).some(
              customObjectsQuery.isTypeMatch,
            ),
          ).toBeFalsy()
          expect(customObjectsQuery.isTypeMatch(INTEGRATION)).toBeFalsy()
        })

        it('should match the files that match fetchTarget and not in filePathRegexSkipList', async () => {
          await adapter.fetch(mockFetchOpts)

          const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
          expect(fileCabinetQuery.isFileMatch('Some/File/Regex')).toBeFalsy()
          expect(fileCabinetQuery.isFileMatch('Some/AnotherFile/another')).toBeFalsy()
          expect(fileCabinetQuery.isFileMatch('Some/File/another')).toBeTruthy()
        })
      })
    })

    it('should filter large file cabinet folders', async () => {
      client.importFileCabinetContent = mockFunction<SdfClient['importFileCabinetContent']>().mockResolvedValue({
        elements: [],
        failedPaths: {
          lockedError: [],
          otherError: [],
          largeSizeFoldersError: ['largeFolder'],
          largeFilesCountFoldersError: [],
        },
        largeFilesCountFolderWarnings: [],
      })

      await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: {
            lockedError: [],
            otherError: [],
            largeSizeFoldersError: ['largeFolder'],
            largeFilesCountFoldersError: [],
          },
          failedTypes: expect.anything(),
          failedCustomRecords: expect.anything(),
        },
        config,
      )
    })

    it('should filter types with too many instances from SDF', async () => {
      client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
        elements: [],
        instancesIds: [],
        failedToFetchAllAtOnce: false,
        failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: ['excludedTypeTest'] },
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      getConfigFromConfigChangesMock.mockReturnValue(undefined)
      await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: {
            lockedError: [],
            otherError: [],
            largeSizeFoldersError: [],
            largeFilesCountFoldersError: [],
          },
          failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: ['excludedTypeTest'] },
          failedCustomRecords: [],
        },
        config,
      )
    })

    it('should fail when getCustomObjects fails', async () => {
      client.getCustomObjects = jest.fn().mockImplementation(async () => {
        throw new Error('Dummy error')
      })
      await expect(netsuiteAdapter.fetch(mockFetchOpts)).rejects.toThrow()
    })

    it('should fail when importFileCabinetContent fails', async () => {
      client.importFileCabinetContent = jest.fn().mockImplementation(async () => {
        throw new Error('Dummy error')
      })
      await expect(netsuiteAdapter.fetch(mockFetchOpts)).rejects.toThrow()
    })

    it('should ignore instances of unknown type', async () => {
      const customTypeInfo = {
        typeName: 'unknowntype',
        values: {
          label: 'elementName',
        },
        scriptId: 'unknown',
      }
      client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
        elements: [customTypeInfo],
        instancesIds: [],
        failedToFetchAllAtOnce: false,
        failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
      })
      const { elements } = await netsuiteAdapter.fetch(mockFetchOpts)
      const scriptIdListElements = await getOrCreateObjectIdListElements([], buildElementsSourceFromElements([]), false)
      const suiteQLTableElements = await getSuiteQLTableElements(config, buildElementsSourceFromElements([]), false)

      expect(elements.map(elem => elem.elemID.getFullName()).sort()).toEqual(
        [...metadataTypes, ...scriptIdListElements, ...suiteQLTableElements.elements]
          .map(elem => elem.elemID.getFullName())
          .sort(),
      )
    })

    it('should call filters by their order', async () => {
      await netsuiteAdapter.fetch(mockFetchOpts)
      expect(onFetchMock).toHaveBeenNthCalledWith(1, 1)
      expect(onFetchMock).toHaveBeenNthCalledWith(2, 2)
    })

    it('should call getCustomObjects with query that matches types that match the types in fetch config', async () => {
      await netsuiteAdapter.fetch(mockFetchOpts)
      const query = (client.getCustomObjects as jest.Mock).mock.calls[0][1].updatedFetchQuery
      expect(query.isTypeMatch(ENTITY_CUSTOM_FIELD)).toBeTruthy()
      expect(query.isTypeMatch(SAVED_SEARCH)).toBeFalsy()
    })

    it('should return only the elements when having no config changes', async () => {
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      getConfigFromConfigChangesMock.mockReturnValue(undefined)
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: {
            lockedError: [],
            otherError: [],
            largeSizeFoldersError: [],
            largeFilesCountFoldersError: [],
          },
          failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
          failedCustomRecords: [],
        },
        config,
      )
      expect(fetchResult.updatedConfig).toBeUndefined()
    })

    it('should call getConfigFromConfigChanges with failed file paths', async () => {
      client.importFileCabinetContent = mockFunction<SdfClient['importFileCabinetContent']>().mockResolvedValue({
        elements: [],
        failedPaths: {
          lockedError: [],
          otherError: ['/path/to/file'],
          largeSizeFoldersError: [],
          largeFilesCountFoldersError: [],
        },
        largeFilesCountFolderWarnings: [],
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue({ config: [updatedConfig], message: '' })
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: {
            lockedError: [],
            otherError: ['/path/to/file'],
            largeSizeFoldersError: [],
            largeFilesCountFoldersError: [],
          },
          failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
          failedCustomRecords: [],
        },
        config,
      )
      expect(fetchResult.updatedConfig?.config[0].isEqual(updatedConfig)).toBe(true)
    })

    it('should call getConfigFromConfigChanges with failedTypeToInstances', async () => {
      const failedTypeToInstances = { testType: ['scriptid1', 'scriptid1'] }
      client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
        elements: [],
        instancesIds: [],
        failedToFetchAllAtOnce: false,
        failedTypes: { lockedError: {}, unexpectedError: failedTypeToInstances, excludedTypes: [] },
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue({ config: [updatedConfig], message: '' })
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: {
            lockedError: [],
            otherError: [],
            largeSizeFoldersError: [],
            largeFilesCountFoldersError: [],
          },
          failedTypes: { lockedError: {}, unexpectedError: failedTypeToInstances, excludedTypes: [] },
          failedCustomRecords: [],
        },
        config,
      )
      expect(fetchResult.updatedConfig?.config[0].isEqual(updatedConfig)).toBe(true)
    })

    it('should call getConfigFromConfigChanges with false for fetchAllAtOnce', async () => {
      client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
        elements: [],
        instancesIds: [],
        failedToFetchAllAtOnce: true,
        failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue({ config: [updatedConfig], message: '' })
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: true,
          failedFilePaths: {
            lockedError: [],
            otherError: [],
            largeSizeFoldersError: [],
            largeFilesCountFoldersError: [],
          },
          failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
          failedCustomRecords: [],
        },
        config,
      )
      expect(fetchResult.updatedConfig?.config[0].isEqual(updatedConfig)).toBe(true)
    })

    describe('scriptid list elements', () => {
      describe('full fetch', () => {
        it('should create scriptid list elements with an empty list', async () => {
          const { elements } = await netsuiteAdapter.fetch(mockFetchOpts)
          const scriptIdListElements = elements.filter(elem => elem.elemID.typeName === OBJECT_ID_LIST_TYPE_NAME)
          expect(scriptIdListElements).toHaveLength(2)
          expect(scriptIdListElements.filter(isInstanceElement).length).toEqual(1)
          expect(scriptIdListElements.filter(isObjectType).length).toEqual(1)
          const instance = scriptIdListElements.find(isInstanceElement) as InstanceElement
          expect(collections.array.makeArray(instance.value.scriptid_list)).toEqual([])
        })
        it('should create scriptid list elements with a non-empty list', async () => {
          client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
            elements: [],
            instancesIds: [
              {
                type: 'someType',
                instanceId: 'test',
              },
            ],
            failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
            failedToFetchAllAtOnce: false,
          })
          const { elements } = await netsuiteAdapter.fetch(mockFetchOpts)
          const scriptIdListElements = elements.filter(elem => elem.elemID.typeName === OBJECT_ID_LIST_TYPE_NAME)
          expect(scriptIdListElements).toHaveLength(2)
          expect(scriptIdListElements.filter(isInstanceElement).length).toEqual(1)
          expect(scriptIdListElements.filter(isObjectType).length).toEqual(1)
          const instance = scriptIdListElements.find(isInstanceElement) as InstanceElement
          expect(collections.array.makeArray(instance.value[OBJECT_ID_LIST_FIELD_NAME])).toEqual([
            {
              instanceId: 'test',
              type: 'someType',
            },
          ])
        })
        it('should update new scriptid list elements if they exist in the elementsSource', async () => {
          const scriptidListInstances = createObjectIdListElements([
            {
              type: 'someType',
              instanceId: 'before',
            },
          ])
          const adapter = new NetsuiteAdapter({
            client: new NetsuiteClient(client),
            elementsSource: buildElementsSourceFromElements(scriptidListInstances),
            filtersCreators: [],
            config,
            originalConfig: config,
            getElemIdFunc: mockGetElemIdFunc,
          })
          client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
            elements: [],
            instancesIds: [
              {
                type: 'someType',
                instanceId: 'after',
              },
            ],
            failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
            failedToFetchAllAtOnce: false,
          })
          const { elements } = await adapter.fetch(mockFetchOpts)
          const scriptIdListElements = elements.filter(elem => elem.elemID.typeName === OBJECT_ID_LIST_TYPE_NAME)
          expect(scriptIdListElements).toHaveLength(2)
          expect(scriptIdListElements.filter(isInstanceElement).length).toEqual(1)
          expect(scriptIdListElements.filter(isObjectType).length).toEqual(1)
          const instance = scriptIdListElements.find(isInstanceElement) as InstanceElement
          expect(collections.array.makeArray(instance.value[OBJECT_ID_LIST_FIELD_NAME])).toEqual([
            {
              type: 'someType',
              instanceId: 'after',
            },
          ])
        })
      })
      describe('partial fetch', () => {
        it('should create new scriptid list elements if they do not exist in the elementsSource', async () => {
          const withChangesDetection = true
          client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
            elements: [],
            instancesIds: [
              {
                type: 'someType',
                instanceId: 'test',
              },
            ],
            failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
            failedToFetchAllAtOnce: false,
          })
          const { elements } = await netsuiteAdapter.fetch({ ...mockFetchOpts, withChangesDetection })
          const scriptIdListElements = elements.filter(elem => elem.elemID.typeName === OBJECT_ID_LIST_TYPE_NAME)
          expect(scriptIdListElements).toHaveLength(2)
          expect(scriptIdListElements.filter(isInstanceElement).length).toEqual(1)
          expect(scriptIdListElements.filter(isObjectType).length).toEqual(1)
          const instance = scriptIdListElements.find(isInstanceElement) as InstanceElement
          expect(collections.array.makeArray(instance.value[OBJECT_ID_LIST_FIELD_NAME])).toEqual([
            {
              type: 'someType',
              instanceId: 'test',
            },
          ])
        })
        it('should not create new scriptid list elements if they exist in the elementsSource', async () => {
          const withChangesDetection = true
          const scriptidListInstances = createObjectIdListElements([
            {
              type: 'someType',
              instanceId: 'before',
            },
          ])
          const adapter = new NetsuiteAdapter({
            client: new NetsuiteClient(client),
            elementsSource: buildElementsSourceFromElements(scriptidListInstances),
            filtersCreators: [],
            config,
            originalConfig: config,
            getElemIdFunc: mockGetElemIdFunc,
          })
          client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
            elements: [],
            instancesIds: [
              {
                type: 'someType',
                instanceId: 'after',
              },
            ],
            failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
            failedToFetchAllAtOnce: false,
          })
          const { elements } = await adapter.fetch({ ...mockFetchOpts, withChangesDetection })
          const scriptIdListElements = elements.filter(elem => elem.elemID.typeName === OBJECT_ID_LIST_TYPE_NAME)
          expect(scriptIdListElements).toHaveLength(2)
          expect(scriptIdListElements.filter(isInstanceElement).length).toEqual(1)
          expect(scriptIdListElements.filter(isObjectType).length).toEqual(1)
          const instance = scriptIdListElements.find(isInstanceElement) as InstanceElement
          expect(collections.array.makeArray(instance.value[OBJECT_ID_LIST_FIELD_NAME])).toEqual([
            {
              type: 'someType',
              instanceId: 'before',
            },
          ])
        })
      })
    })

    describe.each([false, true])('visibleLockedCustomRecordTypes %s', visibleLockedCustomRecordTypes => {
      it('should create locked custom record type elements', async () => {
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
            fetch: {
              ...config.fetch,
              lockedElementsToExclude: {
                types: [
                  {
                    name: 'customrecordtype',
                    ids: ['customrecord_locked2', 'customrecord_locked3'],
                  },
                ],
                fileCabinet: [],
              },
              visibleLockedCustomRecordTypes,
            },
          },
          originalConfig: config,
          getElemIdFunc: mockGetElemIdFunc,
        })
        client.getCustomObjects = mockFunction<SdfClient['getCustomObjects']>().mockResolvedValue({
          elements: [],
          instancesIds: [
            { type: 'customrecordtype', instanceId: 'customrecord_locked1' },
            { type: 'customrecordtype', instanceId: 'customrecord_locked2' },
          ],
          failedToFetchAllAtOnce: true,
          failedTypes: {
            lockedError: { customrecordtype: ['customrecord_locked1'] },
            unexpectedError: {},
            excludedTypes: [],
          },
        })
        const fetchResult = await adapter.fetch(mockFetchOpts)
        const lockedCustomRecordTypes = fetchResult.elements
          .filter(isObjectType)
          .filter(isCustomRecordType)
          .filter(e =>
            visibleLockedCustomRecordTypes ? e.annotations[IS_LOCKED] : e.annotations[CORE_ANNOTATIONS.HIDDEN],
          )
        expect(lockedCustomRecordTypes).toHaveLength(2)
        const lockedCustomRecordType1 = lockedCustomRecordTypes.find(
          type => type.elemID.name === 'customrecord_locked1',
        ) as ObjectType
        expect(lockedCustomRecordType1.annotations).toEqual({
          scriptid: 'customrecord_locked1',
          source: 'soap',
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          ...(visibleLockedCustomRecordTypes ? { [IS_LOCKED]: true } : { [CORE_ANNOTATIONS.HIDDEN]: true }),
        })
        expect(lockedCustomRecordType1.path).toEqual([NETSUITE, CUSTOM_RECORDS_PATH, 'customrecord_locked1'])
        const lockedCustomRecordType2 = lockedCustomRecordTypes.find(
          type => type.elemID.name === 'customrecord_locked2',
        ) as ObjectType
        expect(lockedCustomRecordType2.annotations).toEqual({
          scriptid: 'customrecord_locked2',
          source: 'soap',
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          ...(visibleLockedCustomRecordTypes ? { [IS_LOCKED]: true } : { [CORE_ANNOTATIONS.HIDDEN]: true }),
        })
        expect(lockedCustomRecordType2.path).toEqual([NETSUITE, CUSTOM_RECORDS_PATH, 'customrecord_locked2'])
      })
    })
  })

  describe('deploy', () => {
    const origInstance = new InstanceElement('elementName', standardTypes[ENTITY_CUSTOM_FIELD].type, {
      label: 'elementName',
      [SCRIPT_ID]: 'custentity_my_script_id',
      description: new StaticFile({
        filepath: 'netsuite/elementName.suffix',
        content: Buffer.from('description value'),
      }),
    })
    let instance: InstanceElement

    const fileInstance = new InstanceElement('fileInstance', additionalTypes[FILE], {
      [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
    })

    const folderInstance = new InstanceElement('folderInstance', additionalTypes[FOLDER], {
      [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
    })
    let testGraph: Graph<SDFObjectNode>

    beforeEach(() => {
      instance = origInstance.clone()
      client.deploy = jest.fn().mockImplementation(() => Promise.resolve())
      testGraph = new Graph()
    })

    const adapterAdd = (after: ChangeDataType): Promise<DeployResult> =>
      netsuiteAdapter.deploy({
        changeGroup: {
          groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
          changes: [{ action: 'add', data: { after } }],
        },
        progressReporter: nullProgressReporter,
      })

    describe('add', () => {
      it('should add custom type instance', async () => {
        const result = await adapterAdd(instance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = Buffer.from('description value')
        const customizationInfo = await toCustomizationInfo(expectedResolvedInstance)
        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'addition',
            customizationInfo,
            change: toChange({ after: expectedResolvedInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post.isEqual(instance)).toBe(true)
      })

      it('should add file instance', async () => {
        const result = await adapterAdd(fileInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        const customizationInfo = await toCustomizationInfo(fileInstance)
        const serviceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html'
        testGraph.addNodes([
          new GraphNode('netsuite.file.instance.fileInstance', {
            serviceid: serviceId,
            changeType: 'addition',
            customizationInfo,
            change: toChange({ after: fileInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post.isEqual(fileInstance)).toBe(true)
      })

      it('should add folder instance', async () => {
        const result = await adapterAdd(folderInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        const customizationInfo = await toCustomizationInfo(folderInstance)
        const serviceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder'
        testGraph.addNodes([
          new GraphNode('netsuite.folder.instance.folderInstance', {
            serviceid: serviceId,
            changeType: 'addition',
            customizationInfo,
            change: toChange({ after: folderInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post.isEqual(folderInstance)).toBe(true)
      })

      it('should support deploying multiple changes at once', async () => {
        const fileChange = toChange({ after: fileInstance })
        const folderChange = toChange({ after: folderInstance })
        const result = await netsuiteAdapter.deploy({
          changeGroup: {
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
            changes: [fileChange, folderChange],
          },
          progressReporter: nullProgressReporter,
        })
        const folderCustInfo = await toCustomizationInfo(folderInstance)
        const fileCustInfo = await toCustomizationInfo(fileInstance)
        const folderServiceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder'
        const fileServiceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html'
        testGraph.addNodes([
          new GraphNode('netsuite.file.instance.fileInstance', {
            serviceid: fileServiceId,
            changeType: 'addition',
            customizationInfo: fileCustInfo,
            change: fileChange,
          }),
          new GraphNode('netsuite.folder.instance.folderInstance', {
            serviceid: folderServiceId,
            changeType: 'addition',
            customizationInfo: folderCustInfo,
            change: folderChange,
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(2)
      })

      it('should return correct DeployResult in case of failure', async () => {
        const clientError = new Error('some client error')
        client.deploy = jest.fn().mockRejectedValue(clientError)
        const fileChange = toChange({ after: fileInstance })
        const folderChange = toChange({ after: folderInstance })
        const result = await netsuiteAdapter.deploy({
          changeGroup: {
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
            changes: [fileChange, folderChange],
          },
          progressReporter: nullProgressReporter,
        })
        const folderCustInfo = await toCustomizationInfo(folderInstance)
        const fileCustInfo = await toCustomizationInfo(fileInstance)
        const folderServiceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder'
        const fileServiceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html'
        testGraph.addNodes([
          new GraphNode('netsuite.file.instance.fileInstance', {
            serviceid: fileServiceId,
            changeType: 'addition',
            customizationInfo: fileCustInfo,
            change: fileChange,
          }),
          new GraphNode('netsuite.folder.instance.folderInstance', {
            serviceid: folderServiceId,
            changeType: 'addition',
            customizationInfo: folderCustInfo,
            change: folderChange,
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(result.errors).toHaveLength(1)
        expect(result.errors).toEqual([
          { message: clientError.message, detailedMessage: clientError.message, severity: 'Error' },
        ])
        expect(result.appliedChanges).toHaveLength(0)
      })
    })

    describe('update', () => {
      const adapterUpdate = (before: ChangeDataType, after: ChangeDataType): Promise<DeployResult> =>
        netsuiteAdapter.deploy({
          changeGroup: {
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
            changes: [{ action: 'modify', data: { before, after } }],
          },
          progressReporter: nullProgressReporter,
        })

      it('should update custom type instance', async () => {
        const result = await adapterUpdate(instance, instance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = Buffer.from('description value')
        const customizationInfo = await toCustomizationInfo(expectedResolvedInstance)
        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'modification',
            addedObjects: new Set(),
            customizationInfo,
            change: toChange({
              before: instance,
              after: expectedResolvedInstance,
            }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post).toEqual(instance)
      })

      it('should update file instance', async () => {
        const result = await adapterUpdate(fileInstance, fileInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        const customizationInfo = await toCustomizationInfo(fileInstance)
        const serviceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html'
        testGraph.addNodes([
          new GraphNode('netsuite.file.instance.fileInstance', {
            serviceid: serviceId,
            changeType: 'modification',
            addedObjects: new Set(),
            customizationInfo,
            change: toChange({ before: fileInstance, after: fileInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post).toEqual(fileInstance)
      })

      it('should update folder instance', async () => {
        const result = await adapterUpdate(folderInstance, folderInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        const customizationInfo = await toCustomizationInfo(folderInstance)
        const serviceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder'
        testGraph.addNodes([
          new GraphNode('netsuite.folder.instance.folderInstance', {
            serviceid: serviceId,
            changeType: 'modification',
            addedObjects: new Set(),
            customizationInfo,
            change: toChange({ before: folderInstance, after: folderInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post).toEqual(folderInstance)
      })

      it('should restore static file', async () => {
        const after = instance.clone()
        after.value.description = new StaticFile({
          filepath: 'netsuite/elementName.suffix',
          content: Buffer.from('edited description value'),
        })
        const result = await adapterUpdate(instance, after)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedAfter = after.clone()
        expectedResolvedAfter.value.description = Buffer.from('edited description value')
        const customizationInfo = await toCustomizationInfo(expectedResolvedAfter)
        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'modification',
            addedObjects: new Set(),
            customizationInfo,
            change: toChange({
              before: instance,
              after: expectedResolvedAfter,
            }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post).toEqual(after)
      })
    })
    describe('additional sdf dependencies', () => {
      let expectedResolvedInstance: InstanceElement
      let custInfo: CustomizationInfo
      beforeAll(async () => {
        expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = Buffer.from('description value')
        custInfo = await toCustomizationInfo(expectedResolvedInstance)
      })
      it('should call deploy with additional dependencies', async () => {
        const configWithAdditionalSdfDependencies = {
          typesToSkip: [SAVED_SEARCH, TRANSACTION_FORM],
          fetchAllTypesAtOnce: true,
          deploy: {
            additionalDependencies: {
              include: {
                objects: ['addedObject'],
                features: ['addedFeature'],
              },
            },
          },
          fetch: fullFetchConfig(),
        }
        const netsuiteAdapterWithAdditionalSdfDependencies = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter, resolveValuesFilter],
          config: configWithAdditionalSdfDependencies,
          originalConfig: config,
          getElemIdFunc: mockGetElemIdFunc,
        })

        await netsuiteAdapterWithAdditionalSdfDependencies.deploy({
          changeGroup: {
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
            changes: [{ action: 'add', data: { after: instance } }],
          },
          progressReporter: nullProgressReporter,
        })
        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'addition',
            customizationInfo: custInfo,
            change: toChange({ after: expectedResolvedInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(
          undefined,
          {
            ...DEFAULT_SDF_DEPLOY_PARAMS,
            manifestDependencies: {
              ...DEFAULT_SDF_DEPLOY_PARAMS.manifestDependencies,
              includedObjects: ['addedObject'],
              optionalFeatures: ['addedFeature'],
            },
          },
          testGraph,
        )
      })

      it('should call deploy without additional dependencies', async () => {
        await adapterAdd(instance)

        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'addition',
            customizationInfo: custInfo,
            change: toChange({ after: expectedResolvedInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
      })
    })

    describe('deploy errors', () => {
      let adapter: NetsuiteAdapter
      const mockClientDeploy = jest.fn()
      beforeEach(() => {
        adapter = new NetsuiteAdapter({
          client: { deploy: mockClientDeploy } as unknown as NetsuiteClient,
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [],
          config: { fetch: fullFetchConfig() },
          originalConfig: config,
        })
      })
      it('should return correct deploy errors', async () => {
        const customSegment = new InstanceElement('cseg1', standardTypes.customsegment.type)
        const customRecordType = new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord_cseg1'),
          fields: {
            custom_field: { refType: BuiltinTypes.STRING },
          },
          annotations: {
            [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          },
        })
        const errors: (SaltoError | SaltoElementError)[] = [
          // general SaltoError
          {
            message: 'General error',
            detailedMessage: 'General error',
            severity: 'Error',
          },
          // field SaltoElementError
          {
            elemID: customRecordType.fields.custom_field.elemID,
            message: 'Custom Field Error',
            detailedMessage: 'Custom Field Error',
            severity: 'Error',
          },
          // should be ignored (duplicates the field error)
          {
            elemID: customRecordType.elemID,
            message: 'Custom Field Error',
            detailedMessage: 'Custom Field Error',
            severity: 'Error',
          },
          // should be transformed to a SaltoError
          {
            elemID: customSegment.elemID,
            message: 'Custom Segment Error',
            detailedMessage: 'Custom Segment Error',
            severity: 'Error',
          },
        ]
        mockClientDeploy.mockResolvedValue({ appliedChanges: [], errors })
        const deployRes = await adapter.deploy({
          changeGroup: {
            changes: [toChange({ after: customRecordType.fields.custom_field })],
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
          },
          progressReporter: nullProgressReporter,
        })
        expect(deployRes).toEqual({
          appliedChanges: [],
          errors: [
            {
              elemID: customRecordType.fields.custom_field.elemID,
              message: 'Custom Field Error',
              detailedMessage: 'Custom Field Error',
              severity: 'Error',
            },
            {
              message: 'General error',
              detailedMessage: 'General error',
              severity: 'Error',
            },
            {
              message: 'Custom Segment Error',
              detailedMessage: 'Custom Segment Error',
              severity: 'Error',
            },
          ],
        })
      })
    })
  })

  describe('SuiteAppClient', () => {
    let adapter: NetsuiteAdapter
    let suiteAppClient: SuiteAppClient

    const dummyElement = new ObjectType({ elemID: new ElemID('dum', 'test') })
    const elementsSource = buildElementsSourceFromElements([dummyElement])
    const getElementMock = jest.spyOn(elementsSource, 'get')
    const getChangedObjectsMock = jest.spyOn(changesDetector, 'getChangedObjects')
    const getDeletedElementsMock = jest.spyOn(deletionCalculator, 'getDeletedElements')

    beforeEach(() => {
      getElementMock.mockReset()

      getChangedObjectsMock.mockReset()
      getChangedObjectsMock.mockResolvedValue({
        isTypeMatch: () => true,
        areAllObjectsMatch: () => false,
        isObjectMatch: objectID => objectID.instanceId.startsWith('aa'),
        isFileMatch: () => true,
        isParentFolderMatch: () => true,
        areSomeFilesMatch: () => true,
        isCustomRecordTypeMatch: () => true,
        areAllCustomRecordsMatch: () => true,
        isCustomRecordMatch: () => true,
      })

      getDeletedElementsMock.mockReset()
      getDeletedElementsMock.mockResolvedValue({})

      getSystemInformationMock.mockReset()
      getSystemInformationMock.mockResolvedValue({
        time: new Date(1000),
        appVersion: [0, 1, 0],
      })

      getCustomRecordsMock.mockReset()
      getCustomRecordsMock.mockResolvedValue({
        customRecords: [
          {
            type: 'testtype',
            records: [],
          },
        ],
        largeTypesError: [],
      })

      suiteAppClient = {
        getSystemInformation: getSystemInformationMock,
        getNetsuiteWsdl: () => undefined,
        getConfigRecords: () => [],
        runSavedSearchQuery: () => [],
        runSuiteQL: () => [],
        getInstalledBundles: () => [],
        getCustomRecords: getCustomRecordsMock,
      } as unknown as SuiteAppClient

      adapter = new NetsuiteAdapter({
        client: new NetsuiteClient(client, suiteAppClient),
        elementsSource,
        filtersCreators: [firstDummyFilter, secondDummyFilter],
        config,
        originalConfig: config,
        getElemIdFunc: mockGetElemIdFunc,
      })
    })

    it('should use suiteAppFileCabinet importFileCabinet and pass it the right params', async () => {
      await adapter.fetch(mockFetchOpts)
      expect(suiteAppImportFileCabinetMock).toHaveBeenCalledWith(suiteAppClient, {
        query: expect.anything(),
        maxFileCabinetSizeInGB: 3,
        extensionsToExclude: ['.*\\.(csv|pdf|png)'],
        maxFilesPerFileCabinetFolder: [],
        wrapFolderIdsWithQuotes: false,
      })
    })

    it('should not create serverTime elements when getSystemInformation returns undefined', async () => {
      getSystemInformationMock.mockResolvedValue(undefined)

      const { elements } = await adapter.fetch(mockFetchOpts)
      expect(elements.filter(e => e.elemID.getFullName().includes(SERVER_TIME_TYPE_NAME))).toHaveLength(0)
    })

    it('should create the serverTime elements when getSystemInformation returns the time', async () => {
      const { elements } = await adapter.fetch(mockFetchOpts)
      expect(elements.filter(e => e.elemID.getFullName().includes(SERVER_TIME_TYPE_NAME))).toHaveLength(2)

      const serverTimeInstance = elements.find(e =>
        e.elemID.isEqual(new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)),
      )
      expect((serverTimeInstance as InstanceElement)?.value?.serverTime).toEqual(new Date(1000).toJSON())
      expect(getChangedObjectsMock).not.toHaveBeenCalled()
    })

    describe('getChangedObjects', () => {
      beforeEach(() => {
        getElementMock.mockResolvedValue(
          new InstanceElement(
            ElemID.CONFIG_NAME,
            new ObjectType({ elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME) }),
            {
              serverTime: '1970-01-01T00:00:00.500Z',
            },
          ),
        )

        suiteAppClient = {
          getSystemInformation: getSystemInformationMock,
          getNetsuiteWsdl: () => undefined,
          getConfigRecords: getConfigRecordsMock.mockReturnValue([
            {
              configType: 'USER_PREFERENCES',
              fieldsDef: [],
              data: { fields: { DATEFORMAT: 'YYYY-MM-DD', TIMEFORMAT: 'hh:m a' } },
            },
          ]),
          getInstalledBundles: () => [],
          getCustomRecords: getCustomRecordsMock,
          runSuiteQL: () => [],
        } as unknown as SuiteAppClient

        adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client, suiteAppClient),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
            fetchTarget: {
              types: {
                workflow: ['.*'],
              },
              filePaths: [],
            },
          },
          originalConfig: config,
          getElemIdFunc: mockGetElemIdFunc,
        })
      })
      it('should call getChangedObjects with the right date range', async () => {
        await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
        expect(getElementMock).toHaveBeenCalledWith(
          new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
        )
        expect(getChangedObjectsMock).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.objectContaining({
            start: new Date('1970-01-01T00:00:00.500Z'),
            end: new Date(1000),
          }),
          expect.any(Object),
        )
      })

      it('should not call getChangedObjects if date format is undefind', async () => {
        getConfigRecordsMock.mockReturnValue([
          {
            configType: SUITEAPP_CONFIG_RECORD_TYPES[0],
            fieldsDef: [],
            data: { fields: { DATEFORMAT: undefined, TIMEFORMAT: 'hh:m a' } },
          },
        ])
        await adapter.fetch(mockFetchOpts)
        expect(getChangedObjectsMock).toHaveBeenCalledTimes(0)
      })

      it('should pass the received query to the client', async () => {
        const getCustomObjectsMock = jest.spyOn(client, 'getCustomObjects')
        await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })

        const passedQuery = getCustomObjectsMock.mock.calls[0][1].updatedFetchQuery
        expect(passedQuery.isObjectMatch({ instanceId: 'aaaa', type: 'workflow' })).toBeTruthy()
        expect(passedQuery.isObjectMatch({ instanceId: 'bbbb', type: 'workflow' })).toBeFalsy()
      })

      it('should not call getChangedObjectsMock if server time instance is invalid', async () => {
        getElementMock.mockResolvedValue(
          new InstanceElement(
            ElemID.CONFIG_NAME,
            new ObjectType({ elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME) }),
            {},
          ),
        )
        await adapter.fetch(mockFetchOpts)
        expect(getElementMock).toHaveBeenCalledWith(
          new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
        )
        expect(getChangedObjectsMock).not.toHaveBeenCalled()
      })

      it('should not call getChangedObjects if useChangesDetection is false', async () => {
        adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client, suiteAppClient),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
            fetchTarget: {
              types: {
                workflow: ['.*'],
              },
              filePaths: [],
            },
          },
          originalConfig: config,
          getElemIdFunc: mockGetElemIdFunc,
        })

        await adapter.fetch(mockFetchOpts)
        expect(getChangedObjectsMock).not.toHaveBeenCalled()
      })

      it('should call getChangedObjects even if fetchTarget is not defined', async () => {
        adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client, suiteAppClient),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
          },
          originalConfig: config,
          getElemIdFunc: mockGetElemIdFunc,
        })

        await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
        expect(getChangedObjectsMock).toHaveBeenCalled()
      })
    })

    describe('filter types with too many instances', () => {
      beforeEach(() => {
        const getDataElementsMock = getDataElements as jest.Mock
        getDataElementsMock.mockResolvedValue({
          elements: [],
          largeTypesError: ['excludedTypeDataElements'],
        })

        getCustomRecordsMock.mockResolvedValue({
          customRecords: [],
          largeTypesError: ['excludedTypeCustomRecord'],
        })
      })

      it('should filter from data elements and custom records', async () => {
        await adapter.fetch(mockFetchOpts)
        expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
          {
            failedToFetchAllAtOnce: false,
            failedFilePaths: expect.anything(),
            failedTypes: {
              lockedError: {},
              unexpectedError: {},
              excludedTypes: ['excludedTypeDataElements'],
            },
            failedCustomRecords: ['excludedTypeCustomRecord'],
          },
          config,
        )
      })
    })

    describe('call getDeletedElements and process result', () => {
      const spy = jest.spyOn(elementsSourceIndexModule, 'createElementsSourceIndex')
      let elemId: ElemID
      beforeEach(() => {
        elemId = new ElemID(NETSUITE, ROLE)
        getDeletedElementsMock.mockReset()
        getDeletedElementsMock.mockResolvedValue({ deletedElements: [elemId] })
      })

      it('check call getDeletedElements and verify return value', async () => {
        const { partialFetchData } = await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
        expect(getDeletedElementsMock).toHaveBeenCalled()
        expect(partialFetchData?.deletedElements).toEqual([elemId])
        const { typeToInternalId, internalIdToTypes } = getTypesToInternalId([])
        expect(spy).toHaveBeenCalledWith({
          elementsSource: expect.anything(),
          isPartial: true,
          typeToInternalId,
          internalIdToTypes,
          deletedElements: [elemId],
        })
      })
    })

    describe('do not call getDeletedElements on full fetch', () => {
      const spy = jest.spyOn(elementsSourceIndexModule, 'createElementsSourceIndex')
      let elemId: ElemID
      beforeEach(() => {
        elemId = new ElemID(NETSUITE, ROLE)
        getDeletedElementsMock.mockReset()
        getDeletedElementsMock.mockResolvedValue({ deletedElements: [elemId] })
      })

      it('check call getDeletedElements and verify return value', async () => {
        const { partialFetchData } = await adapter.fetch({ ...mockFetchOpts })
        expect(getDeletedElementsMock).not.toHaveBeenCalled()
        expect(partialFetchData?.deletedElements).toEqual(undefined)
        const { typeToInternalId, internalIdToTypes } = getTypesToInternalId([])
        expect(spy).toHaveBeenCalledWith({
          elementsSource: expect.anything(),
          isPartial: false,
          typeToInternalId,
          internalIdToTypes,
          deletedElements: [],
        })
      })
    })
  })
})

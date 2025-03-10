/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ObjectType, BuiltinTypes, InstanceElement, ListType, Value } from '@salto-io/adapter-api'
import { parser } from '@salto-io/parser'
import { DirectoryStore } from '../../src/workspace/dir_store'
import { configSource } from '../../src/workspace/config_source'

jest.mock('../../src/workspace/dir_store')
describe('configs', () => {
  const adapter = 'mockadapter'
  const configID = new ElemID(adapter)
  const configType = new ObjectType({
    elemID: configID,
    fields: {
      field1: { refType: new ListType(BuiltinTypes.STRING) },
      field2: { refType: BuiltinTypes.STRING },
    },
  })
  const config = new InstanceElement(ElemID.CONFIG_NAME, configType, {
    field1: ['test1', 'test2'],
    field2: 'test3',
  })

  let dumpedConfig: Value
  const mockSet = jest.fn()
  const mockGet = jest.fn()
  const mockDelete = jest.fn()
  const mockRename = jest.fn()
  const mockFlush = jest.fn()
  const mockedDirStore = {
    get: mockGet,
    set: mockSet,
    delete: mockDelete,
    renameFile: mockRename,
    flush: mockFlush,
  } as unknown as DirectoryStore<string>

  beforeEach(async () => {
    dumpedConfig = { filename: `${adapter}.nacl`, buffer: await parser.dumpElements([config], {}) }
    jest.resetAllMocks()
  })

  it('should set new adapter config', async () => {
    mockSet.mockResolvedValueOnce(true)
    mockFlush.mockResolvedValue(true)
    await configSource(mockedDirStore).set(adapter, config)
    expect(mockSet).toHaveBeenCalledWith(dumpedConfig)
    expect(mockFlush).toHaveBeenCalledTimes(1)
  })

  it('should get adapter config if exists', async () => {
    mockGet.mockResolvedValueOnce(dumpedConfig)
    const fromConfigStore = await configSource(mockedDirStore).get(adapter)
    expect(fromConfigStore?.value).toEqual(config.value)
  })

  it('should delete adapter config', async () => {
    await configSource(mockedDirStore).delete(adapter)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledWith(adapter)
  })

  it('should rename adapter config', async () => {
    await configSource(mockedDirStore).rename('old', 'new')
    expect(mockRename).toHaveBeenCalledTimes(1)
    expect(mockRename).toHaveBeenCalledWith('old', 'new')
  })

  it('should not fail if adapter config not exists', async () => {
    mockGet.mockResolvedValueOnce(undefined)
    const fromConfigStore = await configSource(mockedDirStore).get(adapter)
    expect(fromConfigStore).toBeUndefined()
  })
})

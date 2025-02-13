/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { staticFiles } from '@salto-io/workspace'
import * as AWS from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import { buildS3DirectoryStore } from '../src/s3_dir_store'

describe('buildS3DirectoryStore', () => {
  const bucketName = 'bucketName'
  const baseDir = 'baseDir'
  let directoryStore: staticFiles.StateStaticFilesStore
  let getObjectMock: jest.Mock
  let listObjectsV2Mock: jest.Mock
  let putObjectMock: jest.Mock
  let deleteManyObjectsMock: jest.Mock

  beforeEach(() => {
    getObjectMock = jest.fn().mockResolvedValue(undefined)
    listObjectsV2Mock = jest.fn().mockResolvedValue(undefined)
    putObjectMock = jest.fn().mockResolvedValue(undefined)
    deleteManyObjectsMock = jest.fn().mockResolvedValue(undefined)

    const mockS3Client = {
      getObject: getObjectMock,
      listObjectsV2: listObjectsV2Mock,
      putObject: putObjectMock,
      deleteObjects: deleteManyObjectsMock,
    }

    directoryStore = buildS3DirectoryStore({
      bucketName,
      baseDir,
      S3Client: mockS3Client as unknown as AWS.S3,
    })
  })

  describe('list', () => {
    it('should return true if the file exists', async () => {
      listObjectsV2Mock
        .mockResolvedValueOnce({
          Contents: [{ Key: `${baseDir}/a1` }, { Key: `${baseDir}/a2` }],
          NextContinuationToken: 'nextToken',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: `${baseDir}/a3` }, { Key: `${baseDir}/a4` }],
        })
      expect(await directoryStore.list()).toEqual(['a1', 'a2', 'a3', 'a4'])
      expect(listObjectsV2Mock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Prefix: baseDir,
        ContinuationToken: undefined,
      })

      expect(listObjectsV2Mock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Prefix: baseDir,
        ContinuationToken: 'nextToken',
      })
    })

    it('should throw on unexpected error', async () => {
      listObjectsV2Mock.mockRejectedValue(new Error())
      await expect(directoryStore.list()).rejects.toThrow()
      expect(listObjectsV2Mock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Prefix: baseDir,
        ContinuationToken: undefined,
      })
    })

    it('should use cached data', async () => {
      listObjectsV2Mock.mockResolvedValueOnce({
        Contents: [],
      })

      await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })
      expect(await directoryStore.list()).toEqual(['a/b'])

      expect(listObjectsV2Mock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Prefix: baseDir,
        ContinuationToken: undefined,
      })
    })
  })

  describe('get', () => {
    it('should return the file if exists', async () => {
      const readable = new Readable()
      readable.push('body')
      readable.push(null)
      getObjectMock.mockResolvedValue({
        Body: readable,
      })
      expect(await directoryStore.get('a/b')).toEqual({
        filename: 'a/b',
        buffer: Buffer.from('body'),
      })
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })

    it('should return undefined if received unexpected type', async () => {
      getObjectMock.mockResolvedValue({
        Body: 'unexpected',
      })
      expect(await directoryStore.get('a/b')).toBeUndefined()
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })

    it('should return undefined the file does not exist', async () => {
      getObjectMock.mockRejectedValue({ name: 'NoSuchKey' })
      expect(await directoryStore.get('a/b')).toBeUndefined()
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })

    it('should return undefined the body was not returned', async () => {
      getObjectMock.mockResolvedValue({})
      expect(await directoryStore.get('a/b')).toBeUndefined()
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })

    it('should use cached data', async () => {
      await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })
      expect(await directoryStore.get('a/b')).toEqual({
        filename: 'a/b',
        buffer: Buffer.from('aaa'),
      })

      expect(getObjectMock).not.toHaveBeenCalled()
    })

    it('should throw on unexpected error', async () => {
      getObjectMock.mockRejectedValue(new Error())
      await expect(directoryStore.get('a/b')).rejects.toThrow()
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })
  })

  describe('set', () => {
    it('should write the file', async () => {
      await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })

      expect(putObjectMock).not.toHaveBeenCalled()

      await directoryStore.flush()

      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
        Body: Buffer.from('aaa'),
      })
    })

    it('should throw on unexpected error', async () => {
      putObjectMock.mockRejectedValue(new Error())
      await directoryStore.set({ filename: '', buffer: Buffer.from('aaa') })
      await expect(directoryStore.flush()).rejects.toThrow()
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir',
        Body: Buffer.from('aaa'),
      })
    })

    it('should write the file only once', async () => {
      await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })

      expect(putObjectMock).not.toHaveBeenCalled()

      await directoryStore.flush()

      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
        Body: Buffer.from('aaa'),
      })

      await directoryStore.flush()

      expect(putObjectMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('getFullPath', () => {
    it('should throw on unexpected error', async () => {
      expect(directoryStore.getFullPath('somePath')).toBe(`s3://${bucketName}/baseDir/somePath`)
    })
  })
  describe('delete', () => {
    it('should delete the file', async () => {
      await directoryStore.delete('a/b')

      expect(deleteManyObjectsMock).not.toHaveBeenCalled()

      await directoryStore.flush()

      expect(deleteManyObjectsMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Delete: {
          Objects: [{ Key: 'baseDir/a/b' }],
        },
      })
    })
    it('should delete the file with a single API call', async () => {
      await directoryStore.delete('a/b')
      await directoryStore.delete('a/c')

      expect(deleteManyObjectsMock).not.toHaveBeenCalled()

      await directoryStore.flush()

      expect(deleteManyObjectsMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Delete: {
          Objects: [{ Key: 'baseDir/a/b' }, { Key: 'baseDir/a/c' }],
        },
      })
    })
    it('should delete a batch of 1000 files each API Call', async () => {
      const files = Array.from({ length: 2000 }, (_, i) => `a/${i}`)
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      files.forEach(async file => directoryStore.delete(file))

      expect(deleteManyObjectsMock).not.toHaveBeenCalled()

      await directoryStore.flush()

      expect(deleteManyObjectsMock).toHaveBeenCalledTimes(2)
      expect(deleteManyObjectsMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Delete: {
          Objects: files.slice(0, 1000).map(file => ({ Key: `baseDir/${file}` })),
        },
      })
      expect(deleteManyObjectsMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Delete: {
          Objects: files.slice(1000).map(file => ({ Key: `baseDir/${file}` })),
        },
      })
    })

    it('should throw on unexpected error', async () => {
      putObjectMock.mockRejectedValue(new Error())
      await directoryStore.set({ filename: '', buffer: Buffer.from('aaa') })
      await expect(directoryStore.flush()).rejects.toThrow()
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir',
        Body: Buffer.from('aaa'),
      })
    })
  })
  describe('when deleting the file and then setting the file', () => {
    it('should wrirte the file', async () => {
      await directoryStore.delete('a/b')
      await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })

      expect(deleteManyObjectsMock).not.toHaveBeenCalled()
      expect(putObjectMock).not.toHaveBeenCalled()
      await directoryStore.flush()

      expect(deleteManyObjectsMock).not.toHaveBeenCalled()
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
        Body: Buffer.from('aaa'),
      })
    })
    describe('when setting the file and then deleting the file', () => {
      it('should delete the file with a single API call', async () => {
        await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })
        await directoryStore.delete('a/b')

        expect(deleteManyObjectsMock).not.toHaveBeenCalled()
        expect(putObjectMock).not.toHaveBeenCalled()

        await directoryStore.flush()
        expect(deleteManyObjectsMock).toHaveBeenCalledWith({
          Bucket: bucketName,
          Delete: {
            Objects: [{ Key: 'baseDir/a/b' }],
          },
        })
        expect(putObjectMock).not.toHaveBeenCalled()
      })
      it('should not get the file', async () => {
        await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })
        await directoryStore.delete('a/b')
        expect(await directoryStore.get('a/b')).toBeUndefined()
      })
    })
  })
})

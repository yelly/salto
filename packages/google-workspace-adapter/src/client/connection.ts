/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AccountInfo } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { OAuth2Client } from 'google-auth-library'
import { Credentials } from '../auth'
import { OauthAccessTokenCredentials } from './oauth'

const log = logger(module)

const validateDirectoryCredentials = async ({
  connection,
}: {
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    const defualtCustomer = await connection.get('/admin/directory/v1/customers/my_customer')
    const primaryDomain = defualtCustomer.data.customerDomain
    if (primaryDomain === undefined) {
      throw new Error('Failed to find primary domain')
    }
    return { accountId: primaryDomain }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }
}

// There is no endPoints for groupSettings that we can use to validate the credentials with.
const validateGroupSettingsCredentials = async (): Promise<AccountInfo> => ({ accountId: 'googoo' })

// There is no endPoints for groupSettings that we can use to validate the credentials with.
const validateCloudIdentityCredentials = async (): Promise<AccountInfo> => ({ accountId: 'googoo' })

const validateCredentialsPerApp: Record<
  string,
  ({
    credentials,
    connection,
  }: {
    credentials: Credentials
    connection: clientUtils.APIConnection
  }) => Promise<AccountInfo>
> = {
  directory: validateDirectoryCredentials,
  groupSettings: validateGroupSettingsCredentials,
  cloudIdentity: validateCloudIdentityCredentials,
}

const baseUrlPerApp: Record<string, string> = {
  directory: 'https://admin.googleapis.com',
  groupSettings: 'https://www.googleapis.com',
  cloudIdentity: 'https://cloudidentity.googleapis.com',
}

const isOauthCredentials = (cred: Credentials): cred is OauthAccessTokenCredentials => 'refreshToken' in cred

export const createConnectionForApp =
  (app: string): clientUtils.ConnectionCreator<Credentials> =>
  retryOptions =>
    clientUtils.axiosConnection({
      retryOptions,
      baseURLFunc: async () => baseUrlPerApp[app],
      authParamsFunc: async (creds: Credentials) => {
        if (!isOauthCredentials(creds)) {
          return {
            headers: {
              Authorization: `Bearer ${creds.accessToken}`,
            },
          }
        }
        const oAuth2Client = new OAuth2Client(creds.clientId, creds.clientSecret)
        oAuth2Client.setCredentials({ refresh_token: creds.refreshToken })
        const { token } = await oAuth2Client.getAccessToken()
        return {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      },
      credValidateFunc: validateCredentialsPerApp[app],
    })

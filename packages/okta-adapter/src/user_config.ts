/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { elements, definitions } from '@salto-io/adapter-components'
import { BuiltinTypes, CORE_ANNOTATIONS, createRestriction } from '@salto-io/adapter-api'
import { OKTA, USER_TYPE_NAME } from './constants'

type GetUsersStrategy = 'searchQuery' | 'allUsers'

export type OktaUserFetchConfig = definitions.UserFetchConfig<{
  customNameMappingOptions: never
  fetchCriteria: definitions.DefaultFetchCriteria
}> & {
  isClassicOrg?: boolean
  convertUsersIds?: boolean
  enableMissingReferences?: boolean
  includeGroupMemberships?: boolean
  includeProfileMappingProperties?: boolean
  getUsersStrategy?: GetUsersStrategy
}

export type OktaClientRateLimitConfig = definitions.ClientRateLimitConfig & { rateLimitBuffer?: number }

export type OktaClientConfig = definitions.ClientBaseConfig<OktaClientRateLimitConfig> & {
  usePrivateAPI: boolean
}

export type OktaUserDeployConfig = definitions.UserDeployConfig & { omitMissingUsers?: boolean }

export type OktaUserConfig = definitions.UserConfig<never, OktaClientConfig, OktaUserFetchConfig, OktaUserDeployConfig>

const changeValidatorNames = [
  'createCheckDeploymentBasedOnConfig',
  'createCheckDeploymentBasedOnDefinitions',
  'appGroup',
  'groupRuleStatus',
  'groupRuleActions',
  'defaultPolicies',
  'customApplicationStatus',
  'userTypeAndSchema',
  'appIntegrationSetup',
  'assignedAccessPolicies',
  'groupSchemaModifyBase',
  'enabledAuthenticators',
  'users',
  'appUserSchemaWithInactiveApp',
  'appWithGroupPush',
  'groupPushToApplicationUniqueness',
  'appGroupAssignment',
  'appUrls',
  'profileMappingRemoval',
  'brandRemoval',
  'dynamicOSVersion',
  'brandThemeRemoval',
  'appUserSchemaRemoval',
  'domainAddition',
  'domainModification',
  'appUserSchemaBaseChanges',
  'userStatusChanges',
] as const

export type ChangeValidatorName = (typeof changeValidatorNames)[number]

// default config values
export const DEFAULT_CONVERT_USERS_IDS_VALUE = true
export const DEFAULT_GET_USERS_STRATEGY = 'searchQuery'
const DEFAULT_INCLUDE_PROFILE_MAPPING_PROPERTIES = false
const DEFAULT_APP_URLS_VALIDATOR_VALUE = false

export const DEFAULT_CONFIG: OktaUserConfig = {
  client: {
    usePrivateAPI: true,
  },
  fetch: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    exclude: [{ type: USER_TYPE_NAME }],
    hideTypes: true,
    convertUsersIds: DEFAULT_CONVERT_USERS_IDS_VALUE,
    enableMissingReferences: true,
    includeGroupMemberships: false,
    includeProfileMappingProperties: DEFAULT_INCLUDE_PROFILE_MAPPING_PROPERTIES,
    getUsersStrategy: DEFAULT_GET_USERS_STRATEGY,
  },
  deploy: {
    changeValidators: {
      appUrls: DEFAULT_APP_URLS_VALIDATOR_VALUE,
    },
  },
}

const additionalFetchConfigFields = {
  convertUsersIds: { refType: BuiltinTypes.BOOLEAN },
  enableMissingReferences: { refType: BuiltinTypes.BOOLEAN },
  includeGroupMemberships: { refType: BuiltinTypes.BOOLEAN },
  includeProfileMappingProperties: { refType: BuiltinTypes.BOOLEAN },
  getUsersStrategy: {
    refType: BuiltinTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['searchQuery', 'allUsers'] }),
    },
  },
  isClassicOrg: { refType: BuiltinTypes.BOOLEAN },
}

export const configType = definitions.createUserConfigType({
  adapterName: OKTA,
  defaultConfig: DEFAULT_CONFIG,
  changeValidatorNames: [...changeValidatorNames],
  additionalFetchFields: additionalFetchConfigFields,
  additionalDeployFields: { omitMissingUsers: { refType: BuiltinTypes.BOOLEAN } },
  additionRateLimitFields: { rateLimitBuffer: { refType: BuiltinTypes.NUMBER } },
  additionalClientFields: {
    usePrivateAPI: { refType: BuiltinTypes.BOOLEAN },
  },
  omitElemID: false,
  pathsToOmitFromDefaultConfig: ['fetch.enableMissingReferences', 'fetch.getUsersStrategy'],
})

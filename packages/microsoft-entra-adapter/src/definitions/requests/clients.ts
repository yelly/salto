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
import { definitions } from '@salto-io/adapter-components'
import { Options } from '../types'

export const GRAPH_V1_PATH = '/v1.0'
export const GRAPH_BETA_PATH = '/beta'

export const createClientDefinitions = (
  clients: Record<
    definitions.ResolveClientOptionsType<Options>,
    definitions.RESTApiClientDefinition<definitions.ResolvePaginationOptionsType<Options>>['httpClient']
  >,
): definitions.ApiDefinitions<Options>['clients'] => ({
  default: 'main',
  options: {
    main: {
      httpClient: clients.main,
      endpoints: {
        default: {
          get: {
            pagination: 'cursor',
            readonly: true,
          },
          delete: {
            omitBody: true,
          },
        },
        customizations: {
          '/v1.0/groupLifecyclePolicies/{lifeCyclePolicyId}/addGroup': {
            post: {
              // After creating a group it takes a while for the group to be available for assigning it to a lifecycle policy
              // See a similar issue in https://stackoverflow.com/questions/47303158/add-group-member-fails-with-404-error
              polling: {
                interval: 6000,
                retries: 3,
                checkStatus: response => response.status === 200,
                retryOnStatus: [404],
              },
            },
          },
        },
      },
    },
  },
})

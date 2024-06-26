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
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import { ClientOptions, PaginationOptions } from '../types'

const { cursorPagination, pageOffsetPagination } = fetchUtils.request.pagination

export const USERS_PAGE_SIZE = '1000'

export const PAGINATION: Record<PaginationOptions, definitions.PaginationDefinitions<ClientOptions>> = {
  cursor: {
    funcCreator: () =>
      cursorPagination({
        pathChecker: (endpointPath, nextPath) => endpointPath === nextPath || endpointPath === `/wiki${nextPath}`,
        paginationField: '_links.next',
      }),
  },
  usersPagination: {
    funcCreator: () =>
      pageOffsetPagination({
        firstPage: 0,
        pageSize: Number(USERS_PAGE_SIZE),
        paginationField: 'startAt',
      }),
  },
}

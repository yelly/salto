/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import os from 'os'
import chalk from 'chalk'
import { logger } from '@salto-io/logging'
import { streams } from '@salto-io/lowerdash'
import { closeAllRemoteMaps } from '@salto-io/local-workspace'
import { CliInput, CliOutput, CliExitCode, SpinnerCreator, CliError } from './types'
import { CommandOrGroupDef } from './command_builder'
import {
  registerCommands,
  createProgramCommand,
  COMMANDER_ERROR_NAME,
  VERSION_CODE,
  HELP_DISPLAYED_CODE,
} from './command_register'

const log = logger(module)
const exceptionEvent = 'workspace.error'
const ERROR_STYLE = 'red'

export default async ({
  input,
  output,
  commandDefs,
  spinnerCreator,
  workspacePath,
}: {
  input: CliInput
  output: CliOutput
  commandDefs: CommandOrGroupDef[]
  spinnerCreator: SpinnerCreator
  workspacePath: string
}): Promise<CliExitCode> => {
  const startTime = new Date()
  try {
    const program = createProgramCommand()
    registerCommands(program, commandDefs, {
      telemetry: input.telemetry,
      config: input.config,
      output,
      spinnerCreator,
      workspacePath,
    })
    await program.parseAsync(input.args, { from: 'user' })
    return CliExitCode.Success
  } catch (err) {
    // Our commander configuration is to not exit after exiting (throwing an error)
    // This handles the proper exit code if the commander had an error/help/version print
    if (err.name && err.name === COMMANDER_ERROR_NAME) {
      if (err.code === HELP_DISPLAYED_CODE || err.code === VERSION_CODE) {
        return CliExitCode.Success
      }
      return CliExitCode.UserInputError
    }
    if (err instanceof CliError) {
      return err.exitCode
    }
    log.error(`Caught exception: ${[err, err.stack].filter(n => n).join(os.EOL)}`)
    input.telemetry.sendStackEvent(exceptionEvent, err, {})

    const errorStream = output.stderr
    const unstyledErrorString = `${[err].filter(n => n).join(os.EOL)}`
    const errorString = streams.hasColors(errorStream)
      ? chalk`{${ERROR_STYLE} ${unstyledErrorString}}`
      : unstyledErrorString
    errorStream.write(errorString)
    errorStream.write(os.EOL)
    return CliExitCode.AppError
  } finally {
    await closeAllRemoteMaps()
    log.info('ran "%s" in %d ms', input.args.join(' '), new Date().getTime() - startTime.getTime())
  }
}

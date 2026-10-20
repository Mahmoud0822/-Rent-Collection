import nextEnv from '@next/env'
import { spawnSync } from 'node:child_process'

nextEnv.loadEnvConfig(process.cwd())
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['prisma', 'generate'], { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' })
process.exit(result.status ?? 1)

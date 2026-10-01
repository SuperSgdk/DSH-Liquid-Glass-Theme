/**
 * Host registration for the liquid glass settings card.
 * Modified by SuperSgdk on 2026-10-01. The visual preferences remain in
 * browser storage; the empty Host schema makes the card discoverable.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { AQUA_SETTINGS_NAMESPACE } from './settings-namespace.ts'

export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(AQUA_SETTINGS_NAMESPACE, z.object({}))
  })
}

export { AQUA_SETTINGS_NAMESPACE }

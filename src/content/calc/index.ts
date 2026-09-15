import { nspireSteps } from './nspire'
import { ti84Steps } from './ti84'
import type { CalcId, CalcInstance, CalcStep } from './types'
import { CALC_FOOTER } from './types'

export type { CalcId, CalcInstance, CalcStep }
export { CALC_FOOTER }

export function calcSteps(calc: CalcId, inst: CalcInstance): CalcStep[] {
  return calc === 'ti84' ? ti84Steps(inst) : nspireSteps(inst)
}

export function calcPanels(inst: CalcInstance): Record<CalcId, CalcStep[]> {
  return { ti84: ti84Steps(inst), nspire: nspireSteps(inst) }
}

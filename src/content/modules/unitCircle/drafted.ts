/** What every unit-circle template builds before build.ts assembles and checks it. */
import type { TrigFigureSpec, TrigPart, TrigPartTrap, UnitCircleAnswer } from '@/content/types'
import type { CalcPanels } from '@/shared/types'

export interface UcDrafted {
  question: UnitCircleAnswer['question']
  prompt: string
  figure: TrigFigureSpec
  stages: TrigPart[]
  promisable: TrigPartTrap[]
  calc: CalcPanels
  calcExpr: string
  ruleCards: string[]
}

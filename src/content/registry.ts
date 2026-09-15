import type { ModuleId } from '@/shared/types'
import type { DifficultyKnobs, DrillItem, ModuleDef, ProblemInstance, TemplateDef } from './types'

const registry = new Map<ModuleId, ModuleDef>()
let drillGenerator: ((seed: number, count: number, family?: string) => DrillItem[]) | null = null

export const MODULES: ModuleDef[] = []

export function registerModule(def: ModuleDef): void {
  registry.set(def.id, def)
  const i = MODULES.findIndex((m) => m.id === def.id)
  if (i >= 0) MODULES.splice(i, 1)
  MODULES.push(def)
  MODULES.sort((a, b) => a.order - b.order)
}

export function registerDrillGenerator(fn: (seed: number, count: number, family?: string) => DrillItem[]): void {
  drillGenerator = fn
}

export function getModule(id: ModuleId): ModuleDef {
  const m = registry.get(id)
  if (!m) throw new Error(`Unknown module: ${id}`)
  return m
}

export function hasModule(id: string): id is ModuleId {
  return registry.has(id as ModuleId)
}

export function getTemplate(moduleId: ModuleId, templateId: string): TemplateDef {
  const t = getModule(moduleId).templates.find((x) => x.id === templateId)
  if (!t) throw new Error(`Unknown template: ${moduleId}/${templateId}`)
  return t
}

export function generateProblem(
  moduleId: ModuleId,
  templateId: string,
  seed: number,
  knobs: DifficultyKnobs = {},
): ProblemInstance {
  return getTemplate(moduleId, templateId).generate(seed >>> 0, knobs)
}

export function generateDrill(seed: number, count: number, family?: string): DrillItem[] {
  if (!drillGenerator) throw new Error('Drill generator not registered')
  return drillGenerator(seed >>> 0, count, family)
}

export function allTemplates(): { module: ModuleDef; template: TemplateDef }[] {
  return MODULES.flatMap((module) => module.templates.map((template) => ({ module, template })))
}

export function problemId(moduleId: ModuleId, templateId: string, version: number, seed: number): string {
  return `${moduleId}/${templateId}@${version}/${(seed >>> 0).toString(36)}`
}

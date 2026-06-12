import { createHash } from 'node:crypto'
import type { SkillMetadata } from '../skills/types.js'

export function computeDynamicContextHash(instructionContent: string, skills: SkillMetadata[]): string {
  const dynamicInputs = JSON.stringify({
    instructions: instructionContent,
    skills: skills.map((s) => s.id).sort(),
  })
  return createHash('sha256').update(dynamicInputs).digest('hex')
}

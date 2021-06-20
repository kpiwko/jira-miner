export type JiraSchema = {
  project: string
  key?: string
  workflows?: string[]
  components?: string[]
  states: string[]
  completeStates: string[]
  incompleteStates: string[]
  reviewStates: string[]
  priorities?: string[] // note priorities are supposed to be ordered from lower to highest priority
  severities?: string[] // note severities are supposed to be ordered from lower to highest priority
  bugsTypes: string[]
  enhancementTypes?: string[]
}

export type ComposedJiraSchema = {
  id: string
  schemas: JiraSchema[]
}

export const composeJiraSchema = (id: string, schema: JiraSchema, additionalSchemas: JiraSchema[] = []): ComposedJiraSchema => {
  return {
    id,
    schemas: [schema, ...additionalSchemas],
  }
}

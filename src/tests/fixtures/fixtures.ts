import tmp from 'tmp'
import jsonfile from 'jsonfile'
import path from 'path'
import { HistoryCollection, JiraDBFactory } from '../../db/LocalJiraDB'
import { Issue, IssueJson } from '../../jira/Issue'
import { JiraSchema } from '../../jira/JiraSchema'

export const schemaFixture: JiraSchema = {
  project: 'AeroGear',
  states: ['Open', 'Resolved', 'Closed'],
  completeStates: ['Closed'],
  incompleteStates: ['Resolved'],
  reviewStates: ['Resolved'],
  priorities: ['Minor', 'Major', 'Critical', 'Blocker'],
  severities: ['Minor', 'Major', 'Critical', 'Blocker'],
  enhancementTypes: ['Enhancement', 'Feature Request'],
  bugsTypes: ['Bug'],
}

export type Malformation<T> = (data: T[]) => T[]

export async function dbFixture({
  malformation = (data) => data,
  source = '../fixtures/aerogear200issues.json',
}: {
  malformation?: Malformation<IssueJson>
  source?: string
}): Promise<HistoryCollection> {
  const dbpath = tmp.fileSync()
  const testDB = await JiraDBFactory.localInstance(dbpath.name)

  let jiraData = jsonfile.readFileSync(path.join(__dirname, source)) as IssueJson[]
  if (malformation) {
    jiraData = malformation(jiraData)
  }

  const jiraFields = jsonfile.readFileSync(path.join(__dirname, '../fixtures/jiraFields.json'))
  const issues = jiraData.map((issue: any) => {
    return new Issue(issue, jiraFields)
  })

  return await testDB.populate('aerogear200issues', issues)
}

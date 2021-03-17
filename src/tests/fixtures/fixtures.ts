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

export const dbFixture = async ({
  malformation = (data) => data,
  source = '../fixtures/aerogear200issues.json',
}: {
  malformation?: Malformation<IssueJson>
  source?: string
}): Promise<HistoryCollection> => {
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

export const issuesFixture = ({ malformation = (data) => data }: { malformation?: Malformation<Issue> }): Issue[] => {
  const issueData: Issue[] = [
    {
      id: 'issue-1',
      key: 'ISSUE-1',
      self: 'https://issues.org/browse/ISSUE-1',
      History: [],
      Priority: 'Major',
      Status: 'Resolved',
    },
    {
      id: 'issue-2',
      key: 'ISSUE-2',
      self: 'https://issues.org/browse/ISSUE-2',
      History: [],
      Priority: 'Major',
      Status: 'Unresolved',
    },
    {
      id: 'issue-3',
      key: 'ISSUE-3',
      self: 'https://issues.org/browse/ISSUE-3',
      History: [],
      Priority: 'Minor',
      Status: 'Done',
    },
    {
      id: 'issuesev-4',
      key: 'ISSUESEV-4',
      self: 'https://issues.org/browse/ISSUESEV-4',
      History: [],
      Severity: 'Minor',
      Status: 'Done',
    },
    {
      id: 'issuesev-5',
      key: 'ISSUESEV-5',
      self: 'https://issues.org/browse/ISSUESEV-5',
      History: [],
      Severity: 'Urgent',
      Status: 'Resolved',
    },
    {
      id: 'issueprisev-5',
      key: 'ISSUEPRISEV-5',
      self: 'https://issues.org/browse/ISSUEPRISEV-5',
      History: [],
      Priority: 'Blocker',
      Severity: 'Urgent',
      Status: 'Obsolete',
    },
  ]

  return malformation(issueData)
}

import test from 'ava'
import { readFileSync } from 'jsonfile'
import * as path from 'path'
import JiraClient from '../../lib/jira/JiraClient'
import { Issue, extractValueFromField, extractValueFromString } from '../../lib/jira/Issue'

class MockedJiraClient extends JiraClient {

  transformation: object

  constructor(transformation?: object) {
    super({
      jira: {
        url: 'http://acme.com',
      }
    })
    this.transformation = transformation
  }

  async listFields() {
    const fieldDesc = readFileSync(path.join(__dirname, '../fixtures/jiraFields.json'))

    if (this.transformation && this.transformation instanceof Function) {
      return this.transformation(fieldDesc)
    }
    else {
      return fieldDesc
    }
  }
}

test('Describe fields', async t => {
  const fieldDesc = await new MockedJiraClient().describeFields()
  t.is(fieldDesc.filter(fd => fd[0] === 'Fix Version/s').length, 1, 'There is one field with name "Fix Version/s"')
})


test('Normalize issue status', t => {
  const extract = value => {
    return extractValueFromField({ schema: { type: 'status' } }, value)
  }
  const status = extract({ name: 'Resolved' })
  t.is(status, 'Resolved', 'Issue status is resolved')
})

test('Normalize link from history', t => {

  const extract = value => {
    return extractValueFromString({ schema: { type: 'issuelinks' } }, value)
  }

  let link = extract('This issue duplicates RHMAP-13021')
  t.is(link.key, 'RHMAP-13021', 'Extraction of key at the end')
  t.is(link.type, 'This issue duplicates', 'Extraction of type at the beginning')

  link = extract('AGPUSH-124 Related')
  t.is(link.key, 'AGPUSH-124', 'Extraction of key at the beginning')
  t.is(link.type, 'Related', 'Extraction of type at the end')

  link = extract('AGPUSH2-124 Duplicate')
  t.is(link.key, 'AGPUSH2-124', 'Extraction of key with the number in project name')
  t.is(link.type, 'Duplicate', 'Extraction of type at the end')

  link = extract('AGPUSH-123')
  t.is(link.key, 'AGPUSH-123', 'Extraction of key without type')
  t.is(link.type, '', 'Extraction on no type')

  link = extract('foobar type whatever no project')
  t.is(link.key, '', 'No key was extracted')
  t.is(link.type, 'foobar type whatever no project', 'Type is all the string')
})
import test from 'ava'
import { readFileSync } from 'jsonfile'
import * as path from 'path'
import { JiraClient } from '../../jira/JiraClient'
import { extractValueFromField, extractValueFromString, changeFieldSchemaType, FieldJson } from '../../jira/Issue'
import { parseISO, format } from 'date-fns'

class MockedJiraClient extends JiraClient {
  transformation?: any

  constructor(transformation?: any) {
    super({ url: 'http://acme.com' })
    this.transformation = transformation
  }

  async listFields() {
    const fieldDesc = readFileSync(path.join(__dirname, '../fixtures/jiraFields.json'))

    if (this.transformation && this.transformation instanceof Function) {
      return this.transformation(fieldDesc)
    } else {
      return fieldDesc
    }
  }
}

test('Describe fields', async (t) => {
  const fieldDesc = await new MockedJiraClient().describeFields()
  t.is(fieldDesc.filter((fd: string[]) => fd[0] === 'Fix Version/s').length, 1, 'There is one field with name "Fix Version/s"')
})

test('Normalize issue status', (t) => {
  const extract = (value: any) => {
    return extractValueFromField(changeFieldSchemaType(dummyFieldSchema, 'status'), value)
  }
  const status = extract({ name: 'Resolved' })
  t.is(status, 'Resolved', 'Issue status is resolved')
})

test('Normalize link from history', (t) => {
  const extract = (value: string) => {
    return <Record<string, string>>extractValueFromString(changeFieldSchemaType(dummyFieldSchema, 'issuelinks'), value)
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

test('Normalize worklog', (t) => {
  const extract = (value: any) => {
    return extractValueFromField(changeFieldSchemaType(dummyFieldSchema, 'array', 'worklog'), value)
  }

  let worklog = <Array<string>>extract({
    startAt: 0,
    maxResults: 20,
    total: 0,
    worklogs: [],
  })

  t.deepEqual(worklog, [], 'Worklog is empty')

  worklog = <Array<string>>extract({
    startAt: 0,
    maxResults: 20,
    total: 0,
    worklogs: ['something'],
  })

  t.is(worklog.length, 1, 'Worklog contains 1 item')
  t.is(worklog[0], 'something', 'Worklog was extracted')
})

test('Normalize array of strings - labels', (t) => {
  const extract = (value: any) => {
    return extractValueFromField(changeFieldSchemaType(dummyFieldSchema, 'array', 'string'), value)
  }

  let labels: string[] = <string[]>extract([])
  t.deepEqual(labels, [], 'No labels were defined')

  labels = <string[]>extract(['foo', 'bar'])
  t.is(labels.length, 2, 'Two labels vere defined')
  t.is(labels[0], 'foo', 'First label is "foo"')
  t.is(labels[1], 'bar', 'Secord label is "bar"')
})

test('Normalize Target End from history', (t) => {
  const extract = (value: string): string => {
    return <string>extractValueFromString(changeFieldSchemaType(dummyFieldSchema, 'date'), value)
  }

  const targetEnd = parseISO(extract('6/Oct/2020'))
  t.is(format(targetEnd, 'yyyy-LL-dd'), '2020-10-06')
})

test('Normalize Severity Option from history', (t) => {
  const extract = (value: string): string => {
    return <string>extractValueFromString(changeFieldSchemaType(dummyFieldSchema, 'option'), value)
  }

  const severity = extract(' \t<img alt="" src="/images/icons/priorities/major.svg" width="16" height="16"> Medium')
  t.is(severity, 'Medium')
})

test('Normalize Severity Option from field', (t) => {
  const extract = (value: any) => {
    return extractValueFromField(changeFieldSchemaType(dummyFieldSchema, 'option'), value)
  }

  const severity = extract({
    self: 'https://url/14280',
    value: ' \t<img alt="" src="/images/icons/priorities/major.svg" width="16" height="16"> Medium',
    id: '14280',
    disabled: false,
  })
  t.is(severity, 'Medium')
})

test('Normalize Parent Link from history', (t) => {
  const extract = (value: string, fieldName = 'Parent Link') => {
    return <string>extractValueFromString(
      {
        id: '1234567',
        name: fieldName,
        clauseNames: ['cf[1234567]'],
        schema: {
          type: 'any',
          items: 'string',
        },
      },
      value
    )
  }

  t.is(extract('AEROGEAR-123'), 'AEROGEAR-123')
  t.is(extract('AEROGEAR-123 My Parent'), 'AEROGEAR-123')
  t.is(extract(' AEROGEAR-123 My Parent'), ' AEROGEAR-123 My Parent')

  t.is(extract('AEROGEAR-123 My Parent', 'Different Field'), 'AEROGEAR-123 My Parent')
})

const dummyFieldSchema: FieldJson = {
  id: 'dummy',
  name: 'dummy',
  clauseNames: ['dummy'],
  schema: {
    type: 'dummy',
    items: 'string',
  },
}

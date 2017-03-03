'use strict'

const test = require('blue-tape')
const jsonfile = require('jsonfile')
const path = require('path')
const normalizer = require('../../lib/jira/normalizer')

test('Describe fields', t => {

  const fieldDesc = normalizer.describeFields(fieldsFixture())

  t.ok(fieldDesc.filter(fd => fd[0] === 'Fix Version/s').length === 1, 'There is one field with name "Fix Version/s"')
  t.end()
})

test('Normalize link from history', t => {

  const extract = value => {
    return normalizer.extractValueFromString({ schema: {type: 'issuelinks' }}, value)
  }

  let link = extract('This issue duplicates RHMAP-13021')
  t.ok(link.key === 'RHMAP-13021', 'Extraction of key at the end')
  t.ok(link.type === 'This issue duplicates', 'Extraction of type at the beginning')

  link = extract('AGPUSH-124 Related')
  t.ok(link.key === 'AGPUSH-124', 'Extraction of key at the beginning')
  t.ok(link.type === 'Related', 'Extraction of type at the end')

  link = extract('AGPUSH2-124 Duplicate')
  t.ok(link.key === 'AGPUSH2-124', 'Extraction of key with the number in project name')
  t.ok(link.type === 'Duplicate', 'Extraction of type at the end')

  link = extract('AGPUSH-123')
  t.ok(link.key === 'AGPUSH-123', 'Extraction of key without type')
  t.ok(link.type === '', 'Extraction on no type')

  link = extract('foobar type whatever no project')
  t.ok(link.key === '', 'No key was extracted')
  t.ok(link.type === 'foobar type whatever no project', 'Type is all the string')

  t.end()
})

const fieldsFixture = (transform) => {
  const fieldDesc = jsonfile.readFileSync(path.join(__dirname, '../fixtures/jiraFields.json'))

  if(transform && transform instanceof Function) {
    return transform(fieldDesc)
  }

  return fieldDesc
}

const issuesFixture = (transform) => {
  const issues = jsonfile.readFileSync(path.join(__dirname, '../fixtures/agpush200.json'))

  if(transfrom && transfrom instanceof Function) {
    return transform(issues)
  }

  return issues
}

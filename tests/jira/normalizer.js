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

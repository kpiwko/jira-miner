import test from 'ava'
import { composeJiraSchema } from '../../jira/JiraSchema'
import { schemaFixture } from '../fixtures/fixtures'

test('Compose Jira Schema', (t) => {
  let composition = composeJiraSchema('id', schemaFixture)
  t.is(composition.schemas.length, 1)

  composition = composeJiraSchema('id', schemaFixture, [schemaFixture])
  t.is(composition.schemas.length, 2)
})

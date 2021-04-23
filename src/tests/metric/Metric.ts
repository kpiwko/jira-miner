import test from 'ava'
import { Issue } from '../../jira/Issue'
import { flattenMapper, MetricResults, statusPriorityReducer, trendReducer } from '../../metric/Metric'
import { issuesFixture } from '../fixtures/fixtures'

const getValue = (results: MetricResults, key: string): number | undefined => {
  const value = results.values.find((m) => m.id === key)
  return value?.value
}

test('Status Priority Reducer', (t) => {
  const results = statusPriorityReducer()('2021-03-17', issuesFixture({}))
  t.is(getValue(results, 'Major'), 2)
  t.is(getValue(results, 'Minor'), 2)
  t.is(getValue(results, 'Urgent'), 1)
  t.is(getValue(results, 'Blocker'), 1)
  t.is(getValue(results, 'Resolved'), 2)
  t.is(getValue(results, 'Obsolete'), 1)
})

test('Trend Reducer', (t) => {
  const results = trendReducer('Arrival Trend')('2021-03-17', issuesFixture({}))
  t.is(getValue(results, 'Major'), 2)
  t.is(getValue(results, 'Minor'), 2)
  t.is(getValue(results, 'Urgent'), 1)
  t.is(getValue(results, 'Resolved'), 2)
  t.is(getValue(results, 'Obsolete'), 1)
  t.is(getValue(results, 'Arrival Trend'), 6)
})

test('Flatten Mapper', (t) => {
  const results = flattenMapper('Version', 'No Version')('2021-03-26', issuesFixture({}))
  t.is(results.length, 7)
  t.is(results.filter((i) => i['Version'] === 'V1').length, 2)
  t.is(results.filter((i) => i['Version'] === 'No Version').length, 1)

  const results2 = flattenMapper('SingleVersion', 'No Version')('2021-03-26', issuesFixture({}))
  t.is(results2.filter((i) => i['SingleVersion'] === 'No Version').length, 2)

  const results3 = flattenMapper('Whatever', 'Emptish', (i: Issue) => {
    return i['Severity'] ? ['Non-empty', `Len-${i['Severity'].length}`] : []
  })('2021-04-23', issuesFixture({}))

  t.is(results3.filter((i) => i['Whatever'] === 'Len-6').length, 2)
  t.is(results3.filter((i) => i['Whatever'] === 'Emptish').length, 3)
  t.is(results3.filter((i) => i['Whatever'] === 'Non-empty').length, 3)
})

import test from 'ava'
import { MetricResults, statusPriorityReducer, trendReducer } from '../../metric/Metric'
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
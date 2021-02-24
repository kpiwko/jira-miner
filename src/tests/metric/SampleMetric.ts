import test from 'ava'
import { some, isEmpty } from 'lodash'
import { flow, map, flatten, uniq } from 'lodash/fp'
import { Issue } from '../../jira/Issue'
import { ComposedJiraSchema, composeJiraSchema, JiraSchema } from '../../jira/JiraSchema'
import {
  fixVersionCompletedReducer,
  fixVersionReducer,
  Metric,
  MetricReport,
  statusPriorityReducer,
  flattenMapper,
  EMPTY_VERSION,
} from '../../metric/Metric'
import { intersects, lastDays } from '../../utils'
import { dbFixture, schemaFixture } from '../fixtures/fixtures'

const AG_SCHEMA = composeJiraSchema('aerogear', schemaFixture)

class SampleMetric extends Metric {
  constructor() {
    const schema: ComposedJiraSchema = AG_SCHEMA
    super({
      name: 'sample metric',
      description: 'sample metric description',
      filter: (date: string, issue: Issue) => {
        return some(schema.schemas, (s: JiraSchema) => {
          return (
            intersects(issue['Project'], s.project) &&
            intersects(issue['Issue Type'], s.bugsTypes) &&
            // optionally, filter by component as well
            (isEmpty(s.components) || intersects(issue['Component/s'], s.components))
          )
        })
      },
      reduce: statusPriorityReducer(),
    })
  }
}

type ModifiedReport = MetricReport & {
  keys: string[]
}

class ModifiedReportMetric extends Metric<ModifiedReport> {
  private keys: string[]
  constructor() {
    const schema = composeJiraSchema('aerogear', schemaFixture)
    super({
      name: 'modified report',
      description: 'modified report description',
      filter: (date: string, issue: Issue) => {
        return some(schema.schemas, (s: JiraSchema) => {
          return (
            intersects(issue['Project'], s.project) &&
            intersects(issue['Issue Type'], s.bugsTypes) &&
            // optionally, filter by component as well
            (isEmpty(s.components) || intersects(issue['Component/s'], s.components))
          )
        })
      },
      map: flattenMapper('Fix Version/s', EMPTY_VERSION),
      reduce: fixVersionReducer(),
    })
    this.keys = flow(
      map((s: JiraSchema) => s.priorities),
      flatten,
      uniq
    )(schema.schemas)
  }

  report(v: Partial<ModifiedReport>): ModifiedReport {
    return {
      ...super.report(v),
      keys: this.keys,
    } as ModifiedReport
  }
}

test('Compute sample metric and product a report', async (t) => {
  const collection = await dbFixture({})
  const sampleMetric = new SampleMetric()

  await sampleMetric.applyLastDays(collection, 2)
  let report = sampleMetric.report({})
  t.is(report.data.length, 2, 'There are two data entries for metrics')
  let dayData = report.data.filter((mr) => mr.date === lastDays(2)[1])
  t.is(dayData.length, 1, 'There is report for the last day')
  t.is(dayData[0].values?.filter((v) => v.id === 'total')?.[0]?.value, 21, 'There are 21 total issues for the last day')

  const oldDate = '2012-01-09'
  const snapshot = await collection.history(oldDate)
  sampleMetric.apply(snapshot, oldDate)
  report = sampleMetric.report({ name: 'override', metadata: [{ id: 'old-date', value: oldDate }] })
  t.is(report.data.length, 3, 'There are three data entries for metrics')
  t.is(report.metadata?.length, 1, 'Metadata were added to the report')
  t.is(report.name, 'override', 'Report name was overriden')
  dayData = report.data.filter((mr) => mr.date === oldDate)
  t.is(dayData.length, 1, `There is an report on ${oldDate}`)
  t.is(dayData[0].values?.filter((v) => v.id === 'total')?.[0]?.value, 1, `There were 1 total issues on ${oldDate}`)
})

test('Trigger alternative report reducers', async (t) => {
  const collection = await dbFixture({})
  const sampleMetric = new ModifiedReportMetric()

  const dates = ['2012-01-09', '2021-02-23']
  const snapshot = await collection.history(dates[0])
  sampleMetric.applyArray([snapshot, collection], dates, fixVersionCompletedReducer(AG_SCHEMA.schemas), ({ index, dates }) => {
    // for the last day, trigger alternative reducer and compute ratio of completed issues
    return index === dates.length - 1
  })
  const report = sampleMetric.report({})
  t.deepEqual(report.keys, AG_SCHEMA.schemas[0].priorities, 'Report contains keys with name of priorities')

  const firstDayReport = report.data.find((d) => d.date === dates[0])
  const lastDayReport = report.data.find((d) => d.date === dates[1])
  const slice1 = lastDayReport?.slices?.find((s) => s.name === '1.0.0.M2c')
  const slice2 = lastDayReport?.slices?.find((s) => s.name === '1.0.0.M1')
  t.assert(slice1?.metadata[0].value?.includes('AEROGEAR-104'), 'First slice includes AEROGEAR-104')
  t.assert(slice2?.metadata[0].value?.includes('AEROGEAR-104'), 'Second slice also includes AEROGEAR-104')
  t.is(
    firstDayReport?.values.find((v) => v.id === 'Completed'),
    undefined,
    'Completed key does not exist if alternative reducer is not used'
  )
  t.is(lastDayReport?.values.find((v) => v.id === 'Completed')?.value, 1, 'One bug is completed across all the versions')
})

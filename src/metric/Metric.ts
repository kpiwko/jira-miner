import { AssertionError } from 'assert'
import { HistoryCollection } from '../db/LocalJiraDB'
import { Issue } from '../jira/Issue'
import { isEmpty, roundToTwo, intersects, groupBy, countBy, lastDays, historySeries, asKey } from '../utils'
import { format } from 'date-fns'
import { URL } from 'url'
import { JiraSchema } from '../jira/JiraSchema'

export const EMPTY_VERSION = '--<empty>--'
export const ALL_VERSIONS = '--<all-versions>--'

export type KeyValue<T> = {
  id: string
  value: T
}

export type Metadata = KeyValue<string>
export type Value = KeyValue<number>

export type Slice = {
  name: string
  metadata: Metadata[]
  values: Value[]
}

export type MetricResults = {
  date: string
  metadata: Metadata[]
  values: Value[]
  slices?: Slice[]
}

export type MetricReport = {
  name: string
  title: string
  description: string
  key: string
  timestamp: string
  metadata?: Metadata[]
  data: MetricResults[]
}

export type MetricFilter = (date: string, issue: Issue) => boolean
export type MetricMap = (date: string, issues: Issue[]) => Issue[]
export type MetricReduce = (date: string, mapResult: Issue[], filterResult?: Issue[]) => MetricResults

export type MetricOptions = {
  name: string
  description: string
  filter: MetricFilter
  map?: MetricMap
  reduce?: MetricReduce
}

export type AltReduceTriggerData = {
  date: string
  index: number
  collection: HistoryCollection
  dates: string[]
}

export class Metric<R extends MetricReport = MetricReport> {
  name: string
  description: string
  filter: MetricFilter
  map: MetricMap
  reduce: MetricReduce
  data: MetricResults[]

  constructor({
    name,
    description,
    filter,
    map = (date: string, issues: Issue[]) => issues,
    reduce = statusPriorityReducer(),
  }: MetricOptions) {
    this.name = name
    this.description = description
    this.filter = filter
    this.map = map
    this.reduce = reduce
    this.data = []
  }

  public apply(collection: HistoryCollection, date: string, altReduce?: MetricReduce): void {
    const issues = collection.where(this.filter.bind(this, date))
    const values = this.map(date, issues)
    const reduce = altReduce ? altReduce : this.reduce

    const results = reduce(date, values, issues)
    this.data.push(results)
  }

  public applyArray(
    collections: Array<HistoryCollection>,
    dates: string[],
    altReduce?: MetricReduce,
    altReduceTrigger?: (data: AltReduceTriggerData) => boolean
  ): void {
    if (collections.length !== dates.length) {
      throw new AssertionError({
        message: `Expecting collections and dates arrays to have the same length`,
        actual: collections.length,
        expected: dates.length,
      })
    }

    dates.forEach((date, i) => {
      const localAltReduce =
        altReduceTrigger && altReduceTrigger({ date, index: i, collection: collections[i], dates }) ? altReduce : undefined
      this.apply(collections[i], date, localAltReduce)
    })
  }

  public async applyLastDays(
    collection: HistoryCollection,
    days: number,
    altReduce?: MetricReduce,
    altReduceTrigger?: (data: AltReduceTriggerData) => boolean
  ): Promise<void> {
    const timestamps = lastDays(days)
    const collections = await historySeries({ collection, timestamps })
    this.applyArray(collections, timestamps, altReduce, altReduceTrigger)
  }

  public report({ name, description, timestamp, key, title, ...otherProps }: Partial<R>): R {
    return {
      name: name ?? this.name,
      description: description ?? this.description,
      title: title ?? `Metric Report for ${this.name}`,
      timestamp: timestamp ?? format(new Date(), 'yyyy-LL-dd'),
      key: key ?? asKey(this.name),
      ...otherProps,
      data: this.data,
    } as R
  }
}

export const stringJQLRemap = (array: string[]): string => {
  return array.map((a) => '"' + a + '"').join(',')
}

export const link = (issues: any[]): Metadata[] => {
  if (isEmpty(issues)) {
    return []
  }
  const keys = issues.map((issue) => issue.key)
  const origin = new URL(issues[0]?.self)?.origin
  return [
    {
      id: 'link',
      value: `${origin}/issues/?jql=key%20IN%20%28${keys.join(',')}%29`,
    },
  ]
}

export const countByIntoValues = <T>(data: T[], pickBy: string | ((value: T) => string), idPrefix?: string): Value[] => {
  return Object.entries(countBy(data, pickBy)).map(([id, value]) => {
    return {
      id: idPrefix ? `${idPrefix}${id}` : id,
      value,
    }
  })
}

/**
 * Constructs a MetricMap function that picks up a property on an Issue and
 * duplicates the Issue for each value found in the property. If value of property is empty, replaces it with emptyElement value
 * @param property Property to be be used for Issue duplication
 * @param emptyElement Default value if no value is present
 */
export const flattenMapper = <T = string>(property: string, emptyElement: T): MetricMap => {
  return (date: string, issues: Issue[]): Issue[] => {
    return issues.reduce((acc: Issue[], issue: Issue) => {
      let spreadValues = issue[property]
      if (isEmpty(spreadValues)) {
        spreadValues = [emptyElement]
      } else if (!Array.isArray(spreadValues)) {
        spreadValues = [spreadValues]
      }
      spreadValues.forEach((v: T) => {
        // a shallow copy should be sufficient here
        const copy = { ...issue }
        copy[property] = v
        acc.push(copy)
      })
      return acc
    }, [] as Issue[])
  }
}

export const statusPriorityReducer = (): MetricReduce => {
  return (date: string, mapResult: any[]): MetricResults => {
    return {
      date,
      metadata: [...link(mapResult)],
      values: [
        ...countByIntoValues(mapResult, 'Status'),
        ...countByIntoValues(mapResult, (i) => i['Priority'] ?? i['Severity']),
        {
          id: 'total',
          value: mapResult.length,
        },
      ],
    }
  }
}

export const trendReducer = (trend: string): MetricReduce => {
  return (date: string, mapResult: any[]): MetricResults => {
    return {
      date,
      metadata: [...link(mapResult)],
      values: [
        ...countByIntoValues(mapResult, 'Status'),
        ...countByIntoValues(mapResult, (i) => i['Priority'] ?? i['Severity']),
        {
          id: trend,
          value: mapResult.length,
        },
      ],
    }
  }
}

export const fixVersionReducer = (): MetricReduce => {
  return (date: string, mapResult: any[], filterResult?: Issue[]): MetricResults => {
    const byVersion = Object.entries(groupBy(mapResult, 'Fix Version/s')).map(
      ([fixVersion, collection]): Slice => {
        return {
          name: fixVersion,
          metadata: [...link(collection)],
          values: [
            {
              id: 'total',
              value: collection.length,
            },
          ],
        }
      }
    )

    return {
      date,
      metadata: [...link(mapResult)],
      values: [
        {
          id: 'total',
          value: filterResult?.length ?? 0,
        },
      ],
      slices: [
        {
          name: ALL_VERSIONS,
          metadata: [...link(mapResult)],
          values: [
            {
              id: 'total',
              value: filterResult?.length ?? 0,
            },
          ],
        },
        ...byVersion,
      ],
    }
  }
}

export const fixVersionCompletedReducer = (schemas: JiraSchema[]): MetricReduce => {
  return (date: string, mapResult: any[], filterResult?: Issue[]): MetricResults => {
    const isCompleted = (issue: Partial<Issue>): boolean => {
      return schemas.some((s) => {
        return intersects(issue['Project'], s.project) && intersects(issue['Status'], s.completeStates)
      })
    }

    const completedAll = filterResult?.filter(isCompleted) ?? []
    const byVersion = Object.entries(groupBy(mapResult, 'Fix Version/s')).map(
      ([version, collection]): Slice => {
        const total = collection.length
        const completed = collection.filter(isCompleted).length

        return {
          name: version,
          metadata: [...link(collection)],
          values: [
            { id: 'total', value: total },
            { id: 'Completed', value: completed },
            { id: 'ratio', value: roundToTwo((completed / total) * 100) },
          ],
        }
      }
    )

    const total = filterResult?.length ?? 0
    const completed = completedAll.length

    return {
      date,
      metadata: [...link(mapResult)],
      values: [
        { id: 'total', value: total },
        { id: 'Completed', value: completed },
        { id: 'ratio', value: roundToTwo((completed / total) * 100) },
      ],
      slices: [
        {
          name: ALL_VERSIONS,
          metadata: [...link(mapResult)],
          values: [
            { id: 'total', value: total },
            { id: 'Completed', value: completed },
            { id: 'ratio', value: roundToTwo((completed / total) * 100) },
          ],
        },
        ...byVersion,
      ],
    }
  }
}

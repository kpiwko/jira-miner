import { subDays, addDays, format, parseISO, parse as dateFnsParse, isValid, formatISO, parse } from 'date-fns'
import { flow, compact, map } from 'lodash/fp'
import pLimit from 'p-limit'
import { HistoryCollection } from './db/LocalJiraDB'
import { FieldJson } from './jira/Issue'
import Logger from './logger'

export const intersects = (arr1: string | string[], arr2?: string | string[]): boolean => {
  const toArray = (a?: string | string[]): string[] => {
    return flow(
      compact,
      map((v: string) => v.toLowerCase())
    )(Array.isArray(a) ? a : [a])
  }

  const array1 = toArray(arr1)
  const array2 = toArray(arr2)

  return array1.filter((item) => array2.includes(item)).length > 0
}

export const sumByKeys = (object: Record<string, number | string>, keys?: string[]): number => {
  keys = keys ?? Object.keys(object)
  return keys.reduce((acc, key) => {
    const value = object[key]
    if (value !== undefined && typeof value === 'number') {
      return acc + value
    } else if (value !== undefined && typeof value === 'string') {
      return acc + Number.parseFloat(value)
    }
    return acc
  }, 0)
}

export const maxInKeys = (object: Record<string, number | string>, keys?: string[]): number => {
  keys = keys ?? Object.keys(object)
  return keys.reduce((acc, key) => {
    const value = object[key]
    if (value !== undefined && typeof value === 'number') {
      return value > acc ? value : acc
    } else if (value !== undefined && typeof value === 'string') {
      const n = Number.parseFloat(value)
      return n > acc ? n : acc
    }
    return acc
  }, 0)
}

export const lastDays = (count = 60): string[] => {
  const before = subDays(new Date(), count)

  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    dates.push(format(addDays(before, i), 'yyyy-LL-dd'))
  }
  return dates
}

export const historySeries = async ({
  collection,
  timestamps,
  logger = new Logger(),
}: {
  collection: HistoryCollection
  timestamps: string[]
  logger?: Logger
}): Promise<Array<HistoryCollection>> => {
  const limit = pLimit(1)
  const requests = timestamps.map(async (m: string) => {
    return await limit(async () => {
      const dayEnd = formatISO(parse(`${m} 23:59:59+00:00`, 'yyyy-LL-dd HH:mm:ssXXXXX', new Date()))
      const c = await collection.history(dayEnd)
      logger.info(`Reconstructing historical JIRA db state at ${dayEnd}`)
      return c
    })
  })

  return Promise.all(requests)
}

export const isSchemaTyped = (fieldSchema: FieldJson, logger?: Logger): boolean => {
  const type = fieldSchema?.schema?.type ?? ''
  if (type === '') {
    if (intersects(['issuekey', 'thumbnail'], fieldSchema.id)) {
      // this is expected, not to produce log message
      return false
    }

    if (logger) {
      logger.warn(`Unknown field schema ${JSON.stringify(fieldSchema, null, 2)}, passing original value as is`)
    }
    return false
  }
  return true
}

const additionalDateFormats = ['d/LLL/yy', 'd/LLL/yyyy']
const ref = new Date(2020, 0, 1)
export const parseTimeValue = (d: string): Date => {
  let date = parseISO(d)
  if (isValid(date)) {
    return date
  }

  for (const format of additionalDateFormats) {
    date = dateFnsParse(d, format, ref)
    if (isValid(date)) {
      break
    }
  }

  if (!isValid(date)) {
    throw Error(`invalid date: ${d}`)
  }

  return date
}

export const asKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/gi, '-')

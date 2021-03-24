import { subDays, addDays, format, parseISO, parse as dateFnsParse, isValid, formatISO, parse } from 'date-fns'
import pLimit from 'p-limit'
import { HistoryCollection } from './db/LocalJiraDB'
import { FieldJson } from './jira/Issue'
import Logger from './logger'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isEmpty = (object: any): boolean => {
  // https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore#_isempty
  return [Object, Array].includes((object ?? {}).constructor) && !Object.entries(object ?? {}).length
}

export const roundToTwo = (num: number): number => {
  return Math.round(num * 100 + Number.EPSILON) / 100
}

/**
 * Checks whether there is any intersection in between two array of strings
 * @param array1 The first array of strings or a string
 * @param array2 The second array of strings or a string
 * @returns `true` if there is at least a on string in both arrays that, comparing coverted to lower case and
 * and converting falsey values to ''
 */
export const intersects = (array1: string | string[], array2?: string | string[]): boolean => {
  const arr1 = ((Array.isArray(array1) ? array1 : [array1]) ?? []).filter(Boolean).map((v) => v.toLowerCase())
  const arr2 = (((Array.isArray(array2) ? array2 : [array2]) ?? []).filter(Boolean) as string[]).map((v) => v.toLowerCase())

  return arr1.filter((item) => arr2.includes(item)).length > 0
}

/**
 * Checks whether there is any intersection in between two array of strings.
 * In case the second array is empty/null/undefined, returns true
 * @param array1 The first array of strings or a string
 * @param array2 The second array of strings or a string
 * @returns `true` if there is at least a on string in both arrays that, comparing coverted to lower case and
 * and converting falsey values to '' or if the second array is falsey
 */
export const intersectsIfNotEmpty = (array1: string | string[], array2?: string | string[]): boolean => {
  return isEmpty(array2) || intersects(array1, array2)
}

export const groupBy = <T>(array: T[], pickBy: string | ((value: T) => string)): Record<string, T[]> => {
  return array.reduce((acc: any, value: T) => {
    const key = typeof pickBy === 'string' ? value?.[pickBy] : pickBy(value)
    ;(acc[key] || (acc[key] = [])).push(value)
    return acc
  }, {})
}

export const countBy = <T>(array: T[], pickBy: string | ((value: T) => string)): Record<string, number> => {
  return array.reduce((acc: any, value: T) => {
    const key = typeof pickBy === 'string' ? value?.[pickBy] : pickBy(value)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
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
      logger.info(`Reconstructed historical JIRA db state at ${dayEnd}`)
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

import moment from 'moment'
import { FieldJson } from './jira/Issue'
import Logger from './logger'

export const intersects = (arr1: string[], arr2: string | string[]): boolean => {
  if (arr2 === null) {
    return false
  }
  arr1 = (Array.isArray(arr1) ? arr1 : [arr1]).map((e) => e.toLowerCase())
  arr2 = (Array.isArray(arr2) ? arr2 : [arr2]).map((e) => e.toLowerCase())
  return arr1.filter((item) => arr2.includes(item)).length > 0
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
  const now = moment()
  let before = now.subtract(count, 'days')

  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    before = before.add(1, 'days')
    dates.push(before.format('YYYY-MM-DD'))
  }
  return dates
}

export function isSchemaTyped(fieldSchema: FieldJson, logger?: Logger): boolean {
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

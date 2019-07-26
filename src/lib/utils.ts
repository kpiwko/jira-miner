import * as moment from 'moment'

/**
 * Executes all promises in parallel and unifies the data to a single array.
 * Allows a transformation of result returned by each of the promise to a format/object
 * 
 * @param transform Function thats tranforms object T to object R
 * @param promises Promises that return object T
 * @returns an array of objects of type R
 */
export async function transformAll<T, R>(transform: (o: T) => R, promises: Promise<T>[]): Promise<R[]> {
  const results = await Promise.all(promises)
  return results.reduce((acc: R[], sublist: T) => {
    return acc.concat(transform(sublist))
  }, [])
}

export function intersects(arr1: string[], arr2: string | string[]): boolean {
  arr1 = (Array.isArray(arr1) ? arr1 : [arr1]).map(e => e.toLowerCase())
  arr2 = (Array.isArray(arr2) ? arr2 : [arr2]).map(e => e.toLowerCase())
  return arr1.filter(item => arr2.includes(item)).length > 0
}

export function sumByKeys(object: object, keys?: string[]): number {
  keys = keys || Object.keys(object)
  return keys.reduce((acc, key) => {
    return object[key] ? acc + object[key] : acc
  }, 0)
} 

export function lastDays(count = 60): string[] {
  const now = moment()
  let before = now.subtract(count, 'days')

  const dates = []
  for (let i = 0; i < count; i++) {
    before = before.add(1, 'days')
    dates.push(before.format('YYYY-MM-DD'))
  }
  return dates
}

export function isSchemaTyped(fieldSchema: any, logger?: any): boolean {

  if (!fieldSchema || !!!fieldSchema.schema || !fieldSchema.schema.type) {
    if (fieldSchema && (fieldSchema.id == 'issuekey' || fieldSchema.id === 'thumbnail')) {
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


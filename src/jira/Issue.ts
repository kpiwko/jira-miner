import { formatISO, compareAsc } from 'date-fns'
import striptags from 'striptags'
import { isSchemaTyped, parseTimeValue } from '../utils'

export type IssueJson = {
  id: string
  self: string
  key: string
  fields: Record<string, unknown>
  changelog?: {
    histories: Record<string, unknown>[]
  }
  [other: string]: unknown
}

export type FieldJson = {
  id: string
  name: string
  custom?: boolean
  orderable?: boolean
  navigable?: boolean
  searchable?: boolean
  clauseNames: string[]
  schema: {
    type: string
    system?: string
    items?: string
    custom?: string
    customId?: number
  }
}

export type FieldChange = {
  author: string
  change: string
  from: any | any[]
  to: any | any[]
}

export class Issue {
  id: string
  self: string
  key: string
  History: Record<string, any>;
  [key: string]: any

  // there are more fields but those are dynamic

  constructor(issue: IssueJson, fieldDefinitions: FieldJson[]) {
    this.History = {}

    // there three properties are present on any jira issue
    this.id = issue.id
    this.self = issue.self
    this.key = issue.key

    // normalize field values
    fieldDefinitions.forEach((fieldDefinition: FieldJson) => {
      // check if this jira has field with current id and replace it with field name
      if (issue?.fields[fieldDefinition.id] !== undefined) {
        const value: unknown = issue.fields[fieldDefinition.id]
        this[fieldDefinition.name] = extractValueFromField(fieldDefinition, value)
      }
      // parse and add history
      const [fieldName, value] = historySerie(issue, fieldDefinition)
      // add history for field in case any changes have been reported
      if (value?.length > 0) {
        this.History[fieldName] = value
      }
    })
  }
}

export const historyExtractor = (fieldDefinition: FieldJson, fieldChanges: any[], mapper: (value: any) => any): any => {
  return extractValueFromString(fieldDefinition, [...new Set(fieldChanges.map(mapper).filter(Boolean))].join(','))
}

export const historySerie = (issue: IssueJson, field: FieldJson): [string, any[]] => {
  const historyData = issue?.changelog?.histories ?? []
  let history = historyData.reduce((acc: FieldChange[], change: any) => {
    // find item in history that says the field has been changed
    const fieldChanges = change.items.filter((item: any) => {
      const itemFieldName = item.field.toLowerCase().replace(/\s/g, '')

      const names = field.clauseNames.map((name: string) => {
        return name.toLowerCase().replace(/\s/g, '')
      })

      names.push(field.name.toLowerCase().replace(/\s/g, ''))
      names.push(field.id.toLowerCase().replace(/\s/g, ''))

      return names.includes(itemFieldName)
    })

    if (fieldChanges.length === 1) {
      acc.push({
        author: change.author ? change.author.displayName : '',
        change: formatISO(parseTimeValue(change.created)),
        from: extractValueFromString(field, fieldChanges[0].fromString),
        to: extractValueFromString(field, fieldChanges[0].toString),
      })
    } else if (fieldChanges.length > 1) {
      acc.push({
        author: change.author ? change.author.displayName : '',
        change: formatISO(parseTimeValue(change.created)),
        from: historyExtractor(field, fieldChanges, (fc: any) => fc.fromString),
        to: historyExtractor(field, fieldChanges, (fc: any) => fc.toString),
      })
    }
    // if there were no changes, return acc unchanged
    return acc
  }, [] as FieldChange[])

  // sort changes
  history = history.sort((a: FieldChange, b: FieldChange) => {
    return compareAsc(parseTimeValue(a.change), parseTimeValue(b.change))
  })

  // push initial value from issue creation to the list of changes
  // ignore if only a subset of fields was queried, e.g. 'issue.fields.created' might be empty
  // if the time of the change is the same as jira creation date, skip adding initial value
  if (
    history.length > 0 &&
    issue.fields.created &&
    !(history.length === 1 && compareAsc(parseTimeValue(history[0].change), parseTimeValue(<string>issue.fields.created)) === 0)
  ) {
    history.unshift({
      author: issue.fields.creator ? (<Record<string, string>>issue.fields?.creator)?.displayName : '',
      change: formatISO(parseTimeValue((<Record<string, string>>issue.fields)?.created)),
      from: history[0].from,
      to: history[0].from,
    })
  }

  // return both field name and its history
  return [field.name, history]
}

export const changeFieldSchemaType = (fs: FieldJson, type?: string, items?: string): FieldJson => {
  return Object.assign({}, fs, {
    schema: {
      type: type ?? '',
      items: items,
    },
  } as Partial<FieldJson>)
}

export const extractValueFromField = (fieldSchema: FieldJson, value: unknown): unknown => {
  if (!isSchemaTyped(fieldSchema)) {
    return value
  }

  switch (fieldSchema.schema.type) {
    case 'user':
      return (<Record<string, string>>value)?.['displayName']
    case 'array':
      return value
        ? (() => {
            const toParse = <Record<string, number | string>>value
            if ('total' in toParse) {
              const valueType = fieldSchema.schema.items ?? ''
              value = toParse[valueType] ?? toParse[`${valueType}s`] ?? []
              if (!Array.isArray(value)) {
                console.warn(`Unable to parse value ${toParse} with schema ${fieldSchema}, returning empty array.`)
                return []
              }
            }
            return (<Array<number | string>>value).map((v: any) => {
              return extractValueFromField(changeFieldSchemaType(fieldSchema, fieldSchema.schema.items), v)
            })
          })()
        : []
    case 'datetime':
    case 'date':
      return value ? formatISO(parseTimeValue(<string>value)) : null
    case 'project':
    case 'priority':
    case 'status':
    case 'resolution':
    case 'issuetype':
    case 'component':
    case 'version':
      return (<Record<string, string>>value)?.['name']
    case 'comments-page':
      return value
        ? (() => {
            if (!(<Record<string, unknown>>value)?.['comments']) {
              return []
            } else {
              const comments =
                ((<Record<string, any>>value)?.['comments'] as Array<{
                  updateAuthor: string
                  updated: string
                  body: string
                }>) ?? []
              return comments.map((c) => {
                return {
                  lastAuthor: extractValueFromField(changeFieldSchemaType(fieldSchema, 'user'), c.updateAuthor),
                  lastUpdated: extractValueFromField(changeFieldSchemaType(fieldSchema, 'datetime'), c.updated),
                  content: c.body ? c.body : null,
                }
              })
            }
          })()
        : []
    case 'issuelinks':
      return value
        ? (() => {
            const v = <Record<string, unknown>>value
            // figure out what kind of issuelink we are processing
            let link: Record<string, string>
            if (!!!v.inwardIssue && !!!v.outwardIssue) {
              link = <Record<string, string>>value
            } else {
              link = <Record<string, string>>(v.inwardIssue ? v.inwardIssue : v.outwardIssue)
            }
            const type = (<Record<string, string>>v.type)?.name ?? null
            return link ? { key: link.key, type: type } : null
          })()
        : null
    case 'option':
      return value
        ? (() => {
            const v: string = (<Record<string, string>>value)?.['value']
            return v ? striptags(v).trim() : null
          })()
        : null
    default:
      return value ? value : null
  }
}

export const extractValueFromString = (fieldSchema: FieldJson, value: string): unknown => {
  if (!isSchemaTyped(fieldSchema)) {
    return value
  }

  switch (fieldSchema.schema.type) {
    case 'user':
      return value ? value : null
    case 'array':
      return value
        ? value.split(',').map((v: string) => {
            return extractValueFromString(changeFieldSchemaType(fieldSchema, fieldSchema.schema.items), v.trim())
          })
        : []
    case 'datetime':
    case 'date':
      return value ? formatISO(parseTimeValue(value)) : null
    case 'project':
    case 'priority':
    case 'status':
    case 'resolution':
    case 'issuetype':
    case 'component':
    case 'version':
      return value ? value : null
    case 'issuelinks':
      if (!value) {
        return null
      }
      const parsed = /^(.*?)([A-Z0-9]+-[0-9]+)(.*?)$/.exec(value)
      if (!parsed) {
        return {
          key: '',
          type: value,
        }
      }
      return {
        key: parsed[2],
        type: `${parsed[1]} ${parsed[3]}`.trim(),
      }
    case 'option':
      return value ? striptags(value).trim() : null
    case 'any':
      if (fieldSchema.name === 'Parent Link') {
        const parsed = /^([A-Z0-9]+-[0-9]+)(.*?)$/.exec(value ?? '')
        return parsed ? parsed[1] : value
      }
      return value ?? null
    default:
      return value ?? null
  }
}

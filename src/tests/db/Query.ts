import test from 'ava'
import { fixture } from './LocalJiraDB'
import Query from '../../db/Query'
import naturalCompare from 'string-natural-compare'

test('Query issues with Android in their summary', async t => {

  const collection = await fixture()
  const q = new Query(collection)

  const { result } = await q.query((col) => {
    return col.where(issue => {
      return issue['Summary'] && issue['Summary'].includes('Android')
    })
  })

  t.is(result.length, 3, 'There are 3 isuses with Android string in their summary')
})

test('Query with syntax issue shows broken error', async t => {

  const collection = await fixture()
  const q = new Query(collection)

  try {
    await q.query((col) => {
      return col.where(issue => {
        return issue['Summary'] && issue['Summary'].includes('Android')
      })
        .sort((a, b) => { return a.key.localCompare(b.key) })
        .map(issue => issue.key)
        .join(' ')
    })
  }
  catch (err) {
    t.assert(err.message && err.message.includes('localCompare'), 'localCompare typo is in exception message')
  }
})

test('Manual mapReduce operation on the query', async t => {

  const collection = await fixture()
  const q = new Query(collection)

  const { result } = await q.query((col) => {
    return col.where(issue => {
      return issue['Summary'] && issue['Summary'].includes('Android')
    })
      .sort((a, b) => { return naturalCompare(b.key, a.key, {caseInsensitive: true}) })
      .map(issue => issue.key)
      .join(' ')
  }, [])

  t.is(result, 'AEROGEAR-168 AEROGEAR-93 AEROGEAR-47', '3 issue keys are returned')
})

test('Loki.js mapReduce operation on the query', async t => {

  const collection = await fixture()
  const q = new Query(collection)

  const { result } = await q.query((col) => {
    return col.mapReduce(issue => issue.key, keys => {
      return keys.sort((a, b) => naturalCompare(b, a, {caseInsensitive: true}))
    })
  })

  t.is(result.length, 200, '200 issue keys are returned')
  t.is(result[0], 'AEROGEAR-202', 'The first key is AEROGEAR-202')
})

test('Async query function', async t => {
  const collection = await fixture()
  const q = new Query(collection)

  const { result } = await q.query((col) => {
    return Promise.resolve('test')
  })

  t.is(result, 'test', 'Query result has been asynchronously returned - test')
})

test('Async query function with async keyword', async t => {
  const collection = await fixture()
  const q = new Query(collection)

  const { result } = await q.query(async (col) => {
    return await new Promise(resolve => setTimeout(() => { resolve('test') }, 5))
  })

  t.is(result, 'test', 'Query result has been asynchronously returned - test')
})

test('Execute query from file', async t => {

  const collection = await fixture()
  const q = new Query(collection)

  const results = await q.query(require('../fixtures/epicStoryPointsPerLabel').query, {
    fixVersion: '1'
  })
  t.truthy(results, 'Query has been resolved')

})
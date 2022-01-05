import test from 'ava'
import tmp from 'tmp'
import { JiraDBFactory } from '../../db/LocalJiraDB'
import { IssueJson } from '../../jira/Issue'
import { format, parseISO } from 'date-fns'
import { JiraClient } from '../../jira/JiraClient'
import { dbFixture } from '../fixtures/fixtures'
import { unlinkSync } from 'fs'

test('Create collection from a JiraClient', async (t) => {
  const dbpath = tmp.tmpNameSync()
  const jiraClient = new JiraClient({ url: 'https://issues.apache.org/jira/' })
  const testDB = await JiraDBFactory.localInstance(dbpath)
  let collection = await testDB.populate(jiraClient, {
    query: 'key = AMQ-71',
  })

  t.is(collection.count(), 1, 'There is a single issue in the collection')
  let collections = testDB.listCollections()
  t.is(collections.length, 1, 'There is one collection created')
  t.is(collections[0].name, 'default', 'The collection is called default')
  testDB.removeCollection('default')
  collections = testDB.listCollections()
  t.is(collections.length, 0, 'The are no longer any collections')

  collection = await testDB.populate(jiraClient, { query: 'key = AMQ-71' }, 'sample')
  t.is(collection.count(), 1, 'There is a single issue in the collection')
  collections = testDB.listCollections()
  t.is(collections.length, 1, 'There is one collection created')
  t.is(collections[0].name, 'sample', 'The collection is called sample')
  testDB.saveDatabase()
})

test('Initialize empty db with collection', async (t) => {
  const dbpath = tmp.tmpNameSync()
  const db = await JiraDBFactory.localInstance(dbpath)
  const collection = db.getHistoryCollection('default')

  t.assert(collection, 'Test database with collection "default" has been created')
  await db.saveDatabase()
})

test('Query all agpush issues that contain Android in summary', async (t) => {
  const collection = await dbFixture({})
  const results = collection
    .chain()
    .find({ Summary: { $contains: 'Android' } })
    .simplesort('key')
    .data()
  t.assert(results, 'Some results have been returned')
  t.assert(results.length > 0, 'There are more results than 0')
})

test('Check history of issues', async (t) => {
  const collection = await dbFixture({})
  const results = collection
    .chain()
    .find({ Summary: { $contains: 'Android' } })
    .simplesort('key')
    .data()
  t.assert(results, 'Some results have been returned')
  t.assert(results.length > 0, 'There are more results than 0')
  results.forEach((issue) => {
    t.truthy(issue.History, `Issue ${issue.key} contains history`)
  })
})

test('Process history of issue with no author', async (t) => {
  const collection = await dbFixture({
    malformation: (issues: IssueJson[]) => {
      // remove author
      return issues.map((issue) => {
        issue.changelog?.histories?.forEach((history: any) => {
          delete history.author
        })
        return issue
      })
    },
  })

  const results = collection
    .chain()
    .find({ Summary: { $contains: 'Android' } })
    .data()
  t.assert(results.length > 0, 'More than 1 issue has been fetched')
  results.forEach((issue) => {
    t.truthy(issue.History['Component/s'], `Issue ${issue.key} contains history of Component`)
    t.truthy(issue.History['Component/s'].length > 0, `Issue ${issue.key} contains history of Component`)
    Object.keys(issue.History).forEach((key) => {
      issue.History[key].slice(1).forEach((change: any) => {
        t.falsy(change['author'], 'No author is associated with the history change beyond initial change')
      })
    })
  })
})

test('Process history of issue with comments', async (t) => {
  const collection = await dbFixture({ source: '../fixtures/issueWithComments.json' })
  let historyCollection = await collection.history('2016-11-29')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  let results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach((issue) => {
    t.is(issue.Comment.length, 6, `Issue ${issue.key} has exactly 6 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })

  // this operation is idempotent
  historyCollection = await collection.history('2016-11-30')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach((issue) => {
    t.is(issue.Comment.length, 8, `Issue ${issue.key} has exactly 8 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })

  historyCollection = await collection.history('2016-11-29')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')
  results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach((issue) => {
    t.is(issue.Comment.length, 6, `Issue ${issue.key} has exactly 6 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })

  historyCollection = await collection.history('2016-12-10')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')
  results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach((issue) => {
    t.is(issue.Status, 'Coding In Progress', `Issue ${issue.key} is coding in Progress`)
    t.deepEqual(issue['Fix Version/s'], ['ups-1.2.0'], `Issue ${issue.key} Fix Version is empty`)
  })

  historyCollection = await collection.history('2017-05-17')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')
  results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach((issue) => {
    t.is(issue.Status, 'Resolved', `Issue ${issue.key} is Resolved`)
    t.deepEqual(issue['Fix Version/s'], ['ups-1.2.0-beta.1'], `Issue ${issue.key} Fix Version is empty`)
  })
})

test('Process history of issue with date in future', async (t) => {
  const collection = await dbFixture({ source: '../fixtures/issueWithComments.json' })
  const historyCollection = await collection.history('2038-11-29')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  const results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach((issue) => {
    t.is(issue.Comment.length, 12, `Issue ${issue.key} has exactly 12 comments`)
    t.is(issue.Resolution, 'Done', `Issue ${issue.key} is marked as Done`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
    t.deepEqual(issue['Fix Version/s'], ['ups-1.2.0-beta.1'], `Issue Fix Version is set to ups-1.2.0-beta.1`)
  })
})

/* test for https://github.com/kpiwko/jira-miner/issues/7 */
test('Process history of issue with comments without last date', async (t) => {
  const collection = await dbFixture({
    malformation: (issues: any[]) => {
      return issues.map((issue) => {
        if (issue.fields.comment && issue.fields.comment.comments) {
          issue.fields.comment.comments.forEach((comment: any) => {
            if (comment.id === '13328587') {
              delete comment.updated
            }
          })
        }
        return issue
      })
    },
    source: '../fixtures/issueWithComments.json',
  })
  const historyCollection = await collection.history('2016-11-29')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  const results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach((issue) => {
    t.is(issue.Comment.length, 5, `Issue ${issue.key} has exactly 5 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })
})

test('Process history of issue without any comments', async (t) => {
  const collection = await dbFixture({
    malformation: (issues: any[]) => {
      return issues.map((issue) => {
        if (issue.fields.comment && issue.fields.comment.comments) {
          delete issue.fields.comment.comments
        }
        return issue
      })
    },
    source: '../fixtures/issueWithComments.json',
  })
  const historyCollection = await collection.history('2016-11-30')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  const results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach((issue) => {
    t.is(issue.Comment.length, 0, `Issue ${issue.key} has exactly 0 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })
})

test('Process history of issue with target date', async (t) => {
  const collection = await dbFixture({ source: '../fixtures/issueWithTargetDate.json' })
  const historyCollection = await collection.history('2020-10-10')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  const results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach((issue) => {
    t.is(format(parseISO(issue['Target end']), 'yyyy-LL-dd'), '2020-02-04', `Issue ${issue.key} has Target end set for 2020-02-04`)
  })
})

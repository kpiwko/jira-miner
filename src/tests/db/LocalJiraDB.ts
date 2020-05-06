'use strict'

import test from 'ava'
import * as tmp from 'tmp'
import * as jsonfile from 'jsonfile'
import * as path from 'path'
import { JiraDBFactory, HistoryCollection } from '../../lib/db/LocalJiraDB'
import { Issue } from '../../lib/jira/Issue'

test('Initialize empty db with collection', async t => {
  const dbpath = tmp.fileSync();
  const collection = (await JiraDBFactory.localInstance(dbpath.name))
    .getHistoryCollection('default')

  t.assert(collection, 'Test database with collection "default" has been created')
})

test('Query all agpush issues that contain Android in summary', async t => {
  const collection = await fixture()
  const results = collection.chain().find({ 'Summary': { '$contains': 'Android' } }).simplesort('key').data()
  t.assert(results, 'Some results have been returned')
  t.assert(results.length > 0, 'There are more results than 0')
})

test('Check history of issues', async t => {

  const collection = await fixture()
  const results = collection.chain().find({ 'Summary': { '$contains': 'Android' } }).simplesort('key').data()
  t.assert(results, 'Some results have been returned')
  t.assert(results.length > 0, 'There are more results than 0')
  results.forEach(issue => {
    t.truthy(issue.History, `Issue ${issue.key} contains history`)
  })
})

test('Process history of issue with no author', async t => {

  const collection = await fixture(issues => {
    // remove author
    return issues.map(issue => {
      if (issue.changelog && issue.changelog.histories) {
        issue.changelog.histories.forEach(history => {
          delete history.author
        })
      }
      return issue
    })
  })

  const results = collection.chain().find({ 'Summary': { '$contains': 'Android' } }).data()
  t.assert(results.length > 0, 'More than 1 issue has been fetched')
  results.forEach(issue => {
    t.truthy(issue.History['Component/s'], `Issue ${issue.key} contains history of Component`)
    t.truthy(issue.History['Component/s'].length > 0, `Issue ${issue.key} contains history of Component`)
    Object.keys(issue.History).forEach(key => {
      issue.History[key].slice(1).forEach((change: object) => {
        t.falsy(change['author'], 'No author is associated with the history change beyond initial change')
      })
    })
  })
})

test('Process history of issue with comments', async t => {

  const collection = await fixture(null, '../fixtures/issue-with-comments.json')
  let historyCollection = await collection.history('2016-11-29')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  let results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach(issue => {
    t.is(issue.Comment.length, 6, `Issue ${issue.key} has exactly 6 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })

  // this operation is idempotent
  historyCollection = await collection.history('2016-11-30')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach(issue => {
    t.is(issue.Comment.length, 8, `Issue ${issue.key} has exactly 8 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })

  historyCollection = await collection.history('2016-11-29')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')
  results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach(issue => {
    t.is(issue.Comment.length, 6, `Issue ${issue.key} has exactly 6 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })

  historyCollection = await collection.history('2016-12-10')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')
  results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach(issue => {
    t.is(issue.Status, 'Coding In Progress', `Issue ${issue.key} is coding in Progress`)
    t.deepEqual(issue['Fix Version/s'], ['ups-1.2.0'], `Issue ${issue.key} Fix Version is empty`)
  })

  historyCollection = await collection.history('2017-05-17')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')
  results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach(issue => {
    t.is(issue.Status, 'Resolved', `Issue ${issue.key} is Resolved`)
    t.deepEqual(issue['Fix Version/s'], ['ups-1.2.0-beta.1'], `Issue ${issue.key} Fix Version is empty`)
  })

})

test('Process history of issue with date in future', async t => {

  const collection = await fixture(null, '../fixtures/issue-with-comments.json')
  let historyCollection = await collection.history('2038-11-29')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  let results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach(issue => {
    t.is(issue.Comment.length, 12, `Issue ${issue.key} has exactly 12 comments`)
    t.is(issue.Resolution, 'Done', `Issue ${issue.key} is marked as Done`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
    t.deepEqual(issue['Fix Version/s'], ['ups-1.2.0-beta.1'], `Issue Fix Version is set to ups-1.2.0-beta.1`)
  })
})

/* test for https://github.com/kpiwko/jira-miner/issues/7 */
test('Process history of issue with comments without last date', async t => {
  const collection = await fixture(issues => {
    return issues.map(issue => {
      if(issue.fields.comment && issue.fields.comment.comments) {
        issue.fields.comment.comments.forEach(comment => {
          if(comment.id === '13328587') {
            delete comment.updated
          }
        })
      }
      return issue
    })
  }, '../fixtures/issue-with-comments.json')
  let historyCollection = await collection.history('2016-11-29')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  let results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach(issue => {
    t.is(issue.Comment.length, 5, `Issue ${issue.key} has exactly 5 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })
})

test('Process history of issue without any comments', async t => {
  const collection = await fixture(issues => {
    return issues.map(issue => {
      if(issue.fields.comment && issue.fields.comment.comments) {
        delete issue.fields.comment.comments
      }
      return issue
    })
  }, '../fixtures/issue-with-comments.json')
  let historyCollection = await collection.history('2016-11-30')
  t.is(historyCollection.count(), 1, 'Just one issue in the collection')

  let results = historyCollection.where(() => true)
  t.assert(results, 'Some issues were resolved after history query')
  t.is(results.length, 1, 'Just 1 issue has been fetched')
  results.forEach(issue => {
    t.is(issue.Comment.length, 0, `Issue ${issue.key} has exactly 0 comments`)
    t.assert(issue.History['Fix Version/s'].length > 0, `Issue ${issue.key} contains history of Fix Version/s`)
  })
})


export async function fixture(malformation?: any, source = '../fixtures/aerogear200issues.json'): Promise<HistoryCollection<any>> {
  const dbpath = tmp.fileSync()
  const testDB = (await JiraDBFactory.localInstance(dbpath.name))

  let jiraData = jsonfile.readFileSync(path.join(__dirname, source))

  if (malformation) {
    jiraData = malformation(jiraData)
  }

  const jiraFields = jsonfile.readFileSync(path.join(__dirname, '../fixtures/jiraFields.json'))

  jiraData = jiraData.map((issue: any) => {
    return new Issue(issue, jiraFields)
  })

  return await testDB.populate('aerogear200issues', jiraData)
}
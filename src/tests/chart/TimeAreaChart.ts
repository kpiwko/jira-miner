import test from 'ava'
import * as fs from 'fs'
import * as cheerio from 'cheerio'
import TimeAreaChart, { TimeAreaChartItem } from '../../lib/chart/TimeAreaChart'

test('Render simple stacked area chart', async t => {

  const chart = new TimeAreaChart({
    name: 'Test No Links',
    axisNames: ['X', 'Y'],
    labels: ['Open', 'In Progress']
  })

  const chartRender = await chart.render(dataFixture())
  const $ = cheerio.load(chartRender.svg, { xmlMode: true })
  t.is($('a').length, 0, 'There are no links in the svg image')

  t.is(chartRender.json.name, 'Test No Links', 'Chart name is stored in json representation')
})

test('Render simple stacked area chart with links', async t => {

  const chart = new TimeAreaChart({
    name: 'Test Links',
    axisNames: ['X', 'Y'],
    labels: ['Open', 'In Progress']
  })

  const chartRender = await chart.render(dataFixture().map(d => {
    if (d['In Progress'] > 5) {
      d.link = 'https://foobar.com'
    }
    return d
  }))

  const $ = cheerio.load(chartRender.svg, { xmlMode: true })
  t.is($('a').length, 2, 'There are two links in the svg image')
  t.is(chartRender.json.labels.length, 2, 'Chart data labels are stored in json representation')
})

test('Render simple chart with trendline', async t => {

  const chart = new TimeAreaChart({
    name: 'Test Links',
    axisNames: ['X', 'Y', 'Y2'],
    labels: ['Open', 'In Progress'],
    trendLabels: ['Done']
  })

  const chartRender = await chart.render(dataFixture().map(d => {
    if (d['In Progress'] > 5) {
      d.link = 'https://foobar.com'
    }
    return d
  }))

  const $ = cheerio.load(chartRender.svg, { xmlMode: true })
  t.is($('a').length, 2, 'There are two links in the svg image')
  t.is($('.trendline').length, 1, 'There is one trendline in the svg image')
})

test('Render simple chart with two trendlines', async t => {

  const chart = new TimeAreaChart({
    name: 'Test Links',
    axisNames: ['X', 'Y', 'Y2'],
    labels: ['Open', 'In Progress'],
    trendLabels: ['Done', 'Abandoned']
  })

  const chartRender = await chart.render(dataFixture().map(d => {
    if (d['In Progress'] > 5) {
      d.link = 'https://foobar.com'
    }
    return d
  }))

  const $ = cheerio.load(chartRender.svg, { xmlMode: true })
  t.is($('a').length, 2, 'There are two links in the svg image')
  t.is($('.trendline').length, 2, 'There are two trendlines in the svg image')
})

function dataFixture(): TimeAreaChartItem[] {
  return [{
    date: '2019-06-09',
    'Open': 12,
    'In Progress': 7,
    'Done': 6,
    'Abandoned': 4
  }, {
    date: '2019-06-10',
    'Open': 12,
    'In Progress': 4,
    'Done': 6,
    'Abandoned': 5
  }, {
    date: '2019-06-11',
    'Open': 3,
    'In Progress': 6,
    'Done': 9,
    'Abandoned': 7
  }, {
    date: '2019-06-12',
    'Open': 3,
    'In Progress': 3,
    'Done': 7,
    'Abandoned': 9
  }]
}
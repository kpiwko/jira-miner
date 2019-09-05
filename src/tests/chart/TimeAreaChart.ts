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

function dataFixture(): TimeAreaChartItem[] {
  return [{
    date: '2019-06-09',
    'Open': 12,
    'In Progress': 7,
  }, {
    date: '2019-06-10',
    'Open': 12,
    'In Progress': 4
  }, {
    date: '2019-06-11',
    'Open': 3,
    'In Progress': 6,
  }]
}
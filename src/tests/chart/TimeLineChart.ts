import test from 'ava'
import * as fs from 'fs'
import * as cheerio from 'cheerio'
import TimeLineChart, { TimeLineChartItem } from '../../lib/chart/TimeLineChart'

test('Render simple chart without links', async t => {

  const chart = new TimeLineChart({
    name: 'Test No Links',
    axisNames: ['X', 'Y']
  })

  const chartRender = await chart.render(dataFixture())
  const $ = cheerio.load(chartRender.svg, { xmlMode: true })
  t.is($('a').length, 0, 'There are no links in the svg image')
})

test('Render simple chart with links', async t => {

  const chart = new TimeLineChart({
    name: 'Test Links',
    axisNames: ['X', 'Y']
  })

  const chartRender = await chart.render(dataFixture().map(d => {
    if (d.value > 5) {
      d.link = 'https://foobar.com'
    }
    return d
  }))

  const $ = cheerio.load(chartRender.svg, { xmlMode: true })
  t.is($('a').length, 2, 'There are two links in the svg image')
})

function dataFixture(): TimeLineChartItem[] {
  return [{
    date: '2019-06-09',
    value: 7,
  }, {
    date: '2019-06-10',
    value: 12,
  }, {
    date: '2019-06-11',
    value: 5
  }]
}
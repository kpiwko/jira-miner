import * as D3Node from 'd3-node'
import * as svg2png from 'svg2png'
import { sumByKeys } from '../utils';

export interface TimeAreaChartItem {
  [key:string]: number | string | object
  date: string
  link?: string
}

export interface AreaChartOptions {
  name: string
  axisNames: [string, string]
  labels: string[]
  styles?: string
  width?: number
  height?: number
  margin?: { top: number, right: number, bottom: number, left: number }
  lineWidth?: number
  lineColor?: string
  areaColors?: string[]
  tickSize?: number
  tickPadding?: number
}

export default class TimeLineChart {
  options: AreaChartOptions
  d3n: D3Node

  constructor(options: AreaChartOptions) {
    this.options = Object.assign({
      styles: `
        text.title {
          font: 50px 'Overpass',sans-serif;
          color: #000080;
        }
        text.label {
          font: 25px 'Overpass',sans-serif
        }
        .x-axis text {
          font: 20px 'Overpass',sans-serif
        }
        .y-axis text {
          font: 20px 'Overpass',sans-serif
        }
      `,
      width: 2100,
      height: 1000,
      margin: { top: 100, right: 260, bottom: 140, left: 80 },
      lineWidth: 3,
      lineColor: '#000080',
      // colorblind friendly palette
      areaColors: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6'],
      isCurve: false,
      tickSize: 5,
      tickPadding: 5
    }, options)

    // if there are more labels than colors, make sure that color palette is large enough by duplicating it
    if(this.options.areaColors.length < this.options.labels.length) {
      this.options.areaColors = [].concat(
        ...Array(Math.ceil(this.options.labels.length/this.options.areaColors.length))
        .fill(this.options.areaColors))
    }

    this.d3n = new D3Node({});
  }

  async render(data: TimeAreaChartItem[]) {
    const width = this.options.width - this.options.margin.left - this.options.margin.right
    const height = this.options.height - this.options.margin.top - this.options.margin.bottom
    const d3 = this.d3n.d3
    const keys = this.options.labels 
    const colors = this.options.areaColors 

    // sanitize data in case some values are missing
    data = data.map(d => {
      return Object.assign( 
        // provide default 0 value for every key in the list
      keys.reduce((object:any, key:string) => {
        object[key] = 0
        return object
      }, {}), d)
    })

    // create SVG image
    const svg = this.d3n.createSVG(this.options.width, this.options.height)

    // add styling
    svg.append('style').text(this.options.styles)

    // plot chart
    const image = svg.append('g')
      .attr('transform', `translate(${this.options.margin.left}, ${this.options.margin.top})`)

    // chart title
    image.append('g')
      .append('text')
      .attr('transform', `translate(${this.options.margin.left}, -${this.options.margin.top / 2})`)
      .attr('class', 'title')
      .text(this.options.name)

    // x-axis scale
    const parseTime = d3.timeParse('%Y-%m-%d');
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, (d: TimeAreaChartItem) => parseTime(d.date)))
      .rangeRound([0, width])

    const xAxis = d3.axisBottom(xScale)
      .tickSize(this.options.tickSize)
      .tickFormat(d3.timeFormat('%Y-%m-%d'))
      .tickPadding(this.options.tickPadding)
      .ticks(data.length <= 30 ? data.length : 30)

    // y-axis scale & definition
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, (d: TimeAreaChartItem) => {return sumByKeys(d, keys)})])
      .rangeRound([height, 0])

    const yAxis = d3.axisLeft(yScale)
      .tickSize(this.options.tickSize)
      .tickPadding(this.options.tickPadding)

    // color palette
    const colorScale = d3.scaleOrdinal()
      .domain(keys)
      .range(this.options.areaColors)

    //stack the data?
    const stackedData = d3.stack()
     .keys(keys)(data)

    // we want to show x-axis text oriented vertially
    const xAxisElement = image.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis)
    xAxisElement.selectAll('text')
      .attr('y', 0)
      .attr('x', 9)
      .attr('dy', '.35em')
      .attr('transform', `translate(0 ${this.options.margin.bottom}) rotate(270)`)
      .style('text-anchor', 'start');

    // text label for the x-axis
    image.append('text')
      .attr('transform', `translate(${width / 2} ${height + 20})`)
      .attr('class', 'label')
      .style('text-anchor', 'middle')
      .text(this.options.axisNames[0])

    image.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)

    // text label for the y-axis
    image.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - this.options.margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .attr('class', 'label')
      .style('text-anchor', 'middle')
      .text(this.options.axisNames[1])

    // actual data
    image
    .selectAll(".layers")
    .data(stackedData)
    .enter()
    .append("path")
      .style("fill", (d:any) => { return colorScale(d.key) })
      .attr("d", d3.area()
        .x((d:any) => { return xScale(parseTime(d.data.date)) })
        .y0((d:any) => { return yScale(d[0]) })
        .y1((d:any) => { return yScale(d[1]) })
    )

    // add circles with links to queries in case links are provided
    image.selectAll('.circle')
      .data(data.filter(d => d.link))
      .enter()
      .append('a')
      .attr('xlink:href', (d: TimeAreaChartItem) => d.link)
      .append('circle')
      .attr('class', 'circle-links')
      .attr('r', this.options.lineWidth * 5 / 3)
      .attr('cx', (d: TimeAreaChartItem) => xScale(parseTime(d.date)))
      .attr('cy', (d: TimeAreaChartItem) => yScale(sumByKeys(d, keys)))
      .attr('fill', this.options.lineColor)

    // add only circles without links if none are provided
    image.selectAll('.circle')
      .data(data.filter(d => !d.link))
      .enter()
      .append('circle')
      .attr('class', 'circle')
      .attr('r', this.options.lineWidth * 5 / 3)
      .attr('cx', (d: TimeAreaChartItem) => xScale(parseTime(d.date)))
      .attr('cy', (d: TimeAreaChartItem) => yScale(sumByKeys(d, keys)))
      .attr('fill', this.options.lineColor)
    
    // add legend
    const legend = svg.selectAll(".legend")
      .data(this.options.areaColors.slice(0, keys.length))
      .enter().append("g")
      .attr("class", "legend")
      .attr("transform", (d:any, i:number) => { return `translate(80, ${i*38+10})` })

    legend.append("rect")
      .attr("x", width + 20)
      .attr("width", 36)
      .attr("height", 36)
      .style("fill", (d:any, i:number) => {return colors[i] })

    legend.append("text")
      .attr("x", width + 66)
      .attr("y", 18)
      .attr("dy", ".35em")
      .style("text-anchor", "start")
      .attr('class', 'label')
      .text((d:any, i:number) => { return keys[i]})

    var svgBuffer = new Buffer(this.d3n.svgString(), 'utf-8')
    return {
      svg: svgBuffer,
      png: await svg2png(svgBuffer)
    }
  }


}
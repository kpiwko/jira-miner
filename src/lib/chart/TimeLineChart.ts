import * as D3Node from 'd3-node'
import * as svg2png from 'svg2png'

export interface TimeLineChartItem {
  date: string
  value: number
}

export interface LineChartOptions {
  name: string
  axisNames: [string, string]
  styles?: string
  width?: number
  height?: number
  margin?: { top: number, right: number, bottom: number, left: number }
  lineWidth?: number
  lineColor?: string
  tickSize?: number
  tickPadding?: number
}

export class TimeLineChart {
  options: LineChartOptions
  d3n: D3Node

  constructor(options: LineChartOptions) {
    this.options = Object.assign({
      styles: `
        text.title {
          font: 50px "Overpass",sans-serif;
          color: #000080;
        }
        text.label {
          font: 25px "Overpass",sans-serif
        }
        .x-axis text {
          font: 20px "Overpass",sans-serif
        }
        .y-axis text {
          font: 20px "Overpass",sans-serif
        }
      `,
      width: 1920,
      height: 1000,
      margin: { top: 100, right: 80, bottom: 140, left: 80 },
      lineWidth: 3,
      lineColor: '#000080',
      isCurve: false,
      tickSize: 5,
      tickPadding: 5
    }, options)

    this.d3n = new D3Node({});
  }

  async render(data: TimeLineChartItem[]) {
    const width = this.options.width - this.options.margin.left - this.options.margin.right
    const height = this.options.height - this.options.margin.top - this.options.margin.bottom
    const d3 = this.d3n.d3

    // create SVG image
    const svg = this.d3n.createSVG(this.options.width, this.options.height)

    // add styling
    svg.append("style").text(this.options.styles)

    // plot chart
    const image = svg.append('g')
      .attr('transform', `translate(${this.options.margin.left}, ${this.options.margin.top})`)

    // chart title
    image.append("g")
      .append("text")
      .attr('transform', `translate(${this.options.margin.left}, -${this.options.margin.top / 2})`)
      .attr('class', 'title')
      .text(this.options.name)

    // x-axis scale
    const parseTime = d3.timeParse("%Y-%m-%d");
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, (d: TimeLineChartItem) => parseTime(d.date)))
      .rangeRound([0, width])

    const xAxis = d3.axisBottom(xScale)
      .tickSize(this.options.tickSize)
      .tickFormat(d3.timeFormat('%Y-%m-%d'))
      .tickPadding(this.options.tickPadding)
      .ticks(data.length <= 30 ? data.length : 30)

    // y-axis scale & definition
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, (d: TimeLineChartItem) => d.value)])
      .rangeRound([height, 0]);

    const yAxis = d3.axisLeft(yScale)
      .tickSize(this.options.tickSize)
      .tickPadding(this.options.tickPadding)

    const lineChartFunction = d3.line(data)
      .x((d: TimeLineChartItem) => xScale(parseTime(d.date)))
      .y((d: TimeLineChartItem) => yScale(d.value))

    // we want to show x-axis text oriented vertially
    const xAxisElement = image.append('g')
      .attr("class", "x-axis")
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis)
    xAxisElement.selectAll("text")
      .attr("y", 0)
      .attr("x", 9)
      .attr("dy", ".35em")
      .attr("transform", `translate(0 ${this.options.margin.bottom}) rotate(270)`)
      .style("text-anchor", "start");

    // text label for the x-axis
    image.append("text")
      .attr("transform", `translate(${width / 2} ${height + 20})`)
      .attr("class", "label")
      .style("text-anchor", "middle")
      .text(this.options.axisNames[0])

    image.append('g')
      .attr("class", "y-axis")
      .call(yAxis)

    // text label for the y-axis
    image.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - this.options.margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .attr("class", "label")
      .style("text-anchor", "middle")
      .text(this.options.axisNames[1])

    // actual data
    image.append('path')
      .data([data])
      .attr("class", "line")
      .style("stroke", this.options.lineColor)
      .attr('stroke-width', this.options.lineWidth)
      .attr('fill', 'none')
      .attr("d", lineChartFunction)


    var svgBuffer = new Buffer(this.d3n.svgString(), 'utf-8')
    return await svg2png(svgBuffer)
  }
}
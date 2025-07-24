import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as d3 from 'd3';
import releaseData from '../../assets/releases.json'

interface TestResult {
  result: number;
  host: number;
}

interface Release {
  timestamp: number;
  version: string;
  tests: TestResult[];
}

@Component({
  selector: 'app-hello-d3',
  imports: [],
  templateUrl: './hello-d3.html',
  styleUrl: './hello-d3.css'
})
export class HelloD3 implements OnInit {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  //constructor() {}
  allReleases: Release[] = [];
  
  ngOnInit(): void {
    this.allReleases = releaseData as Release[];

    //const svg = d3.select(this.chartContainer.nativeElement)
    //  .append('svg')
    //  .attr('width', 800)
    //  .attr('height', 500);
    // Define margins for proper spacing
    const margin = { top: 80, right: 20, bottom: 40, left: 60 }; // Example margins
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(this.chartContainer.nativeElement)
      .append('svg')
      .attr('width', width + margin.left + margin.right) // Adjust SVG size for margins
      .attr('height', height + margin.top + margin.bottom)
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("z-index", 1)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`); // Translate entire chart group


    const body = d3.select(this.chartContainer.nativeElement)
      .append("div")
      .style('height', '500px')
      .style('margin-left', '60px')
      .style("overflow-x", "scroll")
      .style("-webkit-overflow-scrolling", "touch")

    const totalWidth = width * 10;
    const svgBody = body.append("svg")
      .attr("width", totalWidth)
      .attr("height", 500)
      .style("display", "block")
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`); // Translate entire chart group
    
    console.log(this.allReleases);
    const x = d3.scalePoint(this.allReleases.map((d) => d.version), [0,totalWidth]);
    
    const hosts: number[] = Array.from({ length: 10 }, (_, i) => i + 1);
    const hostsStr = hosts.map(h => h.toString())
    console.log(hostsStr)
    const y = d3.scalePoint(hostsStr, [400,0]);
    
    svgBody.append("g")
      .call(d3.axisTop(x))
      .selectAll("text")
      .style("text-anchor", "start")
      .attr("dx", "-3.5em")
      .attr("dy", "0.5em")
      .attr("transform", "rotate(65)");

    svg.append("g")
      .call(d3.axisLeft(y));


    svgBody.append('circle')
      .attr('cx', 100)
      .attr('cy', 100)
      .attr('r', 50)
      .attr('fill', 'steelblue');
  }

}

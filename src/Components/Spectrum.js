import React from 'react';
import { Line } from 'react-chartjs-2';

import { fft } from 'fft-js';

import { SerialDataObject } from '../Utils/SerialData';
import { colorList } from '../Resources/colorList.js';
import { reformatDataVec, nextPowerOf2 } from '../Utils/DataUtils.js';

import { hann } from "fft-windowing";


import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LogarithmicScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LogarithmicScale,
  Title,
  Tooltip,
  Legend
);
  
var fftUtil = require('fft-js').util;

// --------------------------------------------------------------------

var refreshRate = 150; // In ms


var padChars = 10; // How many characters to pad with

var gridColor = 'rgba(100,100,100,0.3)';
var plotFontColor = 'rgb(180,180,180)';
var axisColor = 'rgb(180,180,180)';

const divStyle = {
  width: '95%',
  margin: 'auto',
  flex: '1 1 auto'
};


// Creates the spectrum
function createSpectrum(xvec,yarray,yindex,sampleRate){

  // Create the vector of values
  var f = [];
  for(var k = 0; k < xvec.length; k++){
    if(isNaN(yarray[k][yindex])){
      yarray[k][yindex] = 0;
    }
    f.push(yarray[k][yindex]);
  }
 
  // Use the window
  var fwindowed = hann(f, 0.5);

  // Now padd with zeros so fft-js doesn't fail
  var Npadded = nextPowerOf2(fwindowed.length);
  for( var k = xvec.length; k < Npadded; k++ ){
    fwindowed.push(0);
  }
  
  // Take the fft of the values
  var fhat = fft(fwindowed);
  var freq = fftUtil.fftFreq(fhat, sampleRate);
  var mag = fftUtil.fftMag(fhat); 

  return reformatDataVec(freq,mag);
}
var data = {
  labels: [],
  datasets: [],
};

var defaultChartOptions = {
  animation: false,
  responsive: true,
  maintainAspectRatio: false,
  tension: 0.1,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        color: plotFontColor
      }
    },
    title: {
      display: false
    },
  },
  elements: {
    point:{
        radius: 0
    }
  },
  scales:{
      x: {
          type: 'linear',
          min: 0,
          max: 1,
          grid: {
            color: gridColor,
            borderColor: axisColor
          },
          ticks:{
            color: plotFontColor
          }
      },
      y: {
        type: 'logarithmic',
        min: 0.001,
        max: 1000,
        grid: {
          color: gridColor,
          borderColor: axisColor
        },
        ticks:{
          color: plotFontColor,
          format: {maximumSignificantDigits: 3 },
          callback: (val) => ( val.toString().padStart( padChars - val.toString().length, " ") )
        }
    }
  }
};


export default class Spectrum extends React.Component{
     
  constructor(props){
    super(props)
    // This chart reference is needed to update the charts
    this.divRef = React.createRef(); 
    this.chartRef = React.createRef(); 
  };

  
  updateChart(){
    
    if(this.chartRef !== null ){

      // Get the reference to the chart object
      var chart = this.chartRef.current;

      if(chart !== null )
      {

        if(SerialDataObject.data.length !== 0 && !SerialDataObject.pauseFlag){
          
          // Get the size of the data
          var nel = SerialDataObject.data.length;
          var nvars = SerialDataObject.data[nel-1].length;

          // Check if there are enough chart data objects
          var k = chart.data.datasets.length;
          while(chart.data.datasets.length < nvars ){
            // Add a new dataset if its too short
            chart.data.datasets.push(
              {
                label: (k+1) ,
                color: plotFontColor,
                data: [],
                borderColor: colorList[k % colorList.length],
                backgroundColor: colorList[k % colorList.length],
                borderWidth: 2,
              },
            )
            k = k + 1;
          }
          while(chart.data.datasets.length > nvars ){
            // If there are too many, remove the last one.
            chart.data.datasets.pop();
          }

          // Compute the sample rate
          var sampleRate = SerialDataObject.sampleRate;

          // Update with data from the serial port
          for(var k = 0; k < nvars; k++){
            chart.data.datasets[k].data = createSpectrum(SerialDataObject.dataIdx,SerialDataObject.data,k,sampleRate);   
          }

          // Pull the chart data range
          var xMax = Math.round(chart.data.datasets[0].data[chart.data.datasets[0].data.length-1].x);      
        }

        // Update options
        var newOps = defaultChartOptions;
        if(xMax !== undefined){
          newOps.scales.x.max = xMax;
        }
        newOps.plugins.title.text=SerialDataObject.port.friendlyName;
        chart.options = newOps;
  
        // Need to set the height by hand
        // (Flex doesn't work well for this)
        // To do so, update the size of the containing div
        // (ref: https://www.chartjs.org/docs/2.7.2/general/responsive.html#important-note)
        var parentHeight = this.divRef.current.parentElement.clientHeight;
        this.divRef.current.style.height = SerialDataObject.chartHeightRatio*parentHeight + 'px';
        this.divRef.current.style.marginTop =  SerialDataObject.chartMarginRatio*parentHeight + 'px';

        // Call the update
        chart.update();
      }
    }
  }

  timer = null;

  componentDidMount(){
    // This will refresh the chart as often as indiciated
    // in the variable refreshRate
    this.timer = setInterval(() => {
      this.updateChart();
    }, refreshRate); 
  }

  componentWillUnmount(){
    clearInterval(this.timer);
  }


  // Render the chart component (this only updates when the chart is created)
  render(){
    return(
      <div style={divStyle} ref={this.divRef}>
         <Line data={data} options={defaultChartOptions} ref={this.chartRef}/>
     </div>
    )
  }
}

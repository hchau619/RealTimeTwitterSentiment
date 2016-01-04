/* jshint browser: true, jquery: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, nonew: true, quotmark: double, strict: true, undef: true, unused: true */
$(document).ready(function () {
    "use strict";
    var keyword = "";
    var socket = io.connect("http://localhost:3000");

    //Use local time zone
    Highcharts.setOptions({
      global: { useUTC: false }
    });

    //Display donut chart
    var donut = new Highcharts.Chart({
      chart: {
        renderTo: "semiDonut",
        plotBackgroundColor: null,
        plotBorderWidth: null,
        plotShadow: false
      },
      title: {
        text: "SENTIMENT",
      },
      tooltip: {
        formatter: function() {
          return "<b>"+ this.point.name +"</b>: "+ this.percentage.toFixed(1) +" %";
        }
      },
      plotOptions: {
        pie: {
          allowPointSelect: false,
          cursor: "pointer",
          dataLabels: {
            enabled: true,
            color: "#000000",
            connectorColor: "#000000",
            formatter: function() {
              return "<b>"+ this.point.name +"</b>: "+ this.percentage.toFixed(1) +" %";
            }
          }
        }
      },
      series: [{ // Initial Filler data
        type: "pie",
        name: "Distribution",
        data: [
          ["Neutral", 0], 
          ["Positive", 5],
          ["Negative", 5]             
        ]
      }]
    });

    //Display dynamic line chart
    var lineChart = new Highcharts.Chart({
      chart: {
        renderTo: "lineChart",
        defaultSeriesType: "spline"
      },
      title: {
        text: "REAL TIME SENTIMENT SCORE"
      },
      xAxis: {
        type: "datetime",
        tickPixelInterval: 150,
        maxZoom: 20 * 1000
      },
      yAxis: {
        minPadding: 0.2,
        maxPadding: 0.2,
        title: {
          text: "SENTIMENT SCORE",
          margin: 80
        }
      },
      series: [{
        name: "SENTIMENT SCORE",
        data: []
      }]
    }); 

    //Listen for current state of app
    socket.on("stateChange", function(appState){
      keyword = appState.keyword;
      
      $("#status").html("<h3 class='text-warning'> MONITORING KEYWORD: \""+ keyword +"\"... </h3>");
      
      //If app is in use, show "stop" button. Else, show search bar.
      if(appState.inUse){
        $("#stop").show();
        $("#search").hide(); 
      }else{
        $("#stop").hide();
        $("#search").show();
      }
    });       

    //Handles keyword submission
    $("#searchForm").on("submit", function(evt) {
      evt.preventDefault();
      console.log("submitted");
      var keyword = $("#keyword").val();
      //Handles case when keyword is empty string.
      if(keyword === "" || keyword === null){
          return;
      }

      //Tells server about new keyword to track
      socket.emit("newKeyword", keyword);
      $("#status").html("<h3 class='text-warning'> MONITORING \""+ keyword +"\"... </h3>");
      $("#stop").show();
      $("#search").hide();
    });

    // Handles event when user stops analysis
    $("#stopForm").on("submit", function(evt) {
      evt.preventDefault();
      socket.emit("stopAnalysis", "dummy");
      $("#stop").hide();
      $("#search").show();
    });

    
    // Handles real-time data updates
    socket.on("data", function(data) {
      // Update pie chart
      donut.series[0].setData([
        ["Neutral",data.neu],   
        ["Positive",data.pos],
        ["Negative", data.neg]           
      ]);

      // Update line chart
      var shift = data.total > 200;
      var x = (new Date()).getTime();
      var y = data.currentScore;
      lineChart.series[0].addPoint( [x,y],true, shift);

      // Update current tweet
      $("#tweet").html(data.tweet);

      // Update statistics table
      $("#totalTweet").html(data.total);
      $("#positiveTweet").html(data.pos);
      $("#negativeTweet").html(data.neg);
      $("#neutralTweet").html(data.neu);
      var sentimentScore = (data.pos - data.neg) / (data.pos + data.neg);
      $("#sentimentScore").html(parseFloat(sentimentScore).toFixed(2));   
    });

    // Handles updates to Last 10 Analysis Table
    socket.on("newTopTen", function(analyses) {
      var title = "<h4 class='text-center'>LAST 10 SENTIMENT ANALYSIS</h4>";
      var table = title + "<table class='table table-condensed table-bordered'>";
      table = table + "<tr><td><b>KEYWORD</b></td><td><b>TOTAL TWEETS</b></td><td><b>SENTIMENT SCORE</b></td></tr>";
      for(var i = analyses.length-1; i >=  0; i--) {
        table = table + "<tr><td>" + analyses[i].keyword + "</td>";
        table = table + "<td>" + analyses[i].total + "</td>";
        table = table + "<td>" + analyses[i].score.toFixed(2) + "</td></tr>";
      }

      $("#recentSearch").html(table);
    });

});


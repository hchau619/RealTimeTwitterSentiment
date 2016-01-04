/*jshint node: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, nonew: true, quotmark: double, strict: true, undef: true, unused: true */
"use strict";

var express = require("express");
var app = require("express")();
var server = require("http").Server(app);
var path = require("path");
var Twitter = require("twitter");
var io = require("socket.io")(server);
var sentiment = require("sentiment");
var port = 3000;
var mongoose = require("mongoose");
var appState = { inUse: false, keyword : ""};
var twit = new Twitter({
	consumer_key: "MpexGqEOaiXzINTk6MjjLJDto",
	consumer_secret: "BSsXF0DSv8JLVklPbNlXPe96jaOVzKG08uo4PENKghmb1QyMz1",
	access_token_key: "3172708812-6WyVHiyyQCW2F4y1irkxCZpRS2cu1EgrJ2Lvi91",
	access_token_secret: "YGLVoWaXG2snGd6ki3OT6r9ti8q88zuZOGIKyY0VdZth3"
});
var result;

// Setup
app.set("views", path.join(__dirname, "/public/views"));
app.set("view engine", "jade");
app.use(express.static(path.join(__dirname, "/public")));

// Setup database
mongoose.connect("mongodb://localhost/sentiment", function(err){
  if(err){ console.log(err);}
});

// Define db schema
var AnalysisSchema = new mongoose.Schema({
		keyword: String,
		total: Number,
		pos: Number,
		neg: Number,
		neu: Number,
		date: { type: Date, default: Date.now },
		score: Number
	}, {
		capped: { size: 2048, max: 10, autoIndexId: true }
	}
);

// Define Topic model
var Analysis = mongoose.model("Topic", AnalysisSchema);

//Create server
server.listen(port, function(){
	console.log("Now listening on port: %s", port);
});

//Route handles get request to application
app.get("/", function(req,res){
	res.render("index");
});

function startAnalysis(keyword){
	//If topic is empty string, don't do anything.
	if(keyword === "" || keyword === null) return;

	//Update app state
	appState.inUse = true;
	appState.keyword = keyword;

	result = {
		total:0,
		pos:0,
		neg:0,
		neu: 0,
		currentScore: 0,
		tweet: ""
	};

	//Filter Twitter stream by keyword for tweets in English
	twit.stream("statuses/filter", {track: keyword, language:"en"}, function(stream) {
		twit.currentStream = stream;
		twit.currentKeyword = keyword;	

		stream.on("data", function(tweet) {
			try{
				//Sentiment analysis on current tweet
				var senti = sentiment(tweet.text);
				
				result.total++;
				result.currentScore = senti.score;
				result.tweet = tweet.text;

				//Update sentiment statistics
				if (senti.score === 0) {
					result.neu++;
				} 
				else if (senti.score < 0) {
					result.neg++;
				}
				else {
					result.pos++;
				}

				//Broadcast state and sentiment result
				io.emit("data", result);
				io.emit("stateChange", appState);
			}catch(err){
				console.log(err);
			}
		});
	});
}

function stopAnalysis(){
	//Stop current stream
	twit.currentStream.destroy();
	
	//Update app state
	appState.inUse = false;
	appState.keyword = "";
	io.emit("stateChange",appState);

	//Save results of current analysis
	var analysisResult = {
		keyword: twit.currentKeyword,
		total: result.total,
		pos: result.pos,
		neg: result.neg,
		neu: result.neu,
		score: (result.pos - result.neg) / (result.pos + result.neg)
	};

	var newAnalysis = new Analysis(analysisResult);
	newAnalysis.save(function (err, result) {
		//Error checking to make sure results are saved
		if (err !== null) {
			console.log(err);
		}
		else {
			//Find and broadcast last 10 analyses
			Analysis.find({}, function (err, analyses) {
				io.emit("newTopTen", analyses);
			});
		}
	});
}

// Listen for new connections
io.on("connection", function(socket){
	console.log("Socket connected: " + socket.conn.id);
	//Broadcast current state of application
	io.emit("stateChange", appState);

	//Listen for new keyword/topic search
	socket.on("newKeyword", startAnalysis);

	//Handles event when a user stop current analysis
	socket.on("stopAnalysis", stopAnalysis);

	//Find and broadcast last 10 analyses
	Analysis.find({}, function(error, analyses) {
		if(error){
			console.log(error);
		} else{
			io.emit("newTopTen", analyses);
		}
	});
});

module.exports = app;
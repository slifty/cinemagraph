/**
 * This plugin walks a user through the workflow of creating a cinemagraph using a browser and a device camera.
 */

;(function ( $, window, document, undefined ) {
	window.URL = window.URL || window.webkitURL;
	navigator.getUserMedia  =
		navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUserMedia ||
		navigator.msGetUserMedia;	
	
	window.requestAnimationFrame = 
		window.requestAnimationFrame || 
		window.webkitRequestAnimationFrame || 
		window.mozRequestAnimationFrame || 
		window.oRequestAnimationFrame || 
		window.msRequestAnimationFrame || 
		function(callback){};

	window.cancelAnimationFrame = 
		window.cancelAnimationFrame       || 
		window.webkitCancelAnimationFrame || 
		window.mozCancelAnimationFrame    || 
		window.oCancelAnimationFrame      || 
		window.msCancelAnimationFrame;

	var is_chrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
	var is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
	$(function() {
		if(is_firefox) $("body").addClass("cinemagraph-firefox");
		if(is_chrome) $("body").addClass("cinemagraph-chrome");
	});

	function Zone (mask, speed) {
		var self = this;
		self.mask = mask;
		self.speed = speed;
	}

	var ZONE_SPEED_FREEZE = 0;
	var ZONE_SPEED_SLOW = .5;
	var ZONE_SPEED_FAST = 2;

	var INTERFACE_CAMERA_INSTRUCTION = "camera_instruction";
	var INTERFACE_PROCESSING = "processing";
	var INTERFACE_RECORD = "record";
	var INTERFACE_EDIT = "edit";
	var INTERFACE_COMPLETE = "complete";

	// Create the defaults once
	var pluginName = "Cinemagraph",
		defaults = {
			height: 150,
			width: 200,
			fps: 16
		};

	// The actual plugin constructor
	function Plugin ( element, options ) {
		var self = this;
		self.interface = [];
		self.element = element;
		self.$element = $(element);
		self.settings = $.extend( {}, defaults, options );
		self._defaults = defaults;
		self._name = pluginName;
		self.init();
	}

	Plugin.prototype = {
		init: function () {
			// set everything up
			var self = this;

			// Core data
			self.recordedFrames = [];
			self.usedFrames = [];
			self.cinemaFrames = [];
			self.zones = [];
			self.fps = 16;
			
			self.$element.empty();
			self.$element.addClass("cinemagraph");

			// Video
			self.interface.$video = $("<video>")
				.addClass("camera")
				.height(self.settings.height)
				.width(self.settings.width)
				.hide()
			self.interface.video = self.interface.$video[0];
			self.interface.video.autoplay = true;
			self.interface.video.controls = false;
			self.interface.video.loop = false;

			// Images
			self.interface.$recordedGif = $("<img>")
				.hide()
			self.interface.recordedGif = self.interface.$recordedGif[0];

			self.interface.$cinemaGif = $("<img>")
				.hide()
			self.interface.cinemaGif = self.interface.$cinemaGif[0];


			// Canvases
			self.interface.$zoneCanvas = $("<canvas/>")
				.addClass("zoneCanvas")
				.hide()
			self.interface.zoneCanvas = self.interface.$zoneCanvas[0];
			self.interface.zoneCanvas.height = self.settings.height;
			self.interface.zoneCanvas.width = self.settings.width;
			
			// Set up Zone Canvas to be drawable (THIS WILL BE MADE CLEAN LATER)
			var ctx = self.interface.zoneCanvas.getContext('2d');
			// define a custom fillCircle method
			ctx.fillCircle = function(x, y, radius, fillColor) {
				this.fillStyle = fillColor;
				this.beginPath();
				this.moveTo(x, y);
				this.arc(x, y, radius, 0, Math.PI * 2, false);
				this.fill();
			};

			// bind mouse events
			self.interface.$zoneCanvas.bind('mousemove', function(e) {
				if (!self.interface.zoneCanvas.isDrawing) return;
				var parentOffset = $(this).parent().offset(); 
				var x = e.pageX - parentOffset.left;
				var y = e.pageY - parentOffset.top;
				var radius = 20; // or whatever
				var fillColor = '#000';
				ctx.fillCircle(x, y, radius, fillColor);
			});
			self.interface.$zoneCanvas.bind('mousedown', function(e) {
				self.interface.zoneCanvas.isDrawing = true;
			});
			self.interface.$zoneCanvas.bind('mouseup', function(e) {
				self.interface.zoneCanvas.isDrawing = false;
			});


			self.interface.$recordCanvas = $("<canvas/>")
				.hide()
			self.interface.recordCanvas = self.interface.$recordCanvas[0];
			self.interface.recordCanvas.height = self.settings.height;
			self.interface.recordCanvas.width = self.settings.width;


			// Recording Buttons
			self.interface.$startRecording = $("<div>")
				.addClass("button")
				.addClass("startRecording")
				.text("Start Recording")
				.click(function() {
					self.startRecording();
					self.interface.$startRecording.hide();
					self.interface.$stopRecording.show();
				})
				.hide()

			self.interface.$stopRecording = $("<div>")
				.addClass("button")
				.addClass("stopRecording")
				.text("Stop Recording")
				.click(function() {
					self.stopRecording();
					self.saveRecording();
				})
				.hide()

			self.interface.$saveRecording = $("<div>")
				.addClass("button")
				.addClass("saveRecording")
				.text("Looks Good")
				.click(function() {
					self.completeRecording();
				})
				.hide()

			self.interface.$resetRecording = $("<div>")
				.addClass("button")
				.addClass("resetRecording")
				.text("Start Over")
				.click(function() {
					self.changeInterface(INTERFACE_RECORD);
				})
				.hide()

			// Misc
			self.interface.$progressBar = $("<div>")
				.addClass("progress")
				.hide();
			self.interface.$completionBar = $("<div>")
				.addClass("complete")
				.appendTo(self.interface.$progressBar);

			// Interfaces
			self.interface.$enableCameraInterface = $("<div>")
				.addClass("enableCameraInterface")
				.append($("<h2>")
					.text("Please Enable your Camera"))
				.append($("<p>")
					.text("Your browser is asking you to enable the camera.  You need to allow use of your cameara to continue.  The image below shows you what you're looking for."))
				.append($("<div>")
					.addClass("image"))
				.hide()
				.appendTo(self.$element);

			self.interface.$recordInterface = $("<div>")
				.addClass("recordInterface")
				.append($("<h2>")
					.text("Record your Video"))
				.append(self.interface.$video)
				.append(self.interface.$recordCanvas)
				.append($("<p>")
					.text("The first thing you need to do is capture a video.  You'll turn this into a still image later."))
				.append(self.interface.$startRecording)
				.append(self.interface.$stopRecording)
				.hide()
				.appendTo(self.$element);

			self.interface.$processingInterface = $("<div>")
				.addClass("processingInterface")
				.append($("<h2>")
					.text("Processing..."))
				.append(self.interface.$progressBar)
				.hide()
				.appendTo(self.$element);

			self.interface.$editInterface = $("<div>")
				.addClass("editInterface")
				.append($("<h2>")
					.text("Lock your Video"))
				.append($("<div>")
					.addClass("editSpace")
					.height(self.settings.height)
					.width(self.settings.width)
					.append(self.interface.$recordedGif)
					.append(self.interface.$zoneCanvas))
				.append($("<p>")
					.text("Now pick which parts of your video you want to keep frozen. Draw on the video to lock the parts you cover up."))
				.append($("<div>")
					.addClass("navigation")
					.append(self.interface.$saveRecording)
					.append(self.interface.$resetRecording))
				.hide()
				.appendTo(self.$element);

			self.interface.$completeInterface = $("<div>")
				.addClass("completeInterface")
				.append($("<h2>")
					.text("You're done!"))
				.append(self.interface.$cinemaGif)
				.append($("<p>")
					.text("Behold your animated picture.  Eventually this will actually be saved somewhere, but for now you can look at how cool it is."))
				.hide()
				.appendTo(self.$element);

			// Start the show
			if (navigator.getUserMedia) {
				self.changeInterface(INTERFACE_CAMERA_INSTRUCTION);
				navigator.getUserMedia({audio: false, video: true}, function(stream) {
					self.cameraUrl = window.URL.createObjectURL(stream);
					self.changeInterface(INTERFACE_RECORD);
				}, function() {
					console.log("You have to give permission for video capture.");
				});
			} else {
				console.log("Your browser doesn't support video capture.");
			}
		},

		/**
		 * Swap out the interface
		 */
		changeInterface: function(target) {
			var self = this;
			self.interface.$enableCameraInterface.hide();
			self.interface.$recordInterface.hide();
			self.interface.$processingInterface.hide();
			self.interface.$editInterface.hide();

			switch(target) {
				case INTERFACE_CAMERA_INSTRUCTION:
					self.interface.$enableCameraInterface.show();
					break;
				case INTERFACE_RECORD:
					self.interface.video.src = self.cameraUrl;
					self.interface.$video.show();
					self.interface.$startRecording.show();
					self.interface.$stopRecording.hide();
					self.interface.$recordInterface.show();
					break;
				case INTERFACE_PROCESSING:
					self.interface.$processingInterface.show();
					break;
				case INTERFACE_EDIT:
					var context = self.interface.zoneCanvas.getContext('2d');
					context.clearRect (0, 0, self.settings.width, self.settings.height );
					self.interface.recordedGif.src = self.gifUrl;
					self.interface.$recordedGif.show();
					self.interface.$zoneCanvas.show();
					self.interface.$saveRecording.show();
					self.interface.$resetRecording.show();
					self.interface.$editInterface.show();
					break;
				case INTERFACE_COMPLETE:
					self.interface.$cinemaGif.show();
					self.interface.$completeInterface.show();
					break;
			}
		},


		/**
		 * Starts the recording
		 */
		startRecording: function () {
			// start the camera recording
			var self = this;
			var canvas = self.interface.recordCanvas;
			var ctx = canvas.getContext('2d');
			self.resetRecording();
			self.interface.$video.addClass("isRecording");

			function _saveFrame() {
				self.frameRequestId = requestAnimationFrame(_saveFrame);
				ctx.clearRect(0, 0, self.settings.width, self.settings.height);
				ctx.drawImage(self.interface.video, 0, 0, self.settings.width, self.settings.height);
				var imageData = ctx.getImageData(0, 0, self.settings.width, self.settings.height);
	            self.frames.push(imageData);
			};

			self.frameRequestId = requestAnimationFrame(_saveFrame);
			self.startTime = new Date().getTime();
		},

		/**
		 * Stops the recording
		 */
		stopRecording: function () {
			// stop the camera recording
			var self = this;
			cancelAnimationFrame(self.frameRequestId);
			self.stopTime = new Date().getTime();
			self.interface.$video.removeClass("isRecording");

		},

		/**
		 * Resets the record buffer
		 */
		resetRecording: function () {
			// clear the buffer
			var self = this;
			self.frames = [];
		},

		/**
		 * Takes the buffer and creates an accessible resource.
		 */
		saveRecording: function () {
			// take the buffer and create an accessible resource
			var self = this;

			// Change interface
			self.changeInterface(INTERFACE_PROCESSING);

			// Cut frames based on fps
			self.usedFrames = [];
			var targetFrameCount = (self.stopTime - self.startTime) / 1000 * self.fps;
			var increment = self.frames.length / targetFrameCount;
			var cursor = 0;

			while (self.usedFrames.length < targetFrameCount && self.usedFrames.length < self.frames.length) {
				self.usedFrames.push(self.frames[Math.floor(cursor)]);
				cursor += increment;
			}

			// Convert the frames to an animated gif
			var gifWorker = new Worker("js/lib/omggif-worker.js");

			gifWorker.addEventListener('message', function (e) {
				if (e.data.type === "progress") {
					console.log(e.data.data)
				} else if (e.data.type === "gif") {
					var blob = new Blob([e.data.data], {type: 'image/gif'});
					var url = window.URL.createObjectURL(blob);
					url = "data:image/gif;base64," + $.base64.encode(e.data.data);
					self.gifUrl = url;
					self.changeInterface(INTERFACE_EDIT);
				}
			}, false);

			gifWorker.addEventListener('error', function (e) {
				console.log(e);
				gifWorker.terminate();
			}, false);
			gifWorker.postMessage({
				frames: self.usedFrames,
				delay: 1/self.fps,
				matte: [255, 255, 255],
				transparent: [0, 255, 0]
			});
		},

		/**
		 * We're finished with the recording process
		 */
		completeRecording: function() {
			var self = this;

			// Change interface
			self.changeInterface(INTERFACE_PROCESSING);

			// Create an example mask
			var context = self.interface.zoneCanvas.getContext('2d');
			var imageData = context.getImageData(0, 0, self.settings.width, self.settings.height);
			var zone = new Zone(imageData, 0);
			self.zones.push(zone);

			// Loop through the zones
			self.cinemaFrames = self.usedFrames;
			for(var k in self.zones) {
				var zone = self.zones[k];

				// Loop through the frames
				for(var i in self.cinemaFrames) {
					var frame = self.cinemaFrames[i];
					// Loop through the pixels
					for(var j = 0; j < frame.data.length; j += 4) {
						if(zone.mask.data[j + 3] == 0)
							continue;
						frame.data[j] = self.cinemaFrames[0].data[j];
						frame.data[j + 1] = self.cinemaFrames[0].data[j + 1];
						frame.data[j + 2] = self.cinemaFrames[0].data[j + 2];
					}
					self.cinemaFrames[i] = frame;
				}
			}

			// Create the Gif
			var gifWorker = new Worker("js/lib/omggif-worker.js");

			gifWorker.addEventListener('message', function (e) {
				if (e.data.type === "progress") {
					console.log(e.data.data)
				} else if (e.data.type === "gif") {
					var blob = new Blob([e.data.data], {type: 'image/gif'});
					var url = window.URL.createObjectURL(blob);
					url = "data:image/gif;base64," + $.base64.encode(e.data.data);
					self.interface.cinemaGif.src = url;
					self.changeInterface(INTERFACE_COMPLETE);
				}
			}, false);

			gifWorker.addEventListener('error', function (e) {
				console.log(e);
				gifWorker.terminate();
			}, false);
			gifWorker.postMessage({
				frames: self.cinemaFrames,
				delay: 1/self.fps,
				matte: [255, 255, 255],
				transparent: [0, 255, 0]
			});
		},


		error: function(message) {
			var self = this;
			self.$element.append(message);
		},

	};

	// Prevent multiple instances
	$.fn[ pluginName ] = function ( options ) {
		return this.each(function() {
			if ( !$.data( this, "plugin_" + pluginName ) ) {
				$.data( this, "plugin_" + pluginName, new Plugin( this, options ) );
			}
		});
	};
})( jQuery, window, document );

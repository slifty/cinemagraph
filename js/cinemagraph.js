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

	function Zone (mask, speed) {
		var self = this;
		self.mask = mask;
		self.speed = speed;
	}

	var ZONE_SPEED_FREEZE = 0;
	var ZONE_SPEED_SLOW = .5;
	var ZONE_SPEED_FAST = 2;
	
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
			
			// Video
			self.interface.$video = $("<video>")
				.height(self.settings.height)
				.width(self.settings.width)
				.hide()
				.appendTo(self.$element);
			self.interface.video = self.interface.$video[0];
			self.interface.video.autoplay = true;
			self.interface.video.controls = false;
			self.interface.video.loop = false;

			// Images
			self.interface.$recordedGif = $("<img>")
				.appendTo(self.$element);
			self.interface.recordedGif = self.interface.$recordedGif[0];

			self.interface.$cinemaGif = $("<img>")
				.appendTo(self.$element);
			self.interface.cinemaGif = self.interface.$cinemaGif[0];

			// Canvases
			self.interface.$zoneCanvas = $("<canvas/>")
				.height(self.settings.height)
				.width(self.settings.width)
				.appendTo(self.$element);
			self.interface.zoneCanvas = self.interface.$zoneCanvas[0];

			self.interface.$recordCanvas = $("<canvas/>")
				.height(self.settings.height)
				.width(self.settings.width)
				.hide()
				.appendTo(self.$element);
			self.interface.recordCanvas = self.interface.$recordCanvas[0];


			// Recording Buttons
			self.interface.$startRecording = $("<div>")
				.text("Start Recording")
				.click(function() {
					self.startRecording();
				})
				.hide()
				.appendTo(self.$element);

			self.interface.$stopRecording = $("<div>")
				.text("Stop Recording")
				.click(function() {
					self.stopRecording();
					self.saveRecording();
				})
				.appendTo(self.$element);

			self.interface.$saveRecording = $("<div>")
				.text("Looks Good")
				.click(function() {
					self.completeRecording();
				})
				.appendTo(self.$element);

			self.interface.$resetRecording = $("<div>")
				.text("Try Again")
				.click(function() {
				})
				.appendTo(self.$element);



			// Start the show
			if (navigator.getUserMedia) {
				navigator.getUserMedia({audio: false, video: true}, function(stream) {
					self.cameraUrl = window.URL.createObjectURL(stream);
					self.interface.video.src = self.cameraUrl;
					self.viewCapture();
				}, function() {
					console.log("You have to give permission for video capture.");
				});
			} else {
				console.log("Your browser doesn't support video capture.");
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
					self.viewPreview();
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


			// Create an example mask
			var canvas = self.interface.zoneCanvas;
			var context = canvas.getContext('2d');
			context.beginPath();
			context.rect(130, 50, 100, 100);
			context.fillStyle = 'black';
			context.fill();
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



		/**
		 * Cleans up the interface to a blank slate
		 */
		viewReset: function() {
		},

		/**
		 * Sets up the interface to "capture mode"
		 */
		viewCapture: function() {
			var self = this;
			self.viewReset();
			self.interface.video.src = self.cameraUrl;
			self.interface.$video.show();
			self.interface.$startRecording.show();
		},

		/**
		 * Sets up the interface to "preview mode"
		 */
		viewPreview: function() {
			var self = this;
			self.viewReset();

			// Start the Video
			self.interface.recordedGif.src = self.gifUrl;
			self.interface.$recordedGif.show();
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

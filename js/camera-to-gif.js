/** 
 * This plugin provides an interface to capture video from a camera and turn it into a gif.
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

	// Create the defaults once
	var pluginName = "CameraToGif",
		defaults = {};

	// The actual plugin constructor
	function Plugin ( element, options ) {
		var self = this;
		self.interface = []
		self.element = element;
		self.$element = $(element);
		self.settings = $.extend( {}, defaults, options );
		self._defaults = defaults;
		self._name = pluginName;
		self.init();
	}

	Plugin.prototype = {
		init: function () {
			var self = this;
			self.$element.empty();

			// video
			self.$video = $("<video>")
				.hide()
				.appendTo(self.$element);
			self.video = self.$video[0];
			self.video.autoplay = true;
			self.video.controls = false;
			self.video.loop = false;

			// image
			self.$img = $("<img>")
				.hide()
				.appendTo(self.$element);
			self.img = self.$img[0];

			// recording
			self.frames = [];
			self.usedFrames = [];
			self.fps = 16;

			// Interface elements
			self.interface.$video = self.$video;
			self.interface.$img = self.$img;
			self.interface.$startRecording = $("<div>")
				.text("Start Recording")
				.click(function() {
					self.startRecording();
					self.interface.$startRecording.hide();
					self.interface.$stopRecording.show();
				})
				.hide()
				.appendTo(self.$element);

			self.interface.$stopRecording = $("<div>")
				.text("Stop Recording")
				.click(function() {
					self.stopRecording();
					self.interface.$stopRecording.hide();
					self.saveRecording();
				})
				.hide()
				.appendTo(self.$element);

			self.interface.$looksGood = $("<div>")
				.text("Looks Good")
				.click(function() {
					self.complete();
				})
				.hide()
				.appendTo(self.$element);

			self.interface.$tryAgain = $("<div>")
				.text("Try Again")
				.click(function() {
					self.capture();
					self.$startRecord.show();
				})
				.hide()
				.appendTo(self.$element);

			// Start the show
			if (navigator.getUserMedia) {
				navigator.getUserMedia({audio: false, video: true}, function(stream) {
					self.cameraUrl = window.URL.createObjectURL(stream);
					self.$video.attr("src", self.cameraUrl);
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
			var canvas = $("<canvas/>")
				.hide()
				.appendTo(self.$element)[0];
			canvas.width = self.$video.width();
			canvas.height = self.$video.height();
			var ctx = canvas.getContext('2d');
			self.resetRecording();

			function _saveFrame() {
				self.frameRequestId = requestAnimationFrame(_saveFrame);
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(self.video, 0, 0, canvas.width, canvas.height);
				var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
		 * Cleans up the interface to a blank slate
		 */
		viewReset: function() {
			var self = this;
			for(var i in self.interface)
				self.interface[i].hide();
		},

		/**
		 * Sets up the interface to "capture mode"
		 */
		viewCapture: function() {
			var self = this;
			self.viewReset();
			self.video.src = self.cameraUrl;
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
			self.img.src = self.gifUrl;
			self.$img.show();

			// Unlock the next step buttons
			self.interface.$looksGood.show();
			self.interface.$tryAgain.show();
		},

		error: function(message) {
			var self = this;
			self.$element.append(message);
		},

		/**
		 * Called when we're finished generating a gif.
		 *
		 * Triggers the callback that was set.
		 * 
		 */
		complete: function() {
			var self = this;
			self.settings.onComplete(self.usedFrames, self.gifUrl);
		}

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

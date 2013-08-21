/** 
 * This plugin provides an interface to capture video from a camera in a web environment.
 */

;(function ( $, window, document, undefined ) {
	window.URL = window.URL || window.webkitURL;
	navigator.getUserMedia  = navigator.getUserMedia || navigator.webkitGetUserMedia ||
	                          navigator.mozGetUserMedia || navigator.msGetUserMedia;	
	
	// Create the defaults once
	var pluginName = "CameraToVideo",
		defaults = {};

	// The actual plugin constructor
	function Plugin ( element, options ) {
		var self = this;
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

			// set up the video stream
			self.$element.empty();
			self.$video = $("<video>")
				.appendTo(self.$element);
			self.video = self.$video[0];
			self.frames = [];
			self.fps = 16;

			// Set up video controls
			self.$startRecord = $("<div>")
				.text("Start Record")
				.click(function() {
					self.startRecord();
					self.$startRecord.hide();
					self.$stopRecord.show();
				})
				.hide()
				.appendTo(self.$element);

			self.$stopRecord = $("<div>")
				.text("Stop Record")
				.click(function() {
					self.stopRecord();
					self.$stopRecord.hide();
				})
				.hide()
				.appendTo(self.$element);

			// Add navigation Buttons
			self.$looksGood = $("<div>")
				.text("Looks Good")
				.click(function() {
					self.complete();
				})
				.hide()
				.appendTo(self.$element);

			self.$tryAgain = $("<div>")
				.text("Try Again")
				.click(function() {
					self.capture();
					self.$startRecord.show();
				})
				.hide()
				.appendTo(self.$element);
			

			// Set up video file upload
			self.$videoUpload = $("<input>")
				.attr("type", "file")
				.attr("accept","video/*")
				.attr("capture","camera")
				.change(function() {
					var file = self.$videoUpload[0].files[0];
					var reader = new window.FileReader();
					reader.onload = function(e) {
						self.videoUrl = e.target.result;
						self.preview();
					};
					reader.readAsDataURL(file);
				})
				.hide()
				.appendTo(self.$element);


			if (navigator.getUserMedia) {
				navigator.getUserMedia({audio: false, video: true}, function(stream) {
					self.cameraUrl = window.URL.createObjectURL(stream);
					self.$video.attr("src", self.cameraUrl);
					self.$startRecord.show();
					self.capture();
				}, function() {
					self.$videoUpload.show();
				});
			} else {
				self.$videoUpload.show();
			}

		},
		startRecord: function () {
			// start the camera recording
			var self = this;
			var canvas = $("<canvas/>")[0];
			canvas.width = self.$video.width();
			canvas.height = self.$video.height();
			var ctx = canvas.getContext('2d');
			self.reset();
			self.capture();

			function _saveFrame() {
				self.frameRequestId = requestAnimationFrame(_saveFrame);
				ctx.drawImage(self.video, 0, 0, canvas.width, canvas.height);
				
				// Read back canvas as webp.
				var url = canvas.toDataURL('image/webp', 1); // image/jpeg is way faster :(
				self.frames.push(url);
			};

			self.frameRequestId = requestAnimationFrame(_saveFrame);
		},
		stopRecord: function () {
			// stop the camera recording
			var self = this;
			cancelAnimationFrame(self.frameRequestId);
			self.save();
		},
		trim: function () {
			// trim the recording
			var self = this;
		},
		reset: function () {
			// clear the buffer
			var self = this;
			self.frames = [];
		},
		save: function (){
			// take the buffer and create an accessible resource
			var self = this;
			var webmBlob = Whammy.fromImageArray(self.frames, self.fps);
			self.videoUrl = window.URL.createObjectURL(webmBlob);
			self.preview();
			window.
		},
		complete: function() {
			var self = this;
			self.onComplete(self.video);
		},
		capture: function() {
			var self = this;
			self.video.autoplay = true;
			self.video.controls = false;
			self.video.loop = false;
			self.video.src = self.cameraUrl;
		},
		preview: function() {
			var self = this;
			
			// Start the Video
			self.video.autoplay = true;
			self.video.controls = true;
			self.video.loop = true;
			self.video.src = self.videoUrl;

			// Unlock the next step buttons
			self.$looksGood.show();
			self.$tryAgain.show();
		},
		error: function(message) {
			var self = this;
			self.$element.append(message);
		},
		setFps: function(fps) {
			var self = this;
			self.fps = fps;
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

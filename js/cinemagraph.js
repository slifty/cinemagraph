/**
 * This plugin walks a user through the workflow of creating a cinemagraph using a browser and a device camera.
 */

;(function ( $, window, document, undefined ) {

	// We need touch events and mouse events to mean the same thing
	function touchHandler(event) {
	    var touch = event.changedTouches[0];

	    var simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent({
	        touchstart: "mousedown",
	        touchmove: "mousemove",
	        touchend: "mouseup"
	    }[event.type], true, true, window, 1,
	        touch.screenX, touch.screenY,
	        touch.clientX, touch.clientY, false,
	        false, false, false, 0, null);

	    touch.target.dispatchEvent(simulatedEvent);

	    if(event.type == "touchmove")
	    	event.preventDefault();
	}

	document.addEventListener("touchmove", touchHandler, true);
	document.addEventListener("touchend", touchHandler, true);
	document.addEventListener("touchstart", touchHandler, true);

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

	var INTERFACE_SELECT_SOURCE = "select_source";
	var INTERFACE_VIDEO_UPLOAD = "video_upload";
	var INTERFACE_CAMERA_INSTRUCTION = "camera_instruction";
	var INTERFACE_PROCESSING = "processing";
	var INTERFACE_RECORD = "record";
	var INTERFACE_EDIT = "edit";
	var INTERFACE_COMPLETE = "complete";
	var INTERFACE_SHARE = "share"
	var INTERFACE_WEBMAKER = "webmaker"

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

			self.data = [];
			self.data.cinemagif = "";
			
			self.$element.empty();
			self.$element.addClass("cinemagraph");

			// Video
			self.interface.$video = $("<video>")
				.addClass("camera")
				.hide()
			self.interface.video = self.interface.$video[0];
			self.interface.video.autoplay = true;
			self.interface.video.controls = false;
			self.interface.video.loop = false;

			self.interface.$videoFile = $("<video>")
				.addClass("file")
				.hide()
			self.interface.videoFile = self.interface.$videoFile[0];
			self.interface.videoFile.autoplay = true;
			self.interface.videoFile.controls = true;
			self.interface.videoFile.loop = true;

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
				var rad = ctx.createRadialGradient(x, y, 1, x, y, radius);
				rad.addColorStop(0, 'rgba(0,0,0,1)');
				rad.addColorStop(1, 'rgba(0,0,0,0)');
				this.fillStyle = rad;
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
				console.log("DOWN");
				self.interface.zoneCanvas.isDrawing = true;
			});
			self.interface.$zoneCanvas.bind('mouseup', function(e) {
				console.log("UP");
				self.interface.zoneCanvas.isDrawing = false;
			});


			self.interface.$recordCanvas = $("<canvas/>")
				.hide()
			self.interface.recordCanvas = self.interface.$recordCanvas[0];
			self.interface.recordCanvas.height = self.settings.height;
			self.interface.recordCanvas.width = self.settings.width;


			// Buttons
			self.interface.$fromFile = $("<div>")
				.addClass("button")
				.addClass("fromFile")
				.text("Use a File")
				.click(function() {
					self.changeInterface(INTERFACE_VIDEO_UPLOAD);
				})
				.hide();

			self.interface.$fromCamera = $("<div>")
				.addClass("button")
				.addClass("fromCamera")
				.text("Use a Camera")
				.click(function() {
					MediaStreamTrack.getSources(function(sourceInfos) {
						var audioSource = null;
						var videoSource = null;

						for (var i = 0; i != sourceInfos.length; ++i) {
							var sourceInfo = sourceInfos[i];
							if (sourceInfo.kind === 'video') {
								videoSource = sourceInfo.id;
							}
						}

						sourceSelected(videoSource);
					});

					function sourceSelected(videoSource) {
						var constraints = {
							video: {
								optional: [{sourceId: videoSource}]
							}
						};

						self.changeInterface(INTERFACE_CAMERA_INSTRUCTION);
						navigator.getUserMedia(constraints, 
							function(stream) {
								self.cameraUrl = window.URL.createObjectURL(stream);
								self.changeInterface(INTERFACE_RECORD);
							}, function() {
								console.log("You have to give permission for video capture.");
							}
						);
					}
				})
				.hide();

			self.interface.$startRecording = $("<div>")
				.addClass("button")
				.addClass("startRecording")
				.text("Start Recording")
				.click(function() {
					self.startRecording();
					self.interface.$startRecording.hide();
					self.interface.$stopRecording.show();
				})
				.hide();

			self.interface.$stopRecording = $("<div>")
				.addClass("button")
				.addClass("stopRecording")
				.text("Stop Recording")
				.click(function() {
					self.stopRecording();
					self.saveRecording();
				})
				.hide();

			self.interface.$saveRecording = $("<div>")
				.addClass("button")
				.addClass("saveRecording")
				.text("Looks Good")
				.click(function() {
					self.completeRecording();
				})
				.hide();

			self.interface.$resetRecording = $("<div>")
				.addClass("button")
				.addClass("resetRecording")
				.text("Start Over")
				.click(function() {
					self.changeInterface(INTERFACE_RECORD);
				})
				.hide();

			self.interface.$shareRecording = $("<div>")
				.addClass("button")
				.addClass("shareRecording")
				.text("Share Your Cinemagif")
				.click(function() {
					self.interface.$shareRecording.hide();
					self.shareRecording();
				})
				.hide();

			self.interface.$facebookShare = $("<div>")
				.addClass("share")
				.addClass("fb_share")
				.hide();

			self.interface.$twitterShare = $("<div>")
				.addClass("share")
				.addClass("twitter_share")
				.hide();

			// Misc
			self.interface.$progressBar = $("<div>")
				.addClass("progress")
				.hide();
			self.interface.$completionBar = $("<div>")
				.addClass("complete")
				.appendTo(self.interface.$progressBar);
			self.interface.$videoUpload = $("<input>")
				.attr("type", "file")
				.attr("accept","video/*")
				.attr("capture","camera")
				.change(function() {
					var file = self.interface.$videoUpload[0].files[0];
					var reader = new window.FileReader();
					reader.onload = function(e) {
						self.interface.$videoFile.show();
						self.interface.videoFile.src = e.target.result;
					};
					reader.readAsDataURL(file);
				})
				.hide();


			// Interfaces
			self.interface.$selectInputInterface = $("<div>")
				.addClass("selectInputInterface")
				.append($("<h2>")
					.text("Choose a Content Source"))
				.append($("<p>")
					.text("You can start with an existing video, or record a new one using a camera."))
				.append(self.interface.$fromFile)
				.append(self.interface.$fromCamera)
				.hide()
				.appendTo(self.$element);

			self.interface.$useVideoInterface = $("<div>")
				.addClass("useVideoInterface")
				.append($("<h2>")
					.text("Select a Video"))
				.append($("<p>")
					.text("Use this button to pick a video file from your hard drive."))
				.append(self.interface.$videoUpload)
				.append(self.interface.$videoFile)
				.hide()
				.appendTo(self.$element);

			self.interface.$enableCameraInterface = $("<div>")
				.addClass("enableCameraInterface")
				.append($("<h2>")
					.text("Please Enable your Camera"))
				.append($("<p>")
					.text("Your browser is asking you to enable the camera.  You need to allow use of your camera to continue.  The image below shows you what you're looking for."))
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
					.text("Behold your animated picture.  Do you want to be able to share it?"))
				.append(self.interface.$shareRecording)
				.hide()
				.appendTo(self.$element);

			self.interface.$shareInterface = $("<div>")
				.addClass("shareInterface")
				.append($("<h2>")
					.text("Ready to Share!"))
				.hide()
				.appendTo(self.$element);


			// Start the show
			if (navigator.getUserMedia) {
				self.changeInterface(INTERFACE_SELECT_SOURCE);
			} else {
				self.changeInterface(INTERFACE_VIDEO_UPLOAD);
				console.log("Your browser doesn't support video capture.");
			}
		},

		/**
		 * Swap out the interface
		 */
		changeInterface: function(target) {
			var self = this;
			self.interface.$enableCameraInterface.hide();
			self.interface.$useVideoInterface.hide();
			self.interface.$recordInterface.hide();
			self.interface.$processingInterface.hide();
			self.interface.$editInterface.hide();
			self.interface.$selectInputInterface.hide();

			switch(target) {
				case INTERFACE_SELECT_SOURCE:
					self.interface.$fromCamera.show();
					self.interface.$fromFile.show();
					self.interface.$selectInputInterface.show();
					break;
				case INTERFACE_VIDEO_UPLOAD:
					self.interface.$videoUpload.show();
					self.interface.$videoFile.hide();
					self.interface.$useVideoInterface.show();
					break;
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
					self.interface.$shareRecording.show();
					self.interface.$completeInterface.show();
					break;
				case INTERFACE_SHARE:
					self.interface.$facebookShare.show();
					self.interface.$twitterShare.show();
					self.interface.$shareInterface.show();
					break;
				case INTERFACE_WEBMAKER:
					self.interface.$makerInterface.show();
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
						var alpha = zone.mask.data[j + 3] / 255;
						frame.data[j] = alpha * self.cinemaFrames[0].data[j] + (1 - alpha) * frame.data[j];
						frame.data[j + 1] = alpha * self.cinemaFrames[0].data[j + 1] + (1 - alpha) * frame.data[j + 1];
						frame.data[j + 2] = alpha * self.cinemaFrames[0].data[j + 2] + (1 - alpha) * frame.data[j + 2];
					}
					self.cinemaFrames[i] = frame;
				}
			}

			// Create the Gif
			var gifWorker = new Worker("js/lib/omggif-worker.js");

			gifWorker.addEventListener('message', function (e) {
				if (e.data.type === "progress") {
				} else if (e.data.type === "gif") {
					var blob = new Blob([e.data.data], {type: 'image/gif'});
					var url = window.URL.createObjectURL(blob);
					self.data.cinemagif = $.base64.encode(e.data.data);
					url = "data:image/gif;base64," + self.data.cinemagif;
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

		shareRecording: function() {
			var self = this;
			$.ajax({
				'url': "api/save.php",
				'data': {
					img: self.data.cinemagif
				},
				'dataType': 'json',
				'success': function(data) {
					if('url' in data) {
						self.interface.$facebookShare.html("<a href='http://www.facebook.com/sharer.php?src=sp&u=" + encodeURI(data.url) + "' target='_blank'></a>")
						self.interface.$twitterShare.html("<a href='https://twitter.com/intent/tweet?text=Breaking%20News!&url=" + encodeURI(data.url) + "' target='_blank'></a>")
						self.changeInterface(INTERFACE_SHARE);
					} else {
						// Something went wrong
					}
				}
			);
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

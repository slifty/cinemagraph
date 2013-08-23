/**
 * This plugin provides an interface to take a video and specify a section to convert into a gif.
 */
;(function ( $, window, document, undefined ) {
	window.URL = window.URL || window.webkitURL;
	navigator.getUserMedia  = navigator.getUserMedia || navigator.webkitGetUserMedia ||
	                          navigator.mozGetUserMedia || navigator.msGetUserMedia;	
	
	// Create the defaults once
	var pluginName = "VideoToGif",
		defaults = {
		};

	// The actual plugin constructor
	function Plugin ( element, options ) {
		this.element = element;
		this.$element = $(element);
		this.settings = $.extend( {}, defaults, options );
		this._defaults = defaults;
		this._name = pluginName;
		this.init();
	}

	Plugin.prototype = {
		init: function () {
			// set everything up
			var self = this;
			self.$element.empty();

			// Create the video object
			self.$element.empty();
			self.$video = $("<video>")
				//.hide()
				.appendTo(self.$element);
			self.video = self.$video[0];
			self.frames = [];
			self.fps = 16;

			// Get started
			self.load();
		},
		load: function() {
			// load in a video file to work with
			var self = this;
			var canvas = $("<canvas/>")[0];
			canvas.width = self.$video.width();
			canvas.height = self.$video.height();
			var ctx = canvas.getContext('2d');

			function _saveFrame() {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(self.video, 0, 0, canvas.width, canvas.height);

				var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	            self.frames.push(imageData);
			};

			self.video.addEventListener('seeked', function() {
				if(self.video.ended) {
					console.log(self.frames);
					self.save();
					return;
				}
				_saveFrame();
				self.video.currentTime = self.video.currentTime + 1 / self.fps;
			})

			self.video.src = self.settings.videoUrl;
			self.video.addEventListener('canplay', function() {
				self.video.currentTime = 1 / self.fps;
			})
		},
		trim: function() {
			// trim the portion of the video to be converted
		},
		save: function() {
			// turns the video into a gif
			var self = this;
			
			var gifWorker = new Worker("js/lib/omggif-worker.js");

			gifWorker.addEventListener('message', function (e) {
				if (e.data.type === "progress") {
					console.log(e.data.data)
				} else if (e.data.type === "gif") {
					var blob = new Blob([e.data.data], {type: 'image/gif'});
					var url = window.URL.createObjectURL(blob);
					url = "data:image/gif;base64," + $.base64.encode(e.data.data);
					$("body").append("<img src='"+url+"'/>");
				}
			}, false);
			gifWorker.addEventListener('error', function (e) {
				console.log(e);
				gifWorker.terminate();
			}, false);

			gifWorker.postMessage({
				frames: self.frames,
				delay: 1,
				matte: [255, 255, 255],
				transparent: [0, 255, 0]
			});
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

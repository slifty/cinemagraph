/**
 * This plugin provides an interface to take an animated gif and "lock" certain sections of it.
 * The unlocked portion will change while the locked portion will play.
 */

;(function ( $, window, document, undefined ) {
	
	// Create the defaults once
	var pluginName = "GifToCinemagraph",
		defaults = {
		};

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

	function Zone (mask, speed) {
		var self = this;
		self.mask = mask;
		self.speed = speed;
	}

	var ZONE_SPEED_FREEZE = 0;
	var ZONE_SPEED_SLOW = .5;
	var ZONE_SPEED_FAST = 2;

	Plugin.prototype = {
		init: function () {
			var self = this;
			self.$element.empty();
			self.zones = [];
			self.frames = [];

			self.currentSpeed = ZONE_SPEED_FREEZE;

			// Set up interface
			self.interface.$original = $("<img/>")
				.attr("src", self.settings.gifUrl)
				.css("position","absolute")
				.css("top", "0px")
				.css("left", "0px")
				.appendTo(self.$element);

			self.interface.$preview = $("<img/>")
				.appendTo(self.$element);

			self.interface.$canvas = $("<canvas/>")
				.css("position","absolute")
				.css("top", "0px")
				.css("left", "0px")
				.height(480)
				.width(640)
				.appendTo(self.$element);
			self.interface.canvas = self.interface.$canvas[0];

			// Remove black from the frames (black will be transparent)
			for(var i in self.settings.frames) {
				var frame = self.settings.frames[i];

				// examine every pixel, 
				for (var j = 0; j < frame.data.length; j += 4) {
					if(frame.data[j] == 255 &&
					   frame.data[j + 1] == 255 &&
					   frame.data[j + 2] == 255) {
						imageData.data[j] = 254;
						imageData.data[j + 1] = 254;
						imageData.data[j + 2] = 254;
					}
				}
				self.frames.push(frame);
			}
			self.saveGif();
		},
		addZone: function () {
			// specify a zone in the gif
		},
		removeZone: function() {
		},
		saveGif: function () {
			// compile a cinemagraph version of the gif
			var self = this;

			// Create an example mask
			var context = self.interface.canvas.getContext('2d');
			context.beginPath();
			context.rect(188, 50, 200, 100);
			context.fillStyle = 'black';
			context.fill();
			var imageData = context.getImageData(0, 0, 640, 480);
			var zone = new Zone(imageData, 0);
			self.zones.push(zone);

			// Loop through the zones
			var usedFrames = self.frames;
			for(var k in self.zones) {
				var zone = self.zones[k];

				// Loop through the frames
				for(var i in usedFrames) {
					var frame = usedFrames[i];
					// Loop through the pixels
					for(var j = 0; j < frame.data.length; j += 4) {
						if(zone.mask.data[j + 3] == 0)
							continue;
						frame.data[j] = usedFrames[0].data[j];
						frame.data[j + 1] = usedFrames[0].data[j + 1];
						frame.data[j + 2] = usedFrames[0].data[j + 2];
					}
					usedFrames[i] = frame;
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
					self.gifUrl = url;
					$("body").append("<img src='" + url + "' style='position:absolute; right:0;'>");
				}
			}, false);

			gifWorker.addEventListener('error', function (e) {
				console.log(e);
				gifWorker.terminate();
			}, false);
			gifWorker.postMessage({
				frames: usedFrames,
				delay: 1/self.fps,
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

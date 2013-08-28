/**
 * This plugin walks a user through the workflow of creating a cinemagraph using a browser and a device camera.
 */

;(function ( $, window, document, undefined ) {
	
	// Create the defaults once
	var pluginName = "Cinemagraph",
		defaults = {};

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
			self.getGif();
		},
		getGif: function() {
			var self = this;
			self.$element.CameraToGif({
				onComplete: function(frames, gifUrl) {
					self.$element.GifToCinemagraph({
						frames: frames,
						gifUrl: gifUrl
					})
				}
			});
		},
		useVideo: function(videoUrl) {
			var self = this;
			self.$element.VideoToGif({
				videoUrl: videoUrl,
				onComplete: function(gifUrl) {
					self.useGif(gifUrl);
				}
			});
		},
		useGif: function() {

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

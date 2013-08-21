/**
 * This plugin provides an interface to take a video and specify a section to convert into a gif.
 */
;(function ( $, window, document, undefined ) {
	
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
			self.$element.clear();

			self.load(self.settings.videoUrl);
			self.save();
		},
		load: function(videoUrl) {
			// load in a video file to work with
			
		},
		trim: function() {
			// trim the portion of the video to be converted
		},
		save: function() {
			// take the buffer and generate a gif
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

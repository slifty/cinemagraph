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
		},
		load: function () {
			// load in a gif to work with
		},
		addMotion: function () {
			// specify shapes of "motion" in the gif
		},
		removeMotion: function() {
			// specify shapes of "freezing" in the gif
		},
		save: function () {
			// compile a cinemagraph version of the gif
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

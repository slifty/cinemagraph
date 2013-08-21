/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Shim module so we can safely check what environment this is being included in.
var module = module || undefined;

(function ( module ) {
  "use strict";

  var API_PREFIX = "/api/20130724/make/";

  var Make,
      xhrStrategy,
      apiURL,
      credentials,
      auth,
      user,
      pass,
      csrfToken,
      request,
      hawk;

  function nodeStrategy( type, path, data, callback ) {
    // Only use auth if provided
    var authObj = ( user && pass ) ? {
          username: user,
          password: pass,
          sendImmediately: true
        } : undefined,
        requestOptions = {
          method: type,
          uri: path,
          json: data,
          headers: {}
        },
        header;

    if ( authObj ) {
      requestOptions.auth = authObj;
    } else if( credentials ) {
      header = hawk.client.header( path, type, { credentials: credentials } );
      requestOptions.headers.Authorization = header.field;
    }

    request( requestOptions, function( err, res, body ) {
      // TODO: Authenticate the server response
      if ( err ) {
        return callback( err );
      }

      var authenticated = hawk.client.authenticate( res, credentials, header.artifacts, { payload: JSON.stringify( body ) } );
      if ( credentials && !authenticated ) {
        return callback( "Warning: The response does not authenticate - your traffic may be getting intercepted and modified" );
      }

      callback( body.error, body );
    });
  }

  function browserStrategy( type, path, data, callback ) {
    var request = new XMLHttpRequest();

    if ( auth ) {
      request.open( type, path, true, user, pass );
    } else {
      request.open( type, path, true );
    }
    if ( csrfToken ) {
      request.setRequestHeader( "x-csrf-token", csrfToken );
    }
    request.setRequestHeader( "Content-Type", "application/json; charset=utf-8" );
    request.onreadystatechange = function() {
      var response,
          error;
      if ( this.readyState === 4 ) {
        try {
          response = JSON.parse( this.responseText ),
          error = response.error;
        }
        catch ( exception ) {
          error = exception;
        }
        if ( error ) {
          callback( error );
        } else {
          callback( null, response );
        }
      }
    };
    request.send( JSON.stringify( data ) );
  }

  function doXHR( type, path, data, callback ) {

    if ( typeof data === "function" ) {
      callback = data;
      data = {};
    } else if ( typeof data === "string" ) {
      path = data.length ? path + "?" + data : path;
      data = {};
    }

    path = apiURL + path;

    xhrStrategy( type, path, data, callback );
  }

  // Extend a make with some API sugar.
  function wrap( make, options ) {

    function getMakeInstance() {
      if ( !getMakeInstance.instance ) {
        getMakeInstance.instance = Make( options );
      }
      return getMakeInstance.instance;
    }

    // Lazily extract various tags types as needed, and memoize.
    function lazyInitTags( o, name, regexp ) {
      delete o[ name ];
      var tags = [];
      make.tags.forEach( function( tag ) {
        if( regexp.test( tag ) ) {
          tags.push( tag );
        }
      });
      o[ name ] = tags;
      return tags;
    }

    var wrapped = {
      // Application Tags are "webmaker.org:foo", which means two
      // strings, joined with a ':', and the first string does not
      // contain an '@'
      get appTags() {
        return lazyInitTags( this, 'appTags', /^[^@]+\:[^:]+/ );
      },

      // User Tags are "some@something.com:foo", which means two
      // strings, joined with a ':', and the first string contains
      // an email address (i.e., an '@').
      get userTags() {
        return lazyInitTags( this, 'userTags', /^[^@]+@[^@]+\:[^:]+/ );
      },

      // Raw Tags are "foo" or "#fooBar", which means one string
      // which does not include a colon.
      get rawTags() {
        return lazyInitTags( this, 'rawTags', /^[^:]+$/ );
      },

      // Determine whether this make is tagged with any of the tags
      // passed into `tags`.  This can be a String or [ String ],
      // and the logic is OR vs. AND for multiple.
      taggedWithAny: function( tags ) {
        var any = false,
            all = make.tags;
        tags = Array.isArray( tags ) ? tags : [ tags ];
        for( var i = 0; i < tags.length; i++ ) {
          if ( all.indexOf( tags[ i ] ) > -1 ) {
            return true;
          }
        }
        return false;
      },

      // Get a list of other makes that were remixed from this make.
      // The current make's URL is used as a key.
      remixes: function( callback ) {
        callback = callback || function(){};
        getMakeInstance()
        .find({ remixedFrom: wrapped._id })
        .then( callback );
      },

      // Similar to remixes(), but filter out only those remixes that
      // have a different locale (i.e., are localized versions of this
      // make).
      locales: function( callback ) {
        callback = callback || function(){};
        this.remixes( function( err, results ) {
          if( err ) {
            callback( err );
            return;
          }
          var locales = [];
          results.forEach( function( one ) {
            if ( one.locale !== wrapped.locale ) {
              locales.push( one );
            }
          });
          callback( null, locales );
        });
      },

      // Get the original make used to create this remix. Null is sent
      // back in the callback if there was no original (not a remix)
      original: function( callback ) {
        callback = callback || function(){};
        if ( !wrapped.remixedFrom ) {
          callback( null, null );
          return;
        }
        getMakeInstance()
        .find({ _id: wrapped._id })
        .then( callback );
      },

      update: function( email, callback ) {
        callback = callback || function(){};
        getMakeInstance()
        .update( wrapped._id, wrapped, callback );
      }

    };

    // Extend wrapped with contents of make
    [ "url", "contentType", "locale", "title",
      "description", "author", "published", "tags", "thumbnail",
      "username", "remixedFrom", "_id", "emailHash", "createdAt",
      "updatedAt" ].forEach( function( prop ) {
        wrapped[ prop ] = make[ prop ];
    });

    // Virtuals will only be exposed while still on the server end
    // forcing us to still manually expose it for client side users.
    wrapped.id = wrapped._id;

    return wrapped;
  }

  // Shorthand for creating a Make Object
  Make = function Make( options ) {
    apiURL = options.apiURL;

    if ( options.hawk ) {
      credentials = options.hawk;
    } else if ( options.auth ) {
      auth = options.auth.split( ":" );
      user = auth[ 0 ];
      pass = auth[ 1 ];
    }

    if ( options.csrf ) {
      csrfToken = options.csrf;
    }

    function mapAndJoinTags( tags ) {
      return tags.map(function( val ) {
        return val.trim();
      }).join( "," );
    }

    return {
      queryPairs: [],

      addPair: function( key, val, not ) {
        val = val ? val.toString() : "";

        if ( !val.length ) {
          return this;
        }
        val = not ? "{!}" + val : val;
        this.queryPairs.push( encodeURIComponent( key ) + "=" + encodeURIComponent( val ) );
        return this;
      },

      find: function( options ) {
        options = options || {};

        for ( var key in options ) {
          if ( options.hasOwnProperty( key ) && this[ key ] ) {
            if ( Array.isArray( options[ key ] ) ) {
              this[ key ].apply( this, options[ key ] );
            } else {
              this[ key ]( options[ key ] );
            }
          }
        }
        return this;
      },

      author: function( name, not ) {
        return this.addPair( "author", name, not );
      },

      user: function( id, not ) {
        return this.addPair( "user", id, not );
      },

      tags: function( options, not ) {
        if ( options ) {
          var tags = options.tags || options,
              execution = options.execution || "and";

          if ( Array.isArray( tags ) ) {
            tags = mapAndJoinTags( tags );
          } else {
            tags = mapAndJoinTags( tags.split( "," ) );
          }

          tags = execution + "," + tags;

          return this.addPair( "tags", tags, not );
        }
        return this;
      },

      tagPrefix: function( prefix, not ) {
        return this.addPair( "tagPrefix", prefix, not );
      },

      url: function( url, not ) {
        return this.addPair( "url", url, not );
      },

      contentType: function( contentType, not ) {
        return this.addPair( "contentType", contentType, not );
      },

      remixedFrom: function( id, not ) {
        return this.addPair( "remixedFrom", id, not );
      },

      id: function( id, not ) {
        return this.addPair( "id", id, not );
      },

      title: function( title, not ) {
        return this.addPair( "title", title, not );
      },

      description: function( desc, not ) {
        return this.addPair( "description", desc, not );
      },

      limit: function( num ) {
        return this.addPair( "limit", num );
      },

      page: function( num ) {
        return this.addPair( "page", num );
      },

      sortByField: function( field, direction ) {
        var sortOpts;
        if ( typeof field === "string" ) {
          sortOpts = field;
          sortOpts += "," + ( direction ? direction : "desc" );
          return this.addPair( "sortByField", sortOpts );
        }
        return this;
      },

      or: function() {
        return this.addPair( "or", "1" );
      },

      then: function( callback ) {
        var querystring = this.queryPairs.join( "&" );

        this.queryPairs = [];

        doXHR( "GET", API_PREFIX + "search",
          querystring,
          function( err, data ) {
            if ( err ) {
              callback( err );
            } else {
              // Wrap resulting makes with some extra API.
              var hits = data.makes;
              for( var i = 0; i < hits.length; i++ ) {
                hits[ i ] = wrap( hits[ i ], options );
              }
              callback( null, hits, data.total );
            }
          }
        );
      },

      // Options should be of the form: { maker: "email@address", make: {...} }
      create: function create( options, callback ) {
        doXHR( "POST", API_PREFIX, options, callback );
        return this;
      },

      update: function update( id, options, callback ) {
        doXHR( "PUT", API_PREFIX + id, options, callback );
        return this;
      },

      remove: function remove( id, callback ) {
        doXHR( "DELETE", API_PREFIX + id, callback );
        return this;
      }
    };
  };

  // Depending on the environment we need to export our "Make" object differently.
  if ( typeof module !== 'undefined' && module.exports ) {
    request = require( "request" );
    hawk = require( "hawk" );
    // npm install makeapi support
    xhrStrategy = nodeStrategy;
    module.exports = Make;
  } else {
    xhrStrategy = browserStrategy;
    if ( typeof define === "function" && define.amd ) {
      // Support for requirejs
      define(function() {
        return Make;
      });
    } else {
      // Support for include on individual pages.
      window.Make = Make;
    }
  }
}( module ));
"use strict";
var path = require( "path" );
var sys = require( "lodash" );
var jsdocPublicApi = {
	src       : ["./node_modules/jsdoc/test/fixtures/*.js"],
	dest      : "./dox",
	tutorials : "./",
	template  : "./template",
	config    : "./template/jsdoc.conf.json",
	options   : " --lenient --verbose"
};

function jsdocCommand( jsdoc ) {
	var cmd = [];
	cmd.unshift( jsdoc.options );
//	cmd.unshift( "--private" );
//	cmd.push( "-u " + path.resolve( jsdoc.tutorials ) );
	cmd.push( "-d " + path.resolve( jsdoc.dest ) );
	cmd.push( "-t " + path.resolve( jsdoc.template ) );
	cmd.push( "-c " + path.resolve( jsdoc.config ) );
	sys.each( jsdoc.src, function ( src ) {
		cmd.push( path.resolve( src ) );
	} );
	cmd.unshift( path.resolve( "./node_modules/jsdoc/jsdoc" ) );
	return cmd.join( " " );
}
var tasks= {
	shell  : {
		options    : {
			stdout : true,
			stderr : true
		},
		docs       : {
			command : jsdocCommand( jsdocPublicApi )
		}
	},
	less: {
		dev: {

			files: {
				"template/static/styles/site.css": "styles/main.less"
			}
		},
		prod: {
			options: {
				paths: ["assets/css"],
				yuicompress: true
			},
			files: {
				"path/to/result.css": "path/to/source.less"
			}
		}
	}
}  ;

module.exports = function ( grunt ) {
	grunt.initConfig( tasks );

	grunt.loadNpmTasks( 'grunt-contrib-less' );
	grunt.loadNpmTasks( 'grunt-shell' );

//	grunt.registerTask( "all", ["build", "dox"] );

};
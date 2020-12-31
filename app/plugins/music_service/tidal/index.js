'use strict';
var libQ = require('kew');
var unirest = require('unirest');
var fs=require('fs-extra');
var moment=require('moment');

/**
 * CONSTRUCTOR
 */
module.exports = ControllerTidal;

function ControllerTidal(context) {
	var self=this;

    this.context = context;
	this.commandRouter = this.context.coreCommand;
    this.configManager = this.context.configManager;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
	this.config = new (require('v-conf'))();
    this.config.registerCallback('password',self.logUser.bind(this));

    fs.readJson(__dirname+'/i18n/strings_'+this.commandRouter.sharedVars.get('language_code')+'.json',
        function(err, packageObj) {
            if(err)
                console.log("Error reading i18n file");
            else self.i18n=packageObj;
    });
}


/**
 * CONFIGURATION METHODS
 */
ControllerTidal.prototype.getConfigurationFiles = function () {
    var self = this;

    return ['config.json'];
};

ControllerTidal.prototype.onVolumioStart = function () {
    var self = this;

    //Loading configuration when plugin loads
    var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
    self.config.loadFile(configFile);

    return libQ.resolve();
};


ControllerTidal.prototype.onStart = function () {
    this.mpdPlugin=this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

    if(this.isLoggedIn())
    {
        //isLoggedIn checks if session in config file is valid. If valid no entry in browse source is added. Adding it
        var bs = {name: 'TIDAL', uri: 'tidal://',plugin_type:'music_service',plugin_name:'tidal'};
        this.commandRouter.musicLibrary.addToBrowseSources(bs);
    }
    return libQ.resolve();
};

ControllerTidal.prototype.onStop = function () {
    this.commandRouter.musicLibrary.removeBrowseSource('TIDAL');

    return libQ.resolve();
};



ControllerTidal.prototype.getUIConfig = function () {
    var self = this;

    var defer=libQ.defer();
    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+this.commandRouter.sharedVars.get('language_code')+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

            self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value',  self.config.get('username'));
            self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value',  self.config.get('password'));

            if(self.isLoggedIn())
            {
                self.configManager.setUIConfigParam(uiconf, 'sections[0].saveButton.label',  self.i18n['TIDAL']['LOGOUT']);
            }

            self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value',  self.config.get('useHighestQuality'));
            self.configManager.setUIConfigParam(uiconf, 'sections[1].content[1].value.value',  self.config.get('userQuality'));
            self.configManager.setUIConfigParam(uiconf, 'sections[1].content[1].value.label',  self.i18n['TIDAL']['QUALITY_'+self.config.get('userQuality')]);

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

ControllerTidal.prototype.saveAccount = function (params) {
    var self=this;

    if(self.isLoggedIn()==false)
    {
        self.config.set('username',params.username);
        self.config.set('password',params.password);

        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['SAVE_ACCOUNT_SUCCESS']);

        return libQ.resolve();
    }
    else return self.logOut();

}

ControllerTidal.prototype.isLoggedIn = function () {
    var self = this;

    var sessionId = self.config.get('sessionId');
    var validUntil = self.config.get('validUntil');
    var validityMoment = moment.utc(validUntil);

    return (sessionId !== undefined && moment().isBefore(validityMoment)) ;
}
ControllerTidal.prototype.saveQuality = function (params) {
    var self=this;

    self.config.set('useHighestQuality',params.useHighestQuality);
    if(params.useHighestQuality==false)
        self.config.set('userQuality',params.userQuality.value);
    else self.config.set('userQuality','NORMAL');

    self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['SAVE_QUALITY_SUCCESS']);

    return libQ.resolve();
}



/**
 * BROWSING METHODS
 */
ControllerTidal.prototype.handleBrowseUri = function (curUri) {
	var self = this;

	var response;

	console.log("CURURI: "+curUri);
	if (curUri.startsWith('tidal://')) {
		if(curUri==='tidal://')
			response = this.browseRoot();
		/**
		 * MENU NEW
		 */

		//  Playlists
		else if(curUri==='tidal://new')
			response = this.browseNewMenu();
		else if(curUri==='tidal://new/playlists')
			response = this.browseNewPlaylistsMenu();
		else if(curUri==='tidal://new/playlists/new')
			response = this.listGenericLevel('https://api.tidal.com/v1/featured/new/playlists','tidal://new/playlists','tidal://new/playlists/new/ID','320x214');
		else if(curUri.startsWith('tidal://new/playlists/new'))
			response = this.listPlaylist(curUri,'tidal://new/playlists/new',5);
		else if(curUri==='tidal://new/playlists/recommended')
			response = this.listGenericLevel('https://api.tidal.com/v1/featured/recommended/playlists','tidal://new/playlists','tidal://new/playlists/recommended/ID','320x214');
		else if(curUri.startsWith('tidal://new/playlists/recommended'))
			response = this.listPlaylist(curUri,'tidal://new/playlists/recommended',5);
		else if(curUri==='tidal://new/playlists/local')
			response = this.listGenericLevel('https://api.tidal.com/v1/featured/local/playlists','tidal://new/playlists','tidal://new/playlists/recommended/ID','320x214');
		else if(curUri.startsWith('tidal://new/playlists/local'))
			response = this.listPlaylist(curUri,'tidal://new/playlists/local',5);
		else if(curUri==='tidal://new/playlists/exclusive')
			response = this.listGenericLevel('https://api.tidal.com/v1/featured/exclusive/playlists','tidal://new/playlists','tidal://new/playlists/recommended/ID','320x214');
		else if(curUri.startsWith('tidal://new/playlists/exclusive'))
			response = this.listPlaylist(curUri,'tidal://new/playlists/exclusive',5);

		// Albums
		else if(curUri==='tidal://new/albums')
			response = this.browseNewAlbumsMenu();
		else if(curUri==='tidal://new/albums/new')
			response = this.listGenericLevel('https://api.tidal.com/v1/featured/new/albums','tidal://new/albums','tidal://new/albums/new/ID','320x320');
		else if(curUri.startsWith('tidal://new/albums/new'))
			response = this.listAlbum(curUri,'tidal://new/albums/new',5);

		else if(curUri==='tidal://new/albums/recommended')
			response = this.listGenericLevel('https://api.tidal.com/v1/featured/recommended/albums','tidal://new/albums','tidal://new/albums/recommended/ID','320x320');
		else if(curUri.startsWith('tidal://new/albums/recommended'))
			response = this.listAlbum(curUri,'tidal://new/albums/recommended',5);

		else if(curUri==='tidal://new/albums/top20')
			response = this.listGenericLevel('https://api.tidal.com/v1/featured/top/albums','tidal://new/albums','tidal://new/albums/top20/ID','320x320');
		else if(curUri.startsWith('tidal://new/albums/top20'))
			response = this.listAlbum(curUri,'tidal://new/albums/top20',5);

		else if(curUri==='tidal://new/albums/local')
			response = this.listGenericLevel('https://api.tidal.com/v1/featured/local/albums','tidal://new/albums','tidal://new/albums/local/ID','320x320');
		else if(curUri.startsWith('tidal://new/albums/local'))
			response = this.listAlbum(curUri,'tidal://new/albums/local',5);

		// Tracks
		else if(curUri==='tidal://new/tracks')
			response = this.browseNewTracksMenu();
		else if(curUri==='tidal://new/tracks/new')
		//     response = this.listGenericLevel('https://api.tidal.com/v1/featured/new/tracks','tidal://new/tracks','tidal://new/tracks/new/ID');
		// else if(curUri.startsWith('tidal://new/tracks/new'))
			response = this.listGenericSongs('https://api.tidal.com/v1/featured/new/tracks','tidal://new/tracks','tidal://song/ID');

		else if(curUri==='tidal://new/tracks/recommended')
			response = this.listGenericSongs('https://api.tidal.com/v1/featured/recommended/tracks','tidal://new/tracks','tidal://song/ID');

		else if(curUri==='tidal://new/tracks/top20')
			response = this.listGenericSongs('https://api.tidal.com/v1/featured/top/tracks','tidal://new/tracks','tidal://song/ID');

		else if(curUri==='tidal://new/tracks/local')
			response = this.listGenericSongs('https://api.tidal.com/v1/featured/local/tracks','tidal://new/tracks','tidal://song/ID');

		/**
		 * MENU TIDAL RISING
		 */
		else if(curUri==='tidal://rising')
			response = this.browseRisingMenu();
		else if(curUri==='tidal://rising/albums')
			response = this.listGenericLevel('https://api.tidal.com/v1/rising/new/albums','tidal://rising','tidal://rising/albums/ID','320x320');
		else if(curUri.startsWith('tidal://rising/albums'))
			response = this.listAlbum(curUri,'tidal://rising/albums',4);

		else if(curUri==='tidal://rising/tracks')
			response = this.listGenericSongs('https://api.tidal.com/v1/rising/new/tracks','tidal://rising','tidal://song/ID');

		/**
		 * MENU PLAYLISTS
		 */
		else if(curUri==='tidal://playlists')
			response = this.browsePlaylistsMenu();
		else if(curUri.startsWith('tidal://playlists/'))
		{
			var splitted=curUri.split('/');
			var mood=splitted[3];

			console.log(splitted.length);
			if(splitted.length==4)
				response = this.listGenericLevel('https://api.tidal.com/v1/moods/'+mood+'/playlists','tidal://playlists','tidal://playlists/'+mood+'/ID','320x214');
			else response = this.listPlaylist(curUri,'tidal://playlists',4);

		}

		/**
		 * MENU TIDAL GENRES
		 */
		else if(curUri==='tidal://genres')
			response = this.browseGenresMenu();
		else if(curUri.startsWith('tidal://genres/'))
		{
			var splitted=curUri.split('/');
			var genre=splitted[3];

			if(splitted.length==4)
				response = this.browseGenreMenu(genre);
			else if(splitted[4]==='playlists')
			{
				if(splitted.length==5)
					response = this.listGenericLevel('https://api.tidal.com/v1/genres/'+genre+'/playlists','tidal://genres/'+genre,'tidal://genres/'+genre+'/playlists/ID','320x214');
				else response = this.listPlaylist(curUri,'tidal://genres/'+genre+'/playlists',5);
			}
			else if(splitted[4]==='albums')
			{
				if(splitted.length==5)
					response = this.listGenericLevel('https://api.tidal.com/v1/genres/'+genre+'/albums','tidal://genres/'+genre,'tidal://genres/'+genre+'/albums/ID','320x320');
				else response = this.listAlbum(curUri,'tidal://genres/'+genre+'/albums',5);
			}
			else if(splitted[4]==='tracks')
			{
				response = this.listGenericSongs('https://api.tidal.com/v1/genres/'+genre+'/tracks','tidal://genres/'+genre,'tidal://song/ID');
			}

		}

		else if(curUri.startsWith('tidal://album/'))
			response = this.listAlbum(curUri,'tidal://',3);
		else if(curUri.startsWith('tidal://playlist/'))
		{
			response = this.listPlaylist(curUri,'tidal://',3);
		}
		else if(curUri.startsWith('tidal://artist/'))
		{
			response = this.listArtist(curUri,'tidal://',3);
		}
        else if(curUri.startsWith('tidal://search/'))
        {
            var splitted=curUri.split('/');
            var parentUri='search://'+splitted[3];
            if(curUri.indexOf('album/')>-1)
                response = this.listAlbum(curUri,parentUri,5);
            else if(curUri.indexOf('playlist/')>-1)
            {
                response = this.listPlaylist(curUri,parentUri,5);
            }
            else if(curUri.indexOf('artist/')>-1)
            {
                response = this.listArtist(curUri,parentUri,5);
            }
        }
        else if(curUri==='tidal://mymusic')
        {
            response = this.browseMyMusic();
        }
        else if(curUri==='tidal://mymusic/playlists')
        {
            response = this.browseMyMusicPlaylists();
        }
        else if(curUri.startsWith('tidal://mymusic/tracks'))
        {
            var userId=this.config.get('userId');
            response = this.listMyMusic('https://api.tidal.com/v1/users/'+userId+'/favorites/tracks','tidal://mymusic','tidal://song/ID','song');
        }
        else if(curUri.startsWith('tidal://mymusic/albums'))
        {
            var splitted=curUri.split('/');
            if(splitted.length===4)
            {
                var userId=this.config.get('userId');
                response = this.listMyMusic('https://api.tidal.com/v1/users/'+userId+'/favorites/albums','tidal://mymusic','tidal://mymusic/albums/ID','folder');
            }
            else
            {
                response = this.listAlbum(curUri,'tidal://mymusic/albums',4);
            }
        }
        else if(curUri.startsWith('tidal://mymusic/artists'))
        {
            var splitted=curUri.split('/');
            if(splitted.length===4)
            {
                var userId=this.config.get('userId');
                response = this.listMyMusic('https://api.tidal.com/v1/users/'+userId+'/favorites/artists','tidal://mymusic','tidal://mymusic/artists/ID','radio-category');
            }
            else if(splitted.length===5)
            {
                var id=splitted[4];
                return this.listMyMusic('https://api.tidal.com/v1/artists/ID/albums'.replace('ID',id),
                    'tidal://mymusic/artists',curUri+'/ID','folder');
            }
            else
            {
                response = this.listAlbum(curUri,'tidal://mymusic/artists/'+splitted[4],5);
            }
        }
        else if(curUri.startsWith('tidal://mymusic/playlists/myfavoriteplaylists'))
        {
            var splitted=curUri.split('/');

            if(splitted.length===5)
            {
                var userId=this.config.get('userId');
                response = this.listMyMusic('https://api.tidal.com/v1/users/'+userId+'/favorites/playlists','tidal://mymusic/playlists','tidal://mymusic/playlists/myfavoriteplaylists/ID','folder');
            }
            else
            {
                response = this.listPlaylist(curUri,'tidal://mymusic/playlists/myfavoriteplaylists',5);
            }

        }
        else if(curUri.startsWith('tidal://mymusic/playlists/myplaylists'))
        {
            var splitted=curUri.split('/');

            if(splitted.length===5)
            {
                var userId=this.config.get('userId');
                response = this.listMyMusic('https://api.tidal.com/v1/users/'+userId+'/playlists','tidal://mymusic/playlists','tidal://mymusic/playlists/myplaylists/ID','folder');
            }
            else
            {
                response = this.listPlaylist(curUri,'tidal://mymusic/playlists/myplaylists',5);
            }

        }








	}

	return response;
};


ControllerTidal.prototype.listPlaylist=function(curUri,parent,idPos) {
    var splitted=curUri.split('/');
    var id=splitted[idPos];

    console.log("ID: "+id);
    return this.listGenericSongs('https://api.tidal.com/v1/playlists/ID/items'.replace('ID',id),
        parent,'tidal://song/ID');
}

ControllerTidal.prototype.listAlbum=function(curUri,parent,idPos) {
    var splitted=curUri.split('/');
    var id=splitted[idPos];

    console.log("ID: "+id);
    return this.listGenericSongs('https://api.tidal.com/v1/albums/ID/tracks'.replace('ID',id),
        parent,'tidal://song/ID');
}

ControllerTidal.prototype.listArtist=function(curUri,parent,idPos) {
    var splitted=curUri.split('/');
    var id=splitted[idPos];

    console.log("ID: "+id);
    return this.listGenericLevel('https://api.tidal.com/v1/artists/ID/albums'.replace('ID',id),
        parent,'tidal://album/ID','640x640');
}

ControllerTidal.prototype.browseRoot=function() {
    var response = {
        "navigation": {
            "lists": [
                {
                    "availableListViews": [
                        "list"
                    ],
                    "items": [
                        {
                            type: 'radio-category',
                            title: 'New',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new'
                        },
                        {
                            type: 'radio-category',
                            title: 'Tidal rising',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://rising'
                        },
                        {
                            type: 'radio-category',
                            title: 'Playlists',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://playlists'
                        },
                        {
                            type: 'radio-category',
                            title: 'Genres',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://genres'
                        },
                        {
                            type: 'radio-category',
                            title: 'My music',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://mymusic'
                        }
                    ]
                }
            ]
        }
    };



    return libQ.resolve(response);
}

ControllerTidal.prototype.browseNewMenu=function() {



    return libQ.resolve({
        "navigation": {
            "lists": [
                {
                    "availableListViews": [
                        "list"
                    ],
                    "items": [
                        {
                            type: 'radio-category',
                            title: 'Playlists',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/playlists'
                        },
                        {
                            type: 'radio-category',
                            title: 'Album',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/albums'
                        },
                        {
                            type: 'radio-category',
                            title: 'Tracks',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/tracks'
                        }
                    ]
                }
            ],
            "prev": {
                "uri": 'tidal://'
            }
        }
    });
}

ControllerTidal.prototype.browseNewPlaylistsMenu=function() {
    return libQ.resolve({
        "navigation": {
            "lists": [
                {
                    "availableListViews": [
                        "list"
                    ],
                    "items": [
                        {
                            type: 'radio-category',
                            title: 'New',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/playlists/new'
                        },
                        {
                            type: 'radio-category',
                            title: 'Recommended',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/playlists/recommended'
                        },
                        {
                            type: 'radio-category',
                            title: 'Local (not applicable all regions)',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/playlists/local'
                        },
                        {
                            type: 'radio-category',
                            title: 'Exclusive',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/playlists/exclusive'
                        }
                    ]
                }
            ],
            "prev": {
                "uri": 'tidal://new'
            }
        }
    });
}


ControllerTidal.prototype.browseNewAlbumsMenu=function() {
    return libQ.resolve({
        "navigation": {
            "lists": [
                {
                    "availableListViews": [
                        "list"
                    ],
                    "items": [
                        {
                            type: 'radio-category',
                            title: 'New',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/albums/new'
                        },
                        {
                            type: 'radio-category',
                            title: 'Recommended',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/albums/recommended'
                        },
                        {
                            type: 'radio-category',
                            title: 'Top 20',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/albums/top20'
                        },
                        {
                            type: 'radio-category',
                            title: 'Local (not applicable all regions)',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/albums/local'
                        }
                    ]
                }
            ],
            "prev": {
                "uri": 'tidal://new'
            }
        }
    });
}

ControllerTidal.prototype.browseNewTracksMenu=function() {
    return libQ.resolve({
        "navigation": {
            "lists": [
                {
                    "availableListViews": [
                        "list"
                    ],
                    "items": [
                        {
                            type: 'radio-category',
                            title: 'New',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/tracks/new'
                        },
                        {
                            type: 'radio-category',
                            title: 'Recommended',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/tracks/recommended'
                        },
                        {
                            type: 'radio-category',
                            title: 'Top 20',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/tracks/top20'
                        },
                        {
                            type: 'radio-category',
                            title: 'Local (not applicable all regions)',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://new/tracks/local'
                        }
                    ]
                }
            ],
            "prev": {
                "uri": 'tidal://new'
            }
        }
    });
}

ControllerTidal.prototype.browseRisingMenu=function() {
    return libQ.resolve({
        "navigation": {
            "lists": [
                {
                    "availableListViews": [
                        "list"
                    ],
                    "items": [
                        {
                            type: 'radio-category',
                            title: 'Albums',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://rising/albums'
                        },
                        {
                            type: 'radio-category',
                            title: 'Tracks',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://rising/tracks'
                        }
                    ]
                }
            ],
            "prev": {
                "uri": 'tidal://'
            }
        }
    });
}


ControllerTidal.prototype.browseMyMusic=function() {
    var response = {
        "navigation": {
            "lists": [
                {
                    "availableListViews": [
                        "list"
                    ],
                    "items": [
                        {
                            type: 'radio-category',
                            title: 'Playlists',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://mymusic/playlists'
                        },
                        {
                            type: 'radio-category',
                            title: 'Artists',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://mymusic/artists'
                        },
                        {
                            type: 'radio-category',
                            title: 'Albums',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://mymusic/albums'
                        },
                        {
                            type: 'radio-category',
                            title: 'Tracks',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://mymusic/tracks'
                        }
                    ]
                }
            ],
            "prev": {
                "uri": 'tidal://'
            }
        }
    };



    return libQ.resolve(response);
}

ControllerTidal.prototype.browseMyMusicPlaylists=function() {
    var response = {
        "navigation": {
            "lists": [
                {
                    "availableListViews": [
                        "list"
                    ],
                    "items": [
                        {
                            type: 'radio-category',
                            title: 'My Playlists',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://mymusic/playlists/myplaylists'
                        },
                        {
                            type: 'radio-category',
                            title: 'My Favorite Playlists',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://mymusic/playlists/myfavoriteplaylists'
                        }
                    ]
                }
            ],
            "prev": {
                "uri": 'tidal://mymusic'
            }
        }
    };



    return libQ.resolve(response);
}
ControllerTidal.prototype.browsePlaylistsMenu = function () {
    var self = this;

    var defer=libQ.defer();

    var token=self.config.get('token');
    var countryCode=self.config.get('countryCode');

    var url="https://api.tidal.com/v1/moods";

    unirest
        .get(url)
        .query({
            token: token,
            countryCode: countryCode,
            limit: 1000
        })
        .end(function (response) {
            if (response.code == 200) {

                var listing={
                    "navigation": {
                        "lists": [
                            {
                                "availableListViews": [
                                    "list",
									"grid"
                                ],
                                "items": [

                                ]
                            }
                        ],
                        "prev": {
                            "uri": 'tidal://'
                        }
                    }
                };

                for(var i in response.body)
                {
                    var item=response.body[i];

                    var albumart;

                    if(item.image!==undefined)
                        albumart='https://resources.tidal.com/images/'+
                            item.image.replace(/-/g,'/')+ '/684x684.jpg';

                    listing.navigation.lists[0].items.push({
                        type: 'radio-category',
                        title: item.name,
                        albumart: albumart,
                        uri: 'tidal://playlists/'+item.name,
                        service:'tidal'
                    });
                }


                defer.resolve(listing);


            }
            else if (response.code == 404) {
                self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LISTING_NO_RESULTS']);

                var listing={
                    "navigation": {
                        "lists": [
                            {
                                "availableListViews": [
                                    "list"
                                ],
                                "items": [

                                ]
                            }
                        ],
                        "prev": {
                            "uri": 'tidal://'
                        }
                    }
                };

                defer.resolve(listing);

            }
            else
            {
                defer.reject(new Error('An error occurred while logging into Tidal.'));
            }
        });

    return defer.promise;
};

ControllerTidal.prototype.browseGenresMenu = function () {
    var self = this;

    var defer=libQ.defer();

    var token=self.config.get('token');
    var countryCode=self.config.get('countryCode');

    var url="https://api.tidal.com/v1/genres";

    unirest
        .get(url)
        .query({
            token: token,
            countryCode: countryCode,
            limit: 1000
        })
        .end(function (response) {
            if (response.code == 200) {

                var listing={
                    "navigation": {
                        "lists": [
                            {
                                "availableListViews": [
                                    "list",
									"grid"
                                ],
                                "items": [

                                ]
                            }
                        ],
                        "prev": {
                            "uri": 'tidal://'
                        }
                    }
                };

                for(var i in response.body)
                {
                    var item=response.body[i];

                    var albumart;

                    if(item.image!==undefined)
                        albumart='https://resources.tidal.com/images/'+
                            item.image.replace(/-/g,'/')+ '/640x426.jpg';

                    listing.navigation.lists[0].items.push({
                        type: 'radio-category',
                        title: item.name,
                        albumart: albumart,
                        uri: 'tidal://genres/'+item.path
                    });
                }


                defer.resolve(listing);


            }
            else if (response.code == 404) {
                self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LISTING_NO_RESULTS']);

                var listing={
                    "navigation": {
                        "lists": [
                            {
                                "availableListViews": [
                                    "list"
                                ],
                                "items": [

                                ]
                            }
                        ],
                        "prev": {
                            "uri": 'tidal://'
                        }
                    }
                };

                defer.resolve(listing);

            }
            else
            {
                defer.reject(new Error('An error occurred while logging into Tidal.'));
            }
        });

    return defer.promise;
};

ControllerTidal.prototype.browseGenreMenu=function(genre) {
    return libQ.resolve({
        "navigation": {
            "lists": [
                {
                    "availableListViews": [
                        "list"
                    ],
                    "items": [
                        {
                            type: 'radio-category',
                            title: 'Playlists',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://genres/'+genre+"/playlists"
                        },
                        {
                            type: 'radio-category',
                            title: 'Albums',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://genres/'+genre+"/albums"
                        },
                        {
                            type: 'radio-category',
                            title: 'Tracks',
                            icon: 'fa fa-folder-open-o',
                            uri: 'tidal://genres/'+genre+"/tracks"
                        }
                    ]
                }
            ],
            "prev": {
                "uri": 'tidal://genres'
            }
        }
    });
}

ControllerTidal.prototype.listGenericLevel = function (url,parent,templateResponseUri,imageSize) {
    var self = this;

    var defer=libQ.defer();

    var token=self.config.get('token');
    var countryCode=self.config.get('countryCode');

    var loginDefer=self.logUser();
    loginDefer.then(function()
    {
        unirest
            .get(url)
            .query({
                token: token,
                countryCode: countryCode,
                limit: 1000
            })
            .end(function (response) {
                console.log(response.code);
                if (response.code == 200) {

                    var listing={
                        "navigation": {
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list",
										"grid"
                                    ],
                                    "items": [

                                    ]
                                }
                            ],
                            "prev": {
                                "uri": parent
                            }
                        }
                    };

                    for(var i in response.body.items)
                    {
                        var item=response.body.items[i];

                        var albumart;
                        var uuid;
		//	console.log(item);
			    if(item.image!==undefined)
			    {
				    try{
					    albumart='https://resources.tidal.com/images/'+
						    item.image.replace(/-/g,'/')+ '/'+imageSize+'.jpg';
				    }catch(e){}
			    }
			    else if(item.cover!==undefined)
			    {
				    try{
					    albumart='https://resources.tidal.com/images/'+
						    item.cover.replace(/-/g,'/')+ '/'+imageSize+'.jpg';
				    }catch(e){}
			    }
                        if(item.uuid!==undefined)
                            uuid=item.uuid;
                        else if(item.id!==undefined)
                            uuid=item.id;

                        listing.navigation.lists[0].items.push({
                            type: 'folder',
                            title: item.title,
                            albumart: albumart,
                            uri: templateResponseUri.replace('ID',uuid),
                            service:'tidal'
                        });
                    }


                    defer.resolve(listing);


                }
                else if (response.code == 404) {
                    self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LISTING_NO_RESULTS']);

                    var listing={
                        "navigation": {
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list"
                                    ],
                                    "items": [

                                    ]
                                }
                            ],
                            "prev": {
                                "uri": parent
                            }
                        }
                    };

                    defer.resolve(listing);

                }
                else
                {
                    defer.reject(new Error('An error occurred while logging into Tidal.'));
                }
            });
    }).fail(function()
    {
        defer.reject(new Error('Cannot login'));
    });

    return defer.promise;
};

ControllerTidal.prototype.listGenericSongs = function (url,parent,templateResponseUri) {
    var self = this;

    var defer=libQ.defer();

    var token=self.config.get('token');
    var countryCode=self.config.get('countryCode');

    var loginDefer=self.logUser();
    loginDefer.then(function()
    {
        unirest
            .get(url)
            .query({
                token: token,
                countryCode: countryCode,
                limit: 100
            })
            .end(function (response) {

                if (response.code == 200) {

                    var listing={
                        "navigation": {
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list",
                                        "grid"
                                    ],
                                    "items": [

                                    ]
                                }
                            ],
                            "prev": {
                                "uri": parent
                            }
                        }
                    };

                    for(var i in response.body.items)
                    {
                        var item;

                        if(response.body.items[i].item!==undefined)
                            item=response.body.items[i].item;
                        else item=response.body.items[i];

                        var albumart;

                        if(item.album !==undefined && item.album.cover !==undefined && item.album.cover !==null)
                            albumart='https://resources.tidal.com/images/'+
                            item.album.cover.replace(/-/g,'/')+ '/640x640.jpg';
                        else albumart='/albumart'

                        listing.navigation.lists[0].items.push({
                            service: 'tidal',
                            type: 'song',
                            title: item.title,
                            artist: item.artist.name,
                            album: item.album.title,
                            albumart: albumart,
                            uri: templateResponseUri.replace('ID',item.id)
                        });
                    }

                    defer.resolve(listing);
                }
                else if (response.code == 404) {
                    self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LISTING_NO_RESULTS']);

                    var listing={
                        "navigation": {
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list"
                                    ],
                                    "items": [

                                    ]
                                }
                            ],
                            "prev": {
                                "uri": parent
                            }
                        }
                    };

                    defer.resolve(listing);

                }
                else
                {
                    defer.reject(new Error('An error occurred while logging into Tidal.'));
                }
            });
    }).fail(function()
    {
        defer.reject(new Error('Cannot login'));
    });

    return defer.promise;
};


ControllerTidal.prototype.getStreamUrl = function(uri) {
    var self = this;

    var defer=libQ.defer();

    var splitted=uri.split('/');
    var id=splitted[3];

    var loginDefer=self.logUser();
    loginDefer.then(function()
    {
        var streamUrl=self.config.get('stream_url').replace('ID',id);
        var token=self.config.get('token');
        var sessionId=self.config.get('sessionId');
        var soundQuality=self.config.get('highestSoundQuality');

        var useHighestSoundQuality=self.config.get('useHighestQuality');
        var userSoundQuality=self.config.get('userQuality');

        if(useHighestSoundQuality==false)
            soundQuality=userSoundQuality;

        console.log("GETTING URL WITH QUALITY "+soundQuality);

        unirest
            .get(streamUrl)
            .headers({
                'X-Tidal-Token': token,
                'X-Tidal-SessionId': sessionId
            })
            .query({
                soundQuality:soundQuality
            })
            .send()
            .end(function (response) {
                console.log(response.body);
                if (response.code == 200) {
                    defer.resolve({
                        uri: response.body.url
                    });
                }
                else
                {
                    defer.reject(new Error('An error occurred while retrieving stream URL.'));
                    self.logger.error('TIDAL LOGIN: '+response.code+' '+response.error);
                }
            });
    })
    .fail(function()
    {
        defer.reject(new Error('An error occurred while logging into Tidal.'));
    });

    return defer.promise;
}

ControllerTidal.prototype.getTrack = function(id) {
    var self = this;

    var defer=libQ.defer();

    var streamUrl=self.config.get('track_url').replace('ID',id);
    var token=self.config.get('token');
    var countryCode=self.config.get('countryCode');

    var loginDefer=self.logUser();
    loginDefer.then(function() {
        unirest
            .get(streamUrl)
            .query({
                token: token,
                countryCode: countryCode
            })
            .send()
            .end(function (response) {
                if (response.code == 200) {
                    defer.resolve(response.body);
                }
                else {
                    defer.reject(new Error('An error occurred while logging into Tidal.'));
                    self.logger.error('TIDAL LOGIN: ' + response.code + ' ' + response.error);
                }
            });
    })
    .fail(function()
    {
        defer.reject(new Error('Cannot login'));
    });

    return defer.promise;
}

ControllerTidal.prototype.explodeUriSong = function(uri,failDefer) {
    var self=this;

    var defer=libQ.defer();

    var splitted=uri.split('/');
    var id=splitted[3];

    var trackDefer=this.getTrack(id);
    trackDefer.then(function(track)
    {
        console.log("TRACKS: "+JSON.stringify(track));
        var albumart='https://resources.tidal.com/images/'+
            track.album.cover.replace(/-/g,'/')+ '/640x640.jpg';

        var title=track.title;
        if(track.eplicit==true)
            title=title+' [EXPLICIT]';

        var response={
            uri: uri,
            service: 'tidal',
            name: title,
            title: title,
            artist: track.artist.name,
            album: track.album.title,
            type: 'track',
            tracknumber: track.trackNumber,
            albumart: albumart,
            duration: track.duration,
            trackType: 'Tidal',
            samplerate:'44 KHz',
            bitdepth: '24 bit',
			channels: 2,
        };

        console.log("ADDING RESPONSE");
        defer.resolve(response);
    })
    .fail(function()
    {
        if(failDefer===undefined || failDefer===true)
            defer.reject(new Error('Cannot explode Uri song '+uri));
        else defer.resolve();
    });

    return defer.promise;
}

ControllerTidal.prototype.explodeUri = function(uri) {
    var self = this;

    var defer=libQ.defer();

    var splitted=uri.split('/');

    var defers=[];

    if(uri.startsWith('tidal://song/'))
    {
        defers.push(this.explodeUriSong(uri));
    }
    else if(uri.startsWith('tidal://new/playlists/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_PLAYLIST_WAIT']);
        defers.push(this.explodePlaylist(uri,5));
    }
    else if(uri.startsWith('tidal://new/albums/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_ALBUM_WAIT']);
        defers.push(this.explodeAlbum(uri,5));
    }
    else if(uri.startsWith('tidal://playlists/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_PLAYLIST_WAIT']);
        defers.push(this.explodePlaylist(uri,4));
    }
    else if(uri.startsWith('tidal://genres/') && uri.indexOf('playlists')>0)
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_PLAYLIST_WAIT']);
        defers.push(this.explodePlaylist(uri,5));
    }
    else if(uri.startsWith('tidal://rising/albums/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_ALBUM_WAIT']);
        defers.push(this.explodeAlbum(uri,4));
    }
    else if(uri.startsWith('tidal://genres/') && uri.indexOf('albums')>0)
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_ALBUM_WAIT']);
        defers.push(this.explodeAlbum(uri,5));
    }
    else if(uri.startsWith('tidal://album/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_ALBUM_WAIT']);
        defers.push(this.explodeAlbum(uri,3));
    }
    else if(uri.startsWith('tidal://playlist/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_PLAYLIST_WAIT']);
        defers.push(this.explodePlaylist(uri,3));
    }
    else if(uri.startsWith('tidal://mymusic/albums/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_PLAYLIST_WAIT']);
        defers.push(this.explodeAlbum(uri,4));
    }
    else if(uri.startsWith('tidal://mymusic/artists/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_PLAYLIST_WAIT']);
        defers.push(this.explodeAlbum(uri,5));
    }
    else if(uri.startsWith('tidal://mymusic/playlists/myfavoriteplaylists/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_PLAYLIST_WAIT']);
        defers.push(this.explodePlaylist(uri,5));
    }
    else if(uri.startsWith('tidal://mymusic/playlists/myplaylists/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_PLAYLIST_WAIT']);
        defers.push(this.explodePlaylist(uri,5));
    }

   /* else if(uri.startsWith('tidal://artist/'))
    {
        self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['EXPLODE_PLAYLIST_WAIT']);
        defers.push(this.explodeArtist(uri,3));
    }*/

    libQ.all(defers)
        .then(function(results){
            defer.resolve(results[0]);
        })
        .fail(function()
        {
            defer.reject=(new Error());
        })

    return defer.promise;
};



/*
 listPlaylist=function(curUri,parent,idPos) {


 var listing={
 navigation: {
 prev: {
 uri: parent
 },
 list: []
 }
 };

 for(var i in response.body.items)
 */
ControllerTidal.prototype.explodePlaylist = function(uri,index) {
    var self=this;

    var defer=libQ.defer();


    var listDefer=this.listPlaylist(uri,'',index);
    listDefer.then(function(playlist)
    {
        var defers=[];
        for(var i in playlist.navigation.lists[0].items)
        {
            console.log("Requesting explode of song "+playlist.navigation.lists[0].items[i].uri);
            defers.push(self.explodeUriSong(playlist.navigation.lists[0].items[i].uri,false));
        }

        libQ.all(defers)
            .then(function(results)
            {
                results=results.filter(function(x){return x!=undefined || x!=null});
                console.log("RESULTS IS "+results);
                defer.resolve(results);
            })
            .fail(function(e){
                console.log("RESULTS ERROR: "+e);
                defer.reject(new Error());
            });

    })
        .fail(function()
        {
            defer.reject(new Error());
        });
    return defer.promise;
}

ControllerTidal.prototype.explodeAlbum = function(uri,index) {
    var self=this;

    var defer=libQ.defer();


    var listDefer = this.listAlbum(uri,'tidal://new/albums/new',index);
    listDefer.then(function(playlist)
    {
        var defers=[];
        for(var i in playlist.navigation.lists[0].items)
        {
            defers.push(self.explodeUriSong(playlist.navigation.lists[0].items[i].uri));
        }

        libQ.all(defers)
            .then(function(results)
            {
                console.log("RESULTS IS "+results);
                defer.resolve(results);
            })
            .fail(function(e){
                console.log("RESULTS ERROR: "+e);
                defer.reject(new Error());
            });

    })
        .fail(function()
        {
            defer.reject(new Error());
        });
    return defer.promise;
}

ControllerTidal.prototype.explodeArtist = function(uri,index) {
    var self=this;

    var defer=libQ.defer();


    var listDefer = this.listAlbum(uri,'tidal://new/albums/new',index);
    listDefer.then(function(playlist)
    {
        console.log(playlist);
        var defers=[];
        for(var i in playlist.navigation.lists[0].items)
        {
            defers.push(self.explodeUriSong(playlist.navigation.lists[0].items[i].uri));
        }

        libQ.all(defers)
            .then(function(results)
            {
                console.log("RESULTS IS "+results);
                defer.resolve(results);
            })
            .fail(function(e){
                console.log("RESULTS ERROR: "+e);
                defer.reject(new Error());
            });

    })
        .fail(function()
        {
            defer.reject(new Error());
        });
    return defer.promise;
}

/**
 * CONNECTION HANDLING METHODS
 **/
ControllerTidal.prototype.logUser = function () {
    var self=this;
    var defer=libQ.defer();

    if(self.isLoggedIn())
        defer.resolve();
    else
    {

        var username=self.config.get('username');
        var password=self.config.get('password');

        if(username === '' || password === '')
        {
            self.commandRouter.pushToastMessage('error',self.i18n['TIDAL']['LOGIN_NOT_CONFIGURED']);
            defer.reject(new Error());
        }
        else
        {
            self.logger.info("Logging user into Tidal");

            self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LOGGING_IN']);
            self.connectToTidalServer()
                .then(self.retrieveUserProfile.bind(self))
                .then(function()
                {
                    self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LOGIN_SUCCESS']);
                    defer.resolve();

                    var respconfig = self.commandRouter.getUIConfigOnPlugin('system_controller', 'networkfs', '');

                    respconfig.then(function(config)
                    {
                        self.commandRouter.broadcastMessage('pushUiConfig', config);
                    });
                })
                .fail(function()
                {
                    self.commandRouter.pushToastMessage('error',self.i18n['TIDAL']['LOGIN_FAIL']);
                    defer.reject(new Error());
                });
        }

        var bs = {name: 'TIDAL', uri: 'tidal://',plugin_type:'music_service',plugin_name:'tidal'};
        self.commandRouter.musicLibrary.addToBrowseSources(bs);

    }
    return defer.promise;
}

ControllerTidal.prototype.logOut = function () {
    var self=this;
    var defer=libQ.defer();

    self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LOGGING_OUT']);
    self.logger.info("Logging out from TIDAL");

    var logoutUrl=self.config.get('logout_url');
    var sessionId=self.config.get('sessionId');

    unirest
        .post(logoutUrl)
        .send({
            sessionId: sessionId
        })
        .end(function (response) {
            console.log(response.body);
            if (response.code >= 200 && response.code <300) {
                defer.resolve();

                self.config.delete('sessionId');
                self.config.delete('validUntil');

                self.logger.info('Successfully logged out from Tidal');
                self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LOGOUT_SUCCESS']);

                var respconfig = self.commandRouter.getUIConfigOnPlugin('system_controller', 'networkfs', '');

                respconfig.then(function(config)
                {
                    self.commandRouter.broadcastMessage('pushUiConfig', config);
                });

                self.commandRouter.musicLibrary.removeBrowseSource('TIDAL');


            }
            else
            {
                defer.reject(new Error('An error occurred while logging out from Tidal.'));
                self.logger.error('TIDAL LOGOUT: '+response.code+' '+response.error);
                self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LOGOUT_FAIL']);

            }
        });


    return defer.promise;
}


ControllerTidal.prototype.connectToTidalServer = function () {
    var self = this;

    var defer=libQ.defer();

    self.logger.info("Logging into Tidal");

    var loginUrl=self.config.get('login_url');
    var token=self.config.get('token');
    var username=self.config.get('username');
    var password=self.config.get('password');

    unirest
        .post(loginUrl)
        .query({
            token: token
        })
        .send({
            username: username,
            password: password
        })
        .end(function (response) {
            console.log(response.body);
            if (response.code == 200) {
                /**
                 * EXAMPLE
                 * {"userId":37222116,"sessionId":"4b4268c1-92a4-4227-9581-61b693ccadc5","countryCode":"US"}
                 */
                defer.resolve(response.body);

                self.config.addConfigValue('userId','string',response.body.userId);
                self.config.addConfigValue('sessionId','string',response.body.sessionId);
                self.config.addConfigValue('countryCode','string',response.body.countryCode);

                self.logger.info('Successfully logged into Tidal');
            }
            else
            {
                defer.reject(new Error('An error occurred while logging into Tidal.'));
                self.logger.error('TIDAL LOGIN: '+response.code+' '+response.error);
            }
        });

    return defer.promise;
};

ControllerTidal.prototype.retrieveUserProfile = function (data) {
    var self = this;

    var defer=libQ.defer();

    self.logger.info("Retrieving user profile");

    var subscriptionUrl=self.config.get('subscription_url');
    var url=subscriptionUrl.replace('USERID',data.userId);

    var token=self.config.get('token');

    unirest
        .get(url)
        .headers({
            'X-Tidal-Token': token,
            'X-Tidal-SessionId': data.sessionId
        })
        .end(function (response) {
            console.log(response.body);

            if (response.code == 200) {
                /**
                 * EXAMPLE
                 * { validUntil: '2016-09-06T10:25:21.684+0000',
                      status: 'ACTIVE',
                      subscription: { type: 'HIFI', offlineGracePeriod: 30 },
                      highestSoundQuality: 'LOSSLESS',
                      premiumAccess: true,
                      canGetTrial: true,
                      paymentType: 'NONE' }
                 */
                defer.resolve(response.body);

                self.config.addConfigValue('validUntil','string',response.body.validUntil);
                self.config.addConfigValue('highestSoundQuality','string',response.body.highestSoundQuality);

                self.logger.info('Successfully retrieve subscription from Tidal');
            }
            else
            {
                defer.reject(new Error('An error occurred while getting subscription info from Tidal.'));
                self.logger.error('TIDAL SUBSCRIPTION: '+response.code+' '+response.error);
            }
        });

    return defer.promise;
};




ControllerTidal.prototype.clearAddPlayTrack = function(track) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerTidal::clearAddPlayTrack');

    var defer=libQ.defer();

    self.getStreamUrl(track.uri)
        .then(function(track)
        {
            return self.mpdPlugin.sendMpdCommand('stop',[])
                .then(function()
                {
                    return self.mpdPlugin.sendMpdCommand('clear',[]);
                })
                .then(function(stream)
                {
                    return self.mpdPlugin.sendMpdCommand('load "'+track.uri+'"',[]);
                })
                .fail(function (e) {
                    return self.mpdPlugin.sendMpdCommand('add "'+track.uri+'"',[]);
                })
                .then(function()
                {
                    self.commandRouter.stateMachine.setConsumeUpdateService('mpd', true);
                    return self.mpdPlugin.sendMpdCommand('play',[]);
                })
                .fail(function (e) {
                    defer.reject(new Error());
                })
            ;
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        });

    return defer;
};

ControllerTidal.prototype.stop = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerTidal::stop');

    self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
    return self.mpdPlugin.stop();
};


ControllerTidal.prototype.pause = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerTidal::pause');

    // TODO don't send 'toggle' if already paused
    self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
    return self.mpdPlugin.pause();
};


ControllerTidal.prototype.resume = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerTidal::resume');

    // TODO don't send 'toggle' if already playing
    self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
    return self.mpdPlugin.resume();
};

ControllerTidal.prototype.seek = function(position) {
    var self=this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerTidal::seek');

    self.commandRouter.stateMachine.setConsumeUpdateService('mpd', true);
    return self.mpdPlugin.seek(position);
};



/**
 SEARCH
 **/
ControllerTidal.prototype.search = function (query) {
    var self=this;

    var defer=libQ.defer();
    var defers=[];


    defers.push(this.searchType(query,'ARTISTS'));
    defers.push(this.searchType(query,'ALBUMS'));
    defers.push(this.searchType(query,'PLAYLISTS'));
    defers.push(this.searchType(query,'TRACKS'));

    libQ.all(defers)
        .then(function(values)
        {
            var list = [];

            if(values[0])
            {

                list.push(
                    {
                        "title": self.i18n['TIDAL']['SEARCH_ARTIST'],
                        "availableListViews": [
                            "list",
                            "grid"
                        ],
                        "items": values[0]
                    });

            }

            if(values[1])
            {
                list.push({
                    "title": self.i18n['TIDAL']['SEARCH_ALBUMS'],
                    "availableListViews": [
                        "list",
                        "grid"
                    ],
                    "items": values[1]
                });
            }

            if(values[2])
            {
                list.push({
                    "title": self.i18n['TIDAL']['SEARCH_PLAYLIST'],
                    "availableListViews": [
                        "list",
                        "grid"
                    ],
                    "items": values[2]
                });
            }

            if(values[3])
            {
                list.push({
                    "title": self.i18n['TIDAL']['SEARCH_TRACKS'],
                    "availableListViews": [
                        "list",
                        "grid"
                    ],
                    "items": values[3]
                });
            }

            defer.resolve(list);
        })

    return defer.promise;
}

ControllerTidal.prototype.searchType = function (query,type) {
    var self=this;

    var defer=libQ.defer();
    var searchurl=self.config.get('search_url');
    var countryCode=self.config.get('countryCode');
    var token=self.config.get('token');
    var sessionId=self.config.get('sessionId');

    console.log("SEARCH TYPE "+type);
    unirest
        .get(searchurl)
        .headers({
            'X-Tidal-Token': token,
            'X-Tidal-SessionId': sessionId
        })
        .query(
            {
                query:query.value,
                types:type,
                countryCode:countryCode,
                limit:10
            }
        )
        .end(function (response) {
            console.log("TYPE "+type+ "RESPONSE "+response.code);
            if (response.code == 200) {
                var queryResponse=[];

                if(type==='ALBUMS')
                {
                    for(var i in response.body.albums.items)
                    {
                        var item=response.body.albums.items[i];

                        var albumart;

                        if(item.cover!==undefined && item.cover!==null)
                            albumart='https://resources.tidal.com/images/'+
                                item.cover.replace(/-/g,'/')+ '/640x640.jpg';
                        else albumart='/albumart';

                        var result = {
                            service: 'tidal',
                            type: 'folder',
                            title: item.title,
                            albumart: albumart,
                            uri: 'tidal://search/'+query.value+'/album/'+item.id
                        };

                        queryResponse.push(result);

                    }
                }
                else if(type==='ARTISTS')
                {
                    for(var i in response.body.artists.items)
                    {
                        var item=response.body.artists.items[i];

                        var albumart;

                        if(item.picture!==undefined && item.picture!==null)
                            albumart='https://resources.tidal.com/images/'+
                                item.picture.replace(/-/g,'/')+ '/480x480.jpg';
                        else albumart='/albumart';

                        var result = {
                            service: 'tidal',
                            type: 'folder',
                            title: item.name,
                            albumart: albumart,
                            uri: 'tidal://search/'+query.value+'/artist/'+item.id
                        };

                        queryResponse.push(result);

                    }

                }
                else if(type==='PLAYLISTS')
                {
                    for(var i in response.body.playlists.items)
                    {
                        var item=response.body.playlists.items[i];

                        var albumart;

                        if(item.image!==undefined && item.image!==null)
                            albumart='https://resources.tidal.com/images/'+
                                item.image.replace(/-/g,'/')+ '/640x428.jpg';
                        else albumart='/albumart';

                        var result = {
                            service: 'tidal',
                            type: 'folder',
                            title: item.title,
                            albumart: albumart,
                            uri: 'tidal://search/'+query.value+'/playlist/'+item.uuid
                        };

                        queryResponse.push(result);

                    }

                }
                else if(type==='TRACKS')
                {
                    for(var i in response.body.tracks.items)
                    {
                        var item=response.body.tracks.items[i];

                        var albumart;

                        if(item.album!==undefined && item.album.cover!==undefined && item.album.cover!==null)
                            albumart='https://resources.tidal.com/images/'+
                                item.album.cover.replace(/-/g,'/')+ '/640x640.jpg';
                        else albumart='/albumart';

                        var result = {
                            service: 'tidal',
                            type: 'song',
                            title: item.title,
                            albumart: albumart,
                            uri: 'tidal://song/'+item.id
                        };

                        queryResponse.push(result);

                    }

                }

                defer.resolve(queryResponse);
            }
            else
            {
                defer.reject(new Error('An error occurred while getting subscription info from Tidal.'));
                self.logger.error('TIDAL SUBSCRIPTION: '+response.code+' '+response.error);
            }
        });
    return defer.promise;
}


ControllerTidal.prototype.listMyMusic = function (url,parent,templateResponseUri,type) {
    var self = this;

    var defer=libQ.defer();

    var token=self.config.get('token');
    var sessionId=self.config.get('sessionId');
    var countryCode=self.config.get('countryCode');

    var loginDefer=self.logUser();
    loginDefer.then(function()
    {
        unirest
            .get(url)
            .headers({
                'X-Tidal-Token': token,
                'X-Tidal-SessionId': sessionId
            })
            .query(
                {
                    'order':'NAME',
                    'orderDirection':'ASC',
                    'countryCode':countryCode
                }
            )
            .end(function (response) {

                if (response.code == 200) {

                    var listing={
                        "navigation": {
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list",
                                        "grid"
                                    ],
                                    "items": [

                                    ]
                                }
                            ],
                            "prev": {
                                "uri": parent
                            }
                        }
                    };

                    for(var i in response.body.items)
                    {
                        var item;

                        if(response.body.items[i].item!==undefined)
                            item=response.body.items[i].item;
                        else item=response.body.items[i];

                        var albumart;

                        if(item.album !==undefined && item.album.cover !==undefined && item.album.cover !==null)
                            albumart='https://resources.tidal.com/images/'+
                                item.album.cover.replace(/-/g,'/')+ '/640x640.jpg';
                        else if(item.cover !==undefined)
                            albumart='https://resources.tidal.com/images/'+
                                item.cover.replace(/-/g,'/')+ '/320x320.jpg';
                        else if(item.picture !==undefined)
                            albumart='https://resources.tidal.com/images/'+
                                item.picture.replace(/-/g,'/')+ '/320x214.jpg';
                        else if(item.image !==undefined)
                            albumart='https://resources.tidal.com/images/'+
                                item.image.replace(/-/g,'/')+ '/320x214.jpg';
                        else albumart='/albumart';

                        var artist;

                        if(item.artist)
                            artist=item.artist.name;

                        var album;
                        if(item.album)
                            album=item.album.title;

                        var title;
                        if(item.title)
                            title=item.title;
                        else title=item.name;

                        var id;
                        if(item.id)
                            id=item.id;
                        else id=item.uuid;

                        listing.navigation.lists[0].items.push({
                            service: 'tidal',
                            type: type,
                            title: title,
                            artist: artist,
                            album: album,
                            albumart: albumart,
                            uri: templateResponseUri.replace('ID',id)
                        });
                    }

                    defer.resolve(listing);
                }
                else if (response.code == 404) {
                    self.commandRouter.pushToastMessage('success',self.i18n['TIDAL']['LISTING_NO_RESULTS']);

                    var listing={
                        "navigation": {
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list"
                                    ],
                                    "items": [

                                    ]
                                }
                            ],
                            "prev": {
                                "uri": parent
                            }
                        }
                    };

                    defer.resolve(listing);

                }
                else
                {
                    defer.reject(new Error('An error occurred while logging into Tidal.'));
                }
            });
    }).fail(function()
    {
        defer.reject(new Error('Cannot login'));
    });

    return defer.promise;
};

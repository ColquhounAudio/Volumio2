var libQ = require('kew');
var libFast = require('fast.js');
var fs=require('fs-extra');
var exec = require('child_process').exec;
var io=require('socket.io-client');
var Inotify = require('inotify').Inotify;
var ifconfig = require('wireless-tools/ifconfig');
var nodetools=require('nodetools');
var ip = require('ip');
var pidof = require('pidof');
var spawn = require('child_process').spawn;
var execSync = require('child_process').execSync;
var runInShell = require('child_process').exec;


// Define the ControllerSystem class
module.exports = Airplay2;

function Airplay2(context) {
    var self = this;
    // Save a reference to the parent commandRouter
    self.context=context;
    self.logger=self.context.logger;
    self.commandRouter = self.context.coreCommand;

    self.inotify = new Inotify();

    self.config=new (require('v-conf'))();

    self.mpdRunning=true;
    self.currentVolume=20;
    self.scheduled=false;

    self.playbackTimeRunning=false;
    self.volumeCommandTimer=null;

    // 01/06/2018: Afrodita Kujumdzieva -  Set trackType to 'airplay' because it is needed by the volume manager to disable volume controls. 
    // 20180516- Emre Ozkan disableUiControls code added
    self.obj={
        status: 'play',
        service:'airplay',
        title: '',
        artist: '',
        album: '',
        albumart: '/albumart',
        uri: '',
        trackType: 'airplay',
        seek: 0,
        duration: 0,
        samplerate: '',
        bitdepth: '',
        channels: 2,
	disableUiControls: true
    };
}

Airplay2.prototype.onVolumioStart = function() {
    var self = this;

    self.logger.info("AirPlay Plugin booting up..");

    var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');
    self.config.loadFile(configFile);

    var boundMethod=self.onPlayerNameChanged.bind(self);
    self.commandRouter.executeOnPlugin('system_controller','system','registerCallback',boundMethod);

    //self.startAirplayd();

    return libQ.resolve();
}

Airplay2.prototype.onPlayerNameChanged=function(playerName) {
    var self = this;

    self.logger.debug("Saving playerName");
}

Airplay2.prototype.startAirplayd=function(playerName) {
    var self = this;
}

Airplay2.prototype.Progress=function(data){
    var self=this;

    try
    {

            if(data.elapsed){
                self.obj.seek = Math.floor(parseFloat(data.elapsed)*1000);
            }

            if(data.duration){
                self.obj.duration = Math.floor(parseFloat(data.duration));
            }

      
            console.log(self.obj.seek)
                if (self.obj.seek < 2300) {
                    self.obj.seek = 0;
                }
            console.log(self.obj.seek)
            self.commandRouter.servicePushState(self.obj, 'airplay');

    }
    catch(error)
    {
    }
}



Airplay2.prototype.MetaData=function(data){
    var self=this;

    try
    {


                if (data.title) {
                    self.obj.title = data.title;
                }

                if (data.artist) {
                    self.obj.artist = data.artist;
                }

                if (data.album) {
                    self.obj.album = data.album;
                }

                if (data.artwork_file) {
		    var random = Math.floor((Math.random() * 100000) + 1);
		    self.obj.albumart = '/albumart?web=' + random + '/extralarge&path=' + data.artwork_file;
                }

                self.commandRouter.servicePushState(self.obj, 'airplay');

    }
    catch(error)
    {
    }
}

Airplay2.prototype.Volume=function(data){
    var self=this;

    try {
	    if(self.scheduled==true)
	    {
		clearTimeout(self.volumeCommandTimer);
                self.scheduled=false;
	    }
            if(self.scheduled==false)
            {
                self.volumeCommandTimer=setTimeout(function()
                {
                  self.commandRouter.volumiosetvolume(parseInt(data.volume));
                    self.scheduled=false;
                },150);

                self.scheduled=true;
	    }
    }
    catch(error)
    {
        self.logger.info(err);
    }
}




Airplay2.prototype.Playing=function(data){
    var self=this;

    try {
        if(data.status=="1")
        {
            self.logger.info("Airplay started streaming");

            self.obj.status='play';
            //self.obj.title="";
            //self.obj.artist="";
            //self.obj.album="";
            //self.obj.seek=0;
            //self.obj.duration=0;
            //self.obj.albumart="/albumart";
            self.undock();
            self.commandRouter.stateMachine.setVolatile({
                service:"airplay",
                callback: self.dock.bind(self)
            });
		
            self.startPlaybackTimer();
        } else  {
            self.logger.info("Airplay stopped playing.");
			//self.obj.status='stop';
            self.stopPlaybackTimer();
        }
        self.commandRouter.servicePushState(self.obj, 'airplay');

    }
    catch(error)
    {

    }
}


Airplay2.prototype.getConfigurationFiles = function()
{
    var self = this;

    return ['config.json'];
}

Airplay2.prototype.getAlbumArt=function(data,path)
{
    var self=this;

    var defer=libQ.defer();

    ifconfig.status('wlan0', function(err, status) {
        var address;

        if (status != undefined) {
            if (status.ipv4_address != undefined) {
                address = status.ipv4_address;
            }
            else address = ip.address();
        }
        else address= ip.address();

        var url;
        var artist,album;



        var web;

        if(data!= undefined && data.artist!=undefined)
        {
            artist=data.artist;
            if(data.album!=undefined) {
                album=data.album;
            } else {
                album = data.artist;
            }
            web='?web='+nodetools.urlEncode(artist)+'/'+nodetools.urlEncode(album)+'/extralarge'
        }

        var url='/albumart';

        if(web!=undefined){
            url=url+web;
        }
        if(web!=undefined && path != undefined){
            url=url+'&';
        } else if(path != undefined) {
            url = url + '?';
        }
        if(path!=undefined){
            url=url+'path='+nodetools.urlEncode(path);
        }
        defer.resolve(url);
    });


    return defer.promise;
}

Airplay2.prototype.pushAirplay=function(isAirplay)
{
    var self=this;

    self.commandRouter.pushAirplay(isAirplay);

}

Airplay2.prototype.dock2=function()
{
    var self=this;
    /*
    self.logger.info("AIRPLAY: Docking");
    execSync('/bin/echo DOCK > /tmp/airplaybus', {uid: 1000, gid: 1000});
    setTimeout(function(){
        //self.undock();
    }, 1000)*/
}
Airplay2.prototype.dock=function()
{
	var self=this;

	self.logger.info("AIRPLAY: Docking");
	execSync('/bin/echo DOCK > /tmp/airplay2bus', {uid: 1000, gid: 1000});
    setTimeout(function(){
    //self.undock();
    }, 1000)
}

Airplay2.prototype.undock=function()
{
	var self=this;

	self.logger.info("AIRPLAY: Un-Docking");
	execSync('/bin/echo UNDOCK > /tmp/airplay2bus', {uid: 1000, gid: 1000})

}


Airplay2.prototype.startPlaybackTimer=function()
{
    var self=this;
    // Marking playback timer as executing
    if(this.playbackTimeRunning==true)
        return ;

   this.playbackTimeRunning=true;
    setTimeout(
        self.incrementSeek.bind(self),250
    );
}

Airplay2.prototype.incrementSeek=function()
{
    var self=this;
    this.obj.seek+=250;

    if(this.playbackTimeRunning==true)
    {
        setTimeout(
            self.incrementSeek.bind(self),250
        );
    }
}

Airplay2.prototype.stopPlaybackTimer=function()
{
    this.playbackTimeRunning=false;
}


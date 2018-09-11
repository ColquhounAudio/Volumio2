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
var Gpio = require('onoff').Gpio;
var runInShell = require('child_process').exec;


//20180628-Emre Ozkan defining the pins for leds and externals toggle switch pins 
var inputSwitchBit0 = new Gpio(5, 'out');
var inputSwitchBit1 = new Gpio(6, 'out');
var opticalIndicatorLed = new Gpio(506, 'out');
var analogIndicatorLed = new Gpio(505, 'out');
var internalIndicatorLed = new Gpio(504, 'out');


// Define the ControllerSystem class
module.exports = AirplayEmulation;

function AirplayEmulation(context) {
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

AirplayEmulation.prototype.onVolumioStart = function() {
    var self = this;

    self.logger.info("AirPlay Plugin booting up..");

    var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');
    self.config.loadFile(configFile);

    self.statusFile=self.config.get('statusFile');
    self.songFile=self.config.get('songFile');
    self.progressFile=self.config.get('progressFile');
    self.busFile=self.config.get('busFile');
    self.volumeFile=self.config.get('volumeFile');

    self.statusWatch=self.addWatch(self.statusFile,self.statusCallback.bind(self));
    //self.songWatch=self.addWatch(self.songFile,self.songCallback.bind(self));
    self.volumeWatch=self.addWatch(self.volumeFile,self.volumeCallback.bind(self));
    self.progressWatch=self.addWatch(self.progressFile,self.progressCallback.bind(self));
    //self.busWatch=self.addWatch(self.busFile,self.busCallback.bind(self));

    var boundMethod=self.onPlayerNameChanged.bind(self);
    self.commandRouter.executeOnPlugin('system_controller','system','registerCallback',boundMethod);

    //self.startAirplayd();

    return libQ.resolve();
}

AirplayEmulation.prototype.onPlayerNameChanged=function(playerName) {
    var self = this;

    self.logger.debug("Saving playerName");
    exec("/usr/bin/sudo /bin/chmod 777 /etc/airplayd/airplayname", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            console.log('Canot set permissions for /etc/hosts: ' + error);

        } else {
 
	    fs.writeFile('/etc/airplayd/airplayname', playerName, function (err) {
		if (err) {
		    console.log(err);
		}
		else {
		    setTimeout(function () {
			exec('/usr/bin/killall -HUP airplayd', {
			    uid: 1000,
			    gid: 1000
			}, function (error, stdout, stderr) {
			    if (error !== null) {
				console.log(error);
			    } else {
				self.logger.info('Airplay name changed to '+ playerName+' and Daemon Restarted')
			    }
			});
		    }, 1000)
		}
	    });
	}
    });
    var avahiconf = '<?xml version="1.0" standalone="no"?><service-group><name replace-wildcards="yes">'+ playerName +'</name><service><type>_http._tcp</type><port>80</port></service></service-group>';
    exec("/usr/bin/sudo /bin/chmod 777 /etc/avahi/services/volumio.service", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            console.log('Canot set permissions for /etc/hosts: ' + error);

        } else {
            self.logger.info('Permissions for /etc/avahi/services/volumio.service')
            fs.writeFile('/etc/avahi/services/volumio.service', avahiconf, function (err) {
                if (err) {
                    console.log(err);
                } else {
                    self.logger.info('Avahi name changed to '+ playerName)

                }
            });
            }

    });
}

AirplayEmulation.prototype.startAirplayd=function(playerName) {
    var self = this;
    var name;

    if(playerName!=undefined)
        name=playerName;
    else
    {
        var systemController = self.commandRouter.pluginManager.getPlugin('system_controller', 'system');
        name = systemController.getConf('playerName');
    }

    var cmd = '/usr/local/bin/airplayd "' + name + '"';

    self.logger.debug("Starting airplayd with command "+cmd);
    spawn('/usr/local/bin/airplayd', ["Axiomaria"], { uid: 1000,gid:1000});
}


AirplayEmulation.prototype.addWatch=function(file,callback){
    var self=this;

    self.logger.info("Adding watch for file "+file);
    var watch = {
        path: file,
        watch_for: Inotify.IN_MODIFY,
        callback: callback
    };

    fs.ensureFileSync(file);
    self.inotify.addWatch(watch);

    return watch;
}

AirplayEmulation.prototype.volumeCallback=function(){
    var self=this;

    try {
        fs.readFile(self.volumeFile, function(err,content)
        {
            self.currentVolume=parseInt(content);
            if(self.scheduled==false)
            {
                setTimeout(function()
                {
                    self.commandRouter.volumiosetvolume(self.currentVolume);
                    self.scheduled=false;
                },150);

                self.scheduled=true;
            }
        });
    }
    catch(error)
    {
        self.logger.info(err);
    }
}

AirplayEmulation.prototype.progressCallback=function(){
    var self=this;

    try
    {

        var content2 = fs.readJsonSync(self.progressFile);
        if(content2!=null)  {
            if(content2.elapsed){
                self.obj.seek = parseInt(content2.elapsed)*1000;
            }

            if(content2.total){
                self.obj.duration=content2.total;
            }

        }

        var content = fs.readJsonSync(self.songFile);

                if (content.title) {
                    self.obj.title = content.title;
                } else {
                    self.obj.title = '';
                }

                if (content.artist) {
                    self.obj.artist = content.artist;
                } else {
                    self.obj.artist = '';
                }

                if (content.album) {
                    self.obj.album = content.album;
                } else {
                    self.obj.album = '';
                }

                if (content.albumart) {
                    var random = Math.floor((Math.random() * 100000) + 1);
                    self.obj.albumart = '/albumart?web=' + random + '/extralarge&path=' + content.albumart;
                } else {
                    self.obj.albumart = '/albumart';
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

AirplayEmulation.prototype.statusCallback=function(){
    var self=this;

    try {
        var content = fs.readJsonSync(self.statusFile);

        if (content.status == 'prepared') {
			this.commandRouter.stateMachine.setConsumeUpdateService(undefined);
			try {
                execSync('/usr/bin/mpc stop', {uid: 1000, gid: 1000})
		//20180628-Emre Ozkan Modal close command added here.
		self.commandRouter.executeOnPlugin('system_controller', 'gpio-buttons', 'switchOffExtInput');



            } catch (e) {

            }

            self.logger.info("Airplay daemon has setup and waits for streaming start. Shutting down MPD and setting up alsa");

			self.commandRouter.volumioStop()
                .then(function()
                {

                    self.setMrSingle();
					try {
						execSync("/usr/bin/mpc stop", { uid: 1000, gid: 1000, encoding: 'utf8'});
					} catch (e){

					}


                });
        }
        else if (content.status == 'playing') {
            self.logger.info("Airplay started streaming");

            self.obj.status='play';
            self.obj.title="";
            self.obj.artist="";
            self.obj.album="";
            self.obj.seek=0;
            self.obj.duration=0;
            self.obj.albumart="/albumart";
            self.undock();
            self.commandRouter.stateMachine.setVolatile({
                service:"airplay",
                callback: self.dock.bind(self)
            });
		
            self.startPlaybackTimer();
        }
        else if (content.status == 'stopped') {
            self.logger.info("Airplay stopped playing.");
			//self.obj.status='stop';
            //self.commandRouter.stateMachine.unSetVolatile();
            //self.commandRouter.servicePushState(self.status, 'airplay');
			//self.commandRouter.volumioStop();
            self.stopPlaybackTimer();
        }
        else if (content.status == 'closed') {
            self.logger.info("Airplay closed streaming");

            self.stopPlaybackTimer();
            self.commandRouter.stateMachine.unSetVolatile();
            self.commandRouter.stateMachine.resetVolumioState().then(
                self.commandRouter.volumioStop.bind(self.commandRouter));
        }
        else {
            self.commandRouter.stateMachine.unSetVolatile();
        }

        self.commandRouter.servicePushState(self.obj, 'airplay');

    }
    catch(error)
    {

    }
}

AirplayEmulation.prototype.songCallback=function(){
    var self=this;

    setTimeout(function(){

    try
    {
        fs.readJson(self.songFile,function(err,content) {
            /*
             if (content.artist && content.album) {
             var metas = {'artist' : content.artist, 'album' :content.album } ;
             var promise=self.getAlbumArt(metas,content.albumart);
             } else if (content.artist){
             var metas = {'artist': content.artist};
             var promise=self.getAlbumArt(metas,content.albumart);
             } else {
             var promise=self.getAlbumArt({},content.albumart);
             }
             */
            //console.log(content)


            if (content.title) {
                self.obj.title = content.title;
            } else {
                self.obj.title = '';
            }

            if (content.artist) {
                self.obj.artist = content.artist;
            } else {
                self.obj.artist = '';
            }

            if (content.album) {
                self.obj.album = content.album;
            } else {
                self.obj.album = '';
            }

            if (content.albumart) {
                var random = Math.floor((Math.random() * 100000) + 1);
                self.obj.albumart = '/albumart?web=' + random + '/extralarge&path=' + content.albumart;
            } else {
                self.obj.albumart = '/albumart';
            }

            self.commandRouter.servicePushState(self.obj, 'airplay');
        });

    }
    catch(error)
    {
    }
}, 300)

}

AirplayEmulation.prototype.busCallback=function(){
    var self=this;
}

AirplayEmulation.prototype.shutdownMpd = function()
{
    var self = this;

    self.logger.info("Killing MPD");
    var cmd="sudo /usr/sbin/service mpd stop";

    exec(cmd,function (error, stdout, stderr) {
        if(error)
            self.logger.error("Got an error killing MPD. Details: "+error);
    });



    self.mpdRunning=false;

    self.pushAirplay(true);
}

AirplayEmulation.prototype.setAnalogOff = function()
{
    var self = this;

    self.logger.info("Setting Analog Input OFF");
    self.commandRouter.executeOnPlugin('system_controller', 'gpios', 'stopAnalogInputAir', '');
}

AirplayEmulation.prototype.setMrSingle = function()
{
    var self = this;

    self.logger.info("Setting Multiroom Device to Single");
    self.commandRouter.executeOnPlugin('audio_interface', 'multiroom', 'setMultiroomSingle', '');
}

AirplayEmulation.prototype.getConfigurationFiles = function()
{
    var self = this;

    return ['config.json'];
}

AirplayEmulation.prototype.getAlbumArt=function(data,path)
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

AirplayEmulation.prototype.pushAirplay=function(isAirplay)
{
    var self=this;

    self.commandRouter.pushAirplay(isAirplay);

}

AirplayEmulation.prototype.dock2=function()
{
    var self=this;
    /*
    self.logger.info("AIRPLAY: Docking");
    execSync('/bin/echo DOCK > /tmp/airplaybus', {uid: 1000, gid: 1000});
    setTimeout(function(){
        //self.undock();
    }, 1000)*/
}
AirplayEmulation.prototype.dock=function()
{
	var self=this;

	self.logger.info("AIRPLAY: Docking");
	execSync('/bin/echo DOCK > /tmp/airplaybus', {uid: 1000, gid: 1000});
    setTimeout(function(){
    //self.undock();
    }, 1000)
}

AirplayEmulation.prototype.undock=function()
{
	var self=this;

	self.logger.info("AIRPLAY: Un-Docking");
	execSync('/bin/echo UNDOCK > /tmp/airplaybus', {uid: 1000, gid: 1000})

}


AirplayEmulation.prototype.startPlaybackTimer=function()
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

AirplayEmulation.prototype.incrementSeek=function()
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

AirplayEmulation.prototype.stopPlaybackTimer=function()
{
    this.playbackTimeRunning=false;
}


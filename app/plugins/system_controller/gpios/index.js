var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
var fs=require('fs-extra');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var ip = require('ip');
//var iwconfig = require('./lib/iwconfig.js');
//var ifconfig = require('./lib/ifconfig.js');
var schedule = require('node-schedule');
var sleep = require('sleep');

//GPIO definitions
var Gpio = require('onoff').Gpio,
	shutdownDetect = new Gpio(4, 'in', 'falling'),
	//wirelessLed = new Gpio(26, 'low'),
	lowBattery = new Gpio(22, 'in', 'both'),
	lowBatteryLEDCheck = new Gpio(17, 'in', 'both'),
	RedLEDGpio = new Gpio(23, 'low'),
	//BlueLEDGpio = new Gpio(26, 'low'),
	MusicPlus = new Gpio(24, 'low'),
	MusicMinus = new Gpio(25, 'low'),
	MicPlus = new Gpio(5, 'low'),
	MicMinus= new Gpio(12, 'low'),
	KaraokeSwitch = new Gpio(13, 'low');

var DASwitch;
var karaoke = 'off';

var analogFile = '/data/configuration/analog_input';


// Define the ControllerSystem class
module.exports = ControllerGpio;

function ControllerGpio(context) {
	var self = this;
	// Save a reference to the parent commandRouter
	self.context=context;
	self.commandRouter = self.context.coreCommand;
    self.logger = self.commandRouter.logger;

	self.config=new (require('v-conf'))();
	self.config.loadFile(__dirname+'/config.json');


	self.wifiAbsentAdvertise=false;

}


ControllerGpio.prototype.onVolumioStart = function() {
	var self = this;

	setTimeout(function () {
  self.gpioinit();
}, 6000)

}


ControllerGpio.prototype.onStart = function() {
	var self = this;
	self.gpioWatcher();

    return libQ.resolve();
}



ControllerGpio.prototype.gpioWatcher = function() {
	var self = this;

//Checking if we need to initiate Shutdown

}

//Watching for shutdown command
shutdownDetect.watch(function (err, value) {
	var self = this;
	if (err) {
		throw err;
	} if (value == 0) {
		shutdownDetect.unexport();
		console.log('Shutdown Button Pressed: shutting down');
		exec("/volumio/app/plugins/system_controller/gpios/axiomshutdown.sh", function (error, stdout, stderr) {
			if (error !== null) {
				console.log('Cannot Initialize shutdown' + error);
			}
			else {
				console.log('Shutting down');
			}
		});
	}
});

lowBattery.watch(function (err, value) {
	var self = this;
	if (err) {
		throw err;
	} if (value == 1) {
		console.log('Low Battery: shutting down');
		exec("/volumio/app/plugins/system_controller/gpios/axiomshutdown.sh", function (error, stdout, stderr) {
			if (error !== null) {
				console.log('Cannot Initialize shutdown' + error);
			}
			else {
				console.log('Low Battery: shutting down');
			}
		});
	}
});

lowBatteryLEDCheck.watch(function (err, value) {
	var self = this;
	if (err) {
		throw err;
	}
	RedLEDGpio.write(value);
	console.log('Low Battery: turning on Warning LED');
});


ControllerGpio.prototype.MusicPlusPress = function() {
	var self = this;

	self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Music +')
	MusicPlus.writeSync(1);
	sleep.usleep(50000);
	MusicPlus.writeSync(0);
}

ControllerGpio.prototype.MusicMinusPress = function() {
	var self = this;

	self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Music -')
	MusicMinus.writeSync(1);
	sleep.usleep(50000);
	MusicMinus.writeSync(0);
}


ControllerGpio.prototype.MicPlusPress = function() {
	var self = this;

	self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Microphone +')
	MicPlus.writeSync(1);
	sleep.usleep(50000);
  MicPlus.writeSync(0);

}

ControllerGpio.prototype.MicMinusPress = function() {
	var self = this;

	self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Microphone -')
	MicMinus.writeSync(1);
	sleep.usleep(50000);
  MicMinus.writeSync(0);
}


ControllerGpio.prototype.startAnalogInput=function() {
    var self=this;



	try {
		fs.accessSync(analogFile, fs.F_OK);
		execSync("/usr/bin/gpio write 22 1", { uid : 1000, gid : 1000, encoding: 'utf8' });

    console.log('Analog Switch has been selected');
    //self.commandRouter.volumioStop();

    //self.commandRouter.stateMachine.unSetVolatile();
		self.commandRouter.pushToastMessage('success', "Analog Input", 'ON');
		setTimeout(function(){
			//self.undock();


    self.commandRouter.stateMachine.setVolatile({
        service: "analogin",
        callback: self.analogcallback.bind(self)
    });
    var status = {};
    status.status = 'play';
    status.service = 'analogin';
    status.title = 'Analog Input';
    status.seek = 0;
    status.duration = 0;
    status.albumart = '/albumart?web=default';
    status.artist = '';
    status.album = '';

    console.log(status)
    self.commandRouter.servicePushState(status, 'analogin');
    //self.commandRouter.executeOnPlugin('music_service', 'airplay_emulation', 'dock', '');

		}, 900)
	} catch (e) {
		execSync("/usr/bin/gpio write 22 0", { uid : 1000, gid : 1000, encoding: 'utf8' });
	}
}


ControllerGpio.prototype.stopAnalogInput = function() {
    var self=this;

	execSync("/usr/bin/gpio write 22 0", { uid : 1000, gid : 1000, encoding: 'utf8' });

    console.log('Analog Switch has been deselected');


    self.commandRouter.stateMachine.unSetVolatile();
    self.commandRouter.stateMachine.pushState();
	self.commandRouter.pushToastMessage('success', "Analog Input", 'OFF');

    /*var status = {};
    status.status = 'stop';
    status.service = 'mpd';
    status.title = '';
    status.seek = 0;
    status.duration = 0;
    status.albumart = '/albumart?web=default';
    status.artist = '';
    status.album = '';

    console.log(status)
    self.commandRouter.servicePushState(status, 'mpd');

/*

    volumioResetState().
        then(function(){


    });*/
}

ControllerGpio.prototype.stopAnalogInputAir = function() {
	var self=this;
	console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAA')

	execSync("/usr/bin/gpio write 22 0", { uid : 1000, gid : 1000, encoding: 'utf8' });
	setTimeout(function(){
	try {
		execSync("rm /data/configuration/analog_input", { uid : 1000, gid : 1000, encoding: 'utf8' });
		console.log('Analog Switch has been deselected');
	} catch (e) {
		console.log('error deleting analog file ');
	}


	}, 1200)


	//self.commandRouter.stateMachine.unSetVolatile();
	self.commandRouter.stateMachine.pushState();
	//self.commandRouter.pushToastMessage('success', "Analog Input", 'OFF');
	fs.unlink('/data/configuration/analog_input',function(err)
	{
		if(err) {
			self.logger.error('An error occurred when deleting the state file for analog input. Details: '+err);
		} else {

		}

	});

	/*var status = {};
	 status.status = 'stop';
	 status.service = 'mpd';
	 status.title = '';
	 status.seek = 0;
	 status.duration = 0;
	 status.albumart = '/albumart?web=default';
	 status.artist = '';
	 status.album = '';

	 console.log(status)
	 self.commandRouter.servicePushState(status, 'mpd');

	 /*

	 volumioResetState().
	 then(function(){


	 });*/
}

ControllerGpio.prototype.DASwitchPress = function() {
	var self=this;


	try {
		fs.accessSync(analogFile, fs.F_OK);
		console.log('File there')
		console.log('NOT ANALOG')
		self.stopAnalogInput();

		try {
			execSync('/bin/rm /data/configuration/analog_input', {uid: 1000, gid: 1000});
			console.log('ANALOG FILE REMOVED')

		} catch(e) {
			console.log('ERROR DELETING ANALOG INPUT FILE')
		}

	} catch (e) {

		console.log('File not there')
		try {
			execSync('/usr/bin/touch /data/configuration/analog_input', {uid: 1000, gid: 1000});
			execSync("/bin/echo DOCK> /tmp/airplaybus" );
			console.log('ANALOG')
			self.startAnalogInput();

		} catch(e) {
			console.log('ERROR CREATING ANALOG INPUT FILE')
		}
	}
}

ControllerGpio.prototype.analogcallback = function() {
	var self = this;


	console.log('CALLBACK: Analog Switch has been deselected');
	self.commandRouter.executeOnPlugin('music_service', 'airplay_emulation', 'undock', '');
    execSync("/usr/bin/gpio write 22 0", { uid : 1000, gid : 1000, encoding: 'utf8' });

        try {
            execSync("rm /data/configuration/analog_input", { uid : 1000, gid : 1000, encoding: 'utf8' });
            console.log('Analog Switch has been deselected');
        } catch (e) {
            console.log('error deleting analog file ');
        }



}

ControllerGpio.prototype.DASwitchSet = function(data) {
	var self=this;
	console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'+data)

    if (data == 'on') {
		fs.outputFile('/data/configuration/analog_input','ON',function(err)
		{
			if(err) {
				self.logger.error('An error occurred when creating the state file for analog input. Details: '+err);
			} else {
				//self.commandRouter.executeOnPlugin('music_service', 'airplay_emulation', 'dock', '');
				self.startAnalogInput();
			}

		});
		} else {
		self.stopAnalogInput();
		fs.unlink('/data/configuration/analog_input',function(err)
		{
			if(err) {
				self.logger.error('An error occurred when deleting the state file for analog input. Details: '+err);
			} else {
				self.commandRouter.pushToastMessage('success', "Analog Input", 'OFF');
			}

		});
		}
}

ControllerGpio.prototype.KaraokeSwitchPress = function(data) {
	var self=this;

    if (data) {
		if (data == 'on') {
			KaraokeSwitch.write(1);
			console.log('Karaoke Switch has been selected');
			karaoke = 'on';
			self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Karaoke Mode ON')
		} else {
			KaraokeSwitch.write(0);
			console.log('Karaoke Switch has been deselected');
			karaoke = 'off';
			self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Karaoke Mode ON')
		}
	} else {
	KaraokeSwitch.read(function (err, value) {
		if (err) {
			throw err;
		} if (value == 0) {
			KaraokeSwitch.write(1);
			console.log('Karaoke Switch has been selected');
			karaoke = 'on';
		} else {
			KaraokeSwitch.write(0);
			console.log('Karaoke Switch has been deselected');
			karaoke = 'off';
		}
	});
	}

	var promise = {
		message : "pushKaraokeStatus",
		payload: karaoke
	};
	console.log(promise);

	return promise
}

ControllerGpio.prototype.gpioinit = function() {
    var self=this;

	execSync("/usr/bin/gpio mode 22 out", { uid : 1000, gid : 1000, encoding: 'utf8' });

	exec("/volumio/app/plugins/system_controller/gpios/gpioinit.sh", {uid:1000, gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
//			self.pushConsoleMessage(error);
		}
		else
        {
            //starting analog input of file is found
            fs.access('/data/configuration/analog_input', fs.constants.F_OK, (err) => {
                if(err)
                {
                    self.stopAnalogInput(self);
                }
                else
                    {
                    self.startAnalogInput(self);
                }
            });
        }
	});

}

ControllerGpio.prototype.getKaraokeStatus = function() {
	var self=this;
	var promise = {
		message : "pushKaraokeStatus",
		payload: karaoke
	};

	return promise
}

ControllerGpio.prototype.softShutdown = function() {
	var self = this;

	shutdownDetect.unexport();
	console.log('Shutdown Button Pressed: shutting down');
	exec("/volumio/app/plugins/system_controller/gpios/axiomshutdown.sh", function (error, stdout, stderr) {
		if (error !== null) {
			console.log('Cannot Initialize shutdown' + error);
		}
		else {
			console.log('Shutting down');
		}
	});
}

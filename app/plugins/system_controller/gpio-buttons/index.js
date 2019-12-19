'use strict';
class dummyIO{
	constructor() {}
	write(any){}
	writeSync(any){}
	read(){}
}

class sleep{
	usleep(micros){
		var millis=micros/1000;
		return new Promise(function (resolve, reject) {
			setTimeout(function () { resolve(); }, millis);
		});
	}
}
// 20180601 RMPickering - This is Plugin GPIO-buttons: index.js

var libQ = require('kew');
var fs = require('fs-extra');
var Gpio = require('onoff').Gpio;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
// 20180601 RMPickering - We will need the 'child_process' module so add it in require section.
// 20180615 RMPickering - Child process is no longer used!
//var runInShell = require('child_process').exec;
var execSync = require('child_process').execSync;
var fs=require('fs');
var legacyKaraoke=true;
var karaokeLevels = { musicLevel : 128 , micLevel : 128 , echoLevel : 128 , KaraokeStatus :   1 , musicStep :   8 , micStep :   8 , echoStep :   8, legacy: true };
var karaokeReadTimer = undefined;
var karaokeReadInterval = undefined;

// The source indicator LEDs
//
//
//
if (fs.existsSync("/sys/class/gpio/gpio506")) {
	var opticalIndicatorLed = new Gpio(506, 'out');
}else{
	var opticalIndicatorLed = new dummyIO();
}

if (fs.existsSync("/sys/class/gpio/gpio505")) {
	var analogIndicatorLed = new Gpio(505, 'out');
}else{
	var analogIndicatorLed = new dummyIO();
}

if (fs.existsSync("/sys/class/gpio/gpio504")) {
	var internalIndicatorLed = new Gpio(504, 'out');
}else{
	var internalIndicatorLed = new dummyIO();
}

if (fs.existsSync("/sys/class/gpio/gpio508")) {
	var RedLEDGpio = new Gpio(508, 'low');
}else{
	var RedLEDGpio = new Gpio(23, 'low');
}

//if (fs.existsSync("/dev/lirc0")) {
//	var MusicPlus = new dummyIO();
//	var MusicMinus = new dummyIO();
//	var MicPlus = new dummyIO();
//	var MicMinus= new dummyIO();
//}else{
	var MusicPlus = new Gpio(24, 'low');
	var MusicMinus = new Gpio(25, 'low');
	var MicPlus = new Gpio(5, 'low');
	var MicMinus= new Gpio(12, 'low');
//}



var actions = ["playPause", "volumeUp", "volumeDown", "previous", "next", "shutdown"];
var pins = [];

// RMPickering - These toggle switches to be used to switch the DAC input between Pi, Optical, and RCA Analog - hardcoded to pins 5 & 6 for now! (Assuming the pins being set are using BCM pin numbering rather than physical pin numbers.)
var inputSwitchBit0 = new Gpio(5, 'out');
var inputSwitchBit1 = new Gpio(6, 'out');
var KaraokeSwitch = new Gpio(13, 'low');

var lowBattery = new Gpio(22, 'in', 'both');
var lowBatteryLEDCheck = new Gpio(17, 'in', 'both');

// RMPickering - Both switch pins are initialized to zero in a startup routine (outside JavaScript) already!

// 20180524 RMPickering - Hacking the "Next" button to repurpose it as "Source Switch" button. This requires another update to config.json to add the correct GPIO pin, which is 496 (GPA0 on MCP23017). Then add write to GPIO5 and/or GPIO6 to select the correct input.
var currentSource = 0;
var karaoke = 'off';
// 20180518 RMPickering - Updating onoff to latest version so as to use its improved software debounce. This requires adding a parameter to the button initialization call below!
// 20180601 RMPickering - Can we also call a command to play whitenoise, and update our state/status?

module.exports = GPIOButtons;

function GPIOButtons(context) {
    var self = this;
    self.context = context;
    self.commandRouter = self.context.coreCommand;
    self.logger = self.context.logger;
    self.triggers = [];


}


GPIOButtons.prototype.onVolumioStart = function () {
    var self = this;


    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);


	
    try {
    	var clilevels = execSync("/usr/local/bin/karaokectl read");
	karaokeLevels = JSON.parse(clilevels);
	legacyKaraoke=false;
	karaokeReadTimer=setTimeout(function() { this.pullKaraokeLevels() }.bind(this),300);
	karaokeReadInterval=setInterval(function() { this.pullKaraokeLevels() }.bind(this),5000);
    }catch(ex){
	legacyKaraoke=true;
    	self.logger.info("Unable to read levels. Using legacy Karaoke mode");
    }

	

    self.logger.info("GPIO-Buttons initialized");


    return libQ.resolve();
};


GPIOButtons.prototype.getConfigurationFiles = function () {
    return ['config.json'];
};


GPIOButtons.prototype.onStart = function () {
	var self = this;
	var defer = libQ.defer();

	// 20180629 RMPickering - Moved LED setup earlier in startup process.
	// 20180606 RMPickering - Setup LED to indicate that the RPi itself is the selected source.
	internalIndicatorLed.write(1);


        self.logger.info("Registering battery monitor");
	lowBatteryLEDCheck.watch(function (err, value) {
		var self = this;
		if (err) {
			throw err;
		}
		if(value==0)
		{
			RedLEDGpio.writeSync(0);
			console.log('Low Battery: turning off Warning LED');
		}else{
			RedLEDGpio.writeSync(1);
			console.log('Low Battery: turning on Warning LED');
		}
	});


	self.createTriggers()
		.then(function (result) {
			self.logger.info("GPIO-Buttons started");
			defer.resolve();
		});

	return defer.promise;
};


GPIOButtons.prototype.onStop = function () {
    var self = this;
    var defer = libQ.defer();

    self.clearTriggers()
        .then(function (result) {
            self.logger.info("GPIO-Buttons stopped");
            defer.resolve();
        });

    return defer.promise;
};


GPIOButtons.prototype.onRestart = function () {
    var self = this;
};

GPIOButtons.prototype.onInstall = function () {
    var self = this;
};

GPIOButtons.prototype.onUninstall = function () {
    var self = this;
};

GPIOButtons.prototype.getConf = function (varName) {
    var self = this;
};

GPIOButtons.prototype.setConf = function (varName, varValue) {
    var self = this;
};

GPIOButtons.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
};

GPIOButtons.prototype.setAdditionalConf = function () {
    var self = this;
};

GPIOButtons.prototype.setUIConfig = function (data) {
    var self = this;
};


GPIOButtons.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    self.logger.info('GPIO-Buttons: Getting UI config');

    //Just for now..
    var lang_code = 'en';

    //var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {

            var i = 0;
            actions.forEach(function (action, index, array) {

                // Strings for config
                var c1 = action.concat('.enabled');
                var c2 = action.concat('.pin');

                // accessor supposes actions and uiconfig items are in SAME order
                // this is potentially dangerous: rewrite with a JSON search of "id" value ?
                uiconf.sections[0].content[2 * i].value = self.config.get(c1);
                uiconf.sections[0].content[2 * i + 1].value.value = self.config.get(c2);
                uiconf.sections[0].content[2 * i + 1].value.label = self.config.get(c2).toString();

                i = i + 1;
            });

            defer.resolve(uiconf);
        })
        .fail(function () {
            defer.reject(new Error());
        });

    return defer.promise;
};


GPIOButtons.prototype.saveConfig = function (data) {
    var self = this;

    actions.forEach(function (action, index, array) {
        // Strings for data fields
        var s1 = action.concat('Enabled');
        var s2 = action.concat('Pin');

        // Strings for config
        var c1 = action.concat('.enabled');
        var c2 = action.concat('.pin');
        var c3 = action.concat('.value');

        self.config.set(c1, data[s1]);
        self.config.set(c2, data[s2]['value']);
        self.config.set(c3, 0);
    });

    self.clearTriggers()
        .then(self.createTriggers());

    self.commandRouter.pushToastMessage('success', "GPIO-Buttons", "Configuration saved");
};


GPIOButtons.prototype.createTriggers = function () {
    var self = this;

    self.logger.info('GPIO-Buttons: Reading config and creating triggers...');

    actions.forEach(function (action, index, array) {
        var c1 = action.concat('.enabled');
        var c2 = action.concat('.pin');

        var enabled = self.config.get(c1);
        var pin = self.config.get(c2);

        if (enabled === true) {
            self.logger.info('GPIO-Buttons: ' + action + ' on pin ' + pin);
            // RMPickering - Supply recommended debounceTimeout of 10 msec for each trigger!
            //            var j = new Gpio(pin, 'in', 'both', { debounceTimeout: 10 });
	    try{
		    
            pins[action] = new Gpio(pin, 'in', 'both');
            pins[action].watch(self.listener.bind(self, action));
            self.triggers.push(pins[action]);
	    }catch(err){
            	self.logger.info('Unable to bind ' + action + ' on pin ' + pin);
	    }
        }
    });

    return libQ.resolve();
};


GPIOButtons.prototype.clearTriggers = function () {
    var self = this;

    self.triggers.forEach(function (trigger, index, array) {
        self.logger.info("GPIO-Buttons: Destroying trigger " + index);

        trigger.unwatchAll();
        trigger.unexport();
    });

    self.triggers = [];

    return libQ.resolve();
};


GPIOButtons.prototype.listener = function (action, err, value) {
    var self = this;

    var c3 = action.concat('.value');
    var lastvalue = self.config.get(c3);

    // IF change AND high (or low?)
    if (value !== lastvalue && value === 1) {
        //do thing
        self[action]();
    }
    // remember value
    self.config.set(c3, value);
};

// 20180508 RMPickering - Implement 'smart' Pause / Mute - if active service is pausable, then pause/play, otherwise mute/unmute.
GPIOButtons.prototype.playPause = function () {
    socket.emit('getState', '');
    socket.once('pushState', function (state) {
    //    if (state.volatile) {
            if (state.mute) {
                socket.emit('unmute');
            } else {
                socket.emit('mute');
            }
            // playing non-volatile source that can be paused
     //   } else if (state.status == 'play') {
     //       socket.emit('pause');
     //   } else {
     //       socket.emit('play');
     //   }
    });

};

GPIOButtons.prototype.setInternal = function(){
        var self = this;
        // we were already on source #2 so need to start back at source zero (the Pi itself)
         // switch pin down and update current source
        //inputSwitchBit1.write(0);
        //currentSource = 0;
        this.logger.info('GPIO-Buttons: switched from source 2 back to 0');
        // internalIndicatorLed.write(1);
        // 20180615 RMPickering - The switchOffExtInput function is needed anyway, in case the User presses the "Cancel" button in the modal popup, so let's use it here to do everything needed to reset to Pi input!
        this.switchOffExtInput();

}
GPIOButtons.prototype.setAnalog = function(){
        var self = this;
        socket.emit('getState', '');
        socket.once('pushState', function (state) {
         if (state.service == 'spop') {
        self.playbackTimeRunning=false;
            self.commandRouter.stateMachine.unSetVolatile();
            self.commandRouter.stateMachine.resetVolumioState().then(
                self.commandRouter.volumioStop.bind(self.commandRouter));


        //20180703-Emre Ozkan setting the background noise service depend on service name if it is spop start it in 1 sec otherwise start immediately.

        setTimeout(function(){
        execSync (" sudo systemctl start background_noise.service" );
        }, 500);

        }
        else {
                execSync (" sudo systemctl start background_noise.service" );

        }
        });




        // select source #2 - switching from 1 to 2 requires turning bit0 off and bit1 on!
        inputSwitchBit0.write(0);
        inputSwitchBit1.write(1);
        currentSource = 1;
        analogIndicatorLed.write(1);
        opticalIndicatorLed.write(0);
        internalIndicatorLed.write(0);
        this.logger.info('GPIO-Buttons: switched from source 1 to 2');

        //06/08/2018: Afrodita Kujumdzieva - play whitenoise in the background
        // runInShell(" play -n synth whitenoise ");

        // 06/08/2018: Afrodita Kujumdzieva - close all modals that are currently open
        //this.commandRouter.closeModals();


        // 06/08/2018: Afrodita Kujumdzieva - added a modal so that when next button is clicked to switch to optical input a confirmation modal will pop up
        // 20180615 RMPickering - Updated title of modal to "External Input"
        /*
        var modalDataAnalogue = {
            title: 'External Input',
            message: 'Analogue Input is selected.',
            size: 'lg',
            buttons: [
                {
                    name: 'Cancel',
                    class: 'btn btn-info',
                    emit: 'switchOffExtInput',
                    payload: ''
                }
            ]
        }



        this.commandRouter.broadcastMessage("openModal", modalDataAnalogue);
        */


        self.commandRouter.pushToastMessage('success', "Analog Input", 'ON');
        setTimeout(function(){
                //self.undock();


                self.commandRouter.stateMachine.setVolatile({
                        service: "analogin",
                        callback: self.setVolatileCallback.bind(self)

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

        }, 900);


}
GPIOButtons.prototype.setOptical = function(){
        var self = this;
// TODO: We need to stop current player then play whitenoise on the Pi!

        //20180703-Emre Ozkan resetting the statemachine to disconnect from spotify!

        socket.emit('getState', '');
        socket.once('pushState', function (state) {

         if (state.service == 'spop') {
        self.playbackTimeRunning=false;
            self.commandRouter.stateMachine.unSetVolatile();
            self.commandRouter.stateMachine.resetVolumioState().then(
                self.commandRouter.volumioStop.bind(self.commandRouter));


        //20180703-Emre Ozkan setting the background noise service depend on service name if it is spop start it in 1 sec otherwise start immediately.

        setTimeout(function(){
        execSync (" sudo systemctl start background_noise.service" );
        }, 500);

        }
        else {
                execSync (" sudo systemctl start background_noise.service" );

        }
        });




  // 20180615 RMPickering - we only need to pause in case the current source is Pi, so moved this emit from before the IF statement.
  //06/08/2018: Afrodita Kujumdzieva - Pause whatever is playing when clicking source switch

        socket.emit('pause');


        //20180629-Emre Ozkan adding a Modal for external-prepering step

        /*var modalDataPreparing = {
            title: 'Please Wait',
            message: 'Please wait while External Input switching is completed.',
            size: 'sm',
                buttons: [
                {
                    name: 'Cancel',
                    class: 'btn btn-info',
                    emit: 'switchOffExtInput',
                    payload: ''
                }
            ]


        }


        this.commandRouter.broadcastMessage("openModal", modalDataPreparing);

        //20180629-Emre Ozkan - call a shell command to pause for 7 seconds
//execSync (" sleep 7 "); */



        opticalIndicatorLed.write(1);
        internalIndicatorLed.write(0);
        analogIndicatorLed.write(0);
        // select source #1
        inputSwitchBit0.write(1);
        inputSwitchBit1.write(0);
        currentSource = 2;



        // 06/08/2018: Afrodita Kujumdzieva - close all modals currently opened
        //this.commandRouter.closeModals();

        this.logger.info('GPIO-Buttons: switched from source 0 to 1');

         // 06/08/2018: Afrodita Kujumdzieva - added a modal so that when next button is clicked to switch to optical input a confirmation modal will pop up
        // 20180615 RMPickering - Updated title of modal to "External Input"
        /*
        var modalDataOptical = {
            title: 'External Input',
            message: 'Optical Input is selected.',
            size: 'lg',
            buttons: [
                {
                    name: 'Cancel',
                    class: 'btn btn-info',
                    emit: 'switchOffExtInput',
                    payload: ''
                }
            ]
        }

        this.commandRouter.broadcastMessage("openModal", modalDataOptical);
        */
        self.commandRouter.pushToastMessage('success', "Optical Input", 'ON');
        setTimeout(function(){
                //self.undock();


                self.commandRouter.stateMachine.setVolatile({
                        service: "opticalin",
                        callback: self.setVolatileCallback.bind(self)
                });
                var status = {};
                status.status = 'play';
                status.service = 'opticalin';
                status.title = 'Optical Input';
                status.seek = 0;
                status.duration = 0;
                status.albumart = '/albumart?web=default';
                status.artist = '';
                status.album = '';

                console.log(status)
                self.commandRouter.servicePushState(status, 'opticalin');

        }, 900);


///////////////////////////////////////////////////////////////////////////////////////////////////////////


}



//next button
GPIOButtons.prototype.next = function () {
        var self = this;
    this.logger.info('GPIO-Buttons: initiate source switch');

        //20180629-Emre Ozkan - Pushing the state machine to reset when airplay streaming
        socket.emit('getState', '');
        socket.once('pushState', function (state) {
        if (state.service == 'airplay')
        {
                self.playbackTimeRunning=false;
            self.commandRouter.stateMachine.unSetVolatile();
            self.commandRouter.stateMachine.resetVolumioState().then(
                self.commandRouter.volumioStop.bind(self.commandRouter));
        }
        });



    //this.logger.info('GPIO-Buttons: writing to indicator led on pin 506');
    // RMPickering - Repurpose this button to scroll between the available sources on the DAC. This is meant to be implemented as a repeating ring scrolling from source 0 to 1 to 2 and so on, then starting back at zero again.
    // The input zero is the Pi itself, and the current DAC version has two other inputs available which are numbered as 1 and 2.
    // Input #0 is selecting by setting GPIO5 & GPIO6 both low.
    // Input #1 is selected by setting GPIO5 high and GPIO6 low.
    // Input #2 is selected by setting GPIO6 high and GPIO5 low.


 if (currentSource === 0) {
        this.setAnalog();

    }
 else if (currentSource === 1) {
        this.setOptical();

    }
 else {
        this.setInternal();

    }
};

//previous on playlist
GPIOButtons.prototype.previous = function () {
    //this.logger.info('GPIO-Buttons: previous-button pressed');
    socket.emit('prev');
};

//Volume up
GPIOButtons.prototype.volumeUp = function () {
    this.logger.info('GPIO-Buttons: Vol+ button pressed');
	if(pins["volumeDown"].readSync()==0)
	{
    		this.logger.info('GPIO-Buttons: BOTH BUTTONS ARE PRESSED');

    		execSync('ip route get 8.8.8.8 | sed -n "/src/{s/.*src *\\([^ ]*\\).*/\\1/p;q}" | sed -e "s/\\([0-9]\\)/\\1 /g"| espeak-ng --punct' );
	}
    socket.emit('volume', '+');
};

//Volume down
GPIOButtons.prototype.volumeDown = function () {
    //this.logger.info('GPIO-Buttons: Vol- button pressed\n');
    socket.emit('volume', '-');
};

//shutdown
GPIOButtons.prototype.shutdown = function () {

        var self = this;
    // this.logger.info('GPIO-Buttons: shutdown button pressed\n');

    // 20180629 RMPickering - Add a mute before shutdown.
    socket.emit('mute');

        //20180628-Emre Ozkan- airplay service restarted to cancel the connection
                self.playbackTimeRunning=false;
                self.commandRouter.stateMachine.unSetVolatile();
                self.commandRouter.stateMachine.resetVolumioState().then(
                self.commandRouter.volumioStop.bind(self.commandRouter));


    // We want to ensure that all playback has stopped before shutdown.
    socket.emit('stop');


   // 20180627 RMPickering - The switchOffExtInput function is needed here, in case an external input was previously selected, so that we don't have a noisy shutdown.
    this.switchOffExtInput();

    this.commandRouter.shutdown();
};


// 06/08/2018: Afrodita Kujumdzieva - Adding function to switch off external source
// This function is called from the file /volumio/app/plugins/user_interface/websocket/index.js

GPIOButtons.prototype.switchOffExtInput = function () {
    // 06/08/2018: Afrodita Kujumdzieva - close all modals currently open
        //this.commandRouter.closeModals();
        this.commandRouter.stateMachine.unSetVolatile();
        this.commandRouter.stateMachine.pushState();

    //20180628-Emre Ozkan- Background noise service called
    execSync(" sudo systemctl stop background_noise.service" );

    inputSwitchBit0.write(0);
    inputSwitchBit1.write(0);
    currentSource = 0;
    this.logger.info('GPIO-Buttons: switched to source 0');
    internalIndicatorLed.write(1);
    analogIndicatorLed.write(0);
    opticalIndicatorLed.write(0);

};

GPIOButtons.prototype.setVolatileCallback = function () {
};

GPIOButtons.prototype.pullKaraokeLevels = function (){
	var self=this;
	    try {
		var clilevels = execSync("/usr/local/bin/karaokectl read");
		karaokeLevels = JSON.parse(clilevels);
		var oMessaggio = {	
			msg: "pushKaraokeLevels",
			value: karaokeLevels
		};
            	self.commandRouter.executeOnPlugin('user_interface', 'websocket', 'broadcastMessage', oMessaggio);
	    }catch(ex){
    		console.log("Error in pulling levels :"+ex);
	    }
};


GPIOButtons.prototype.writeKaraokeCommand = function (command){
	var self=this;
	    try {
		var output = execSync("/usr/local/bin/karaokectl write "+command);
		clearTimeout(karaokeReadTimer);
	    }catch(ex){
	    }
};

// KARAOKE FUNCTIONS
GPIOButtons.prototype.KaraokeSwitchPress = function(data) {
	var self=this;

	if(legacyKaraoke)
	{
		console.log('IN LEGACY MODE');

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
	}else{
		console.log('IN AVR MODE');
		if (data) {
			if (data == 'on') {
    				this.writeKaraokeCommand("SKT001");
				console.log('Karaoke Switch has been selected');
				karaoke = 'on';
				karaokeLevels.KaraokeStatus=1;
				self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Karaoke Mode ON')
			} else {
    				this.writeKaraokeCommand("SKT000");
				console.log('Karaoke Switch has been deselected');
				karaoke = 'off';
				karaokeLevels.KaraokeStatus=0;
				self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Karaoke Mode ON')
			}
		} else {
			if (karaokeLevels.KaraokeStatus == 0) {
				this.writeKaraokeCommand("SKT001");
				console.log('Karaoke Switch has been selected');
				karaoke = 'on';
				karaokeLevels.KaraokeStatus=1;
			} else {
				this.writeKaraokeCommand("SKT000");
				console.log('Karaoke Switch has been deselected');
				karaoke = 'off';
				karaokeLevels.KaraokeStatus=0;
			}
		}


	}

	var promise = {
		message : "pushKaraokeStatus",
		payload: karaoke
	};
	console.log(promise);

	return promise
};

GPIOButtons.prototype.getKaraokeStatus = function() {
	var self=this;
	var promise = {
		message : "pushKaraokeStatus",
		payload: karaoke
	};

	return promise
};
GPIOButtons.prototype.getKaraokeLevels = function() {
	var self=this;
	var promise = {
		message : "pushKaraokeLevels",
		payload: karaokeLevels
	};

	return promise
};



GPIOButtons.prototype.MusicPlusPress = function() {
	var self = this;

	if(legacyKaraoke)
	{
		self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Music +')
		MusicPlus.writeSync(1);
		setTimeout(function(){
			MusicPlus.writeSync(0);
		},50);
	}else{
		this.writeKaraokeCommand("PMP000");
		this.pullKaraokeLevels();		

	}
};

GPIOButtons.prototype.MusicMinusPress = function() {
	var self = this;

	if(legacyKaraoke)
	{
		self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Music -')
		MusicMinus.writeSync(1);
		setTimeout(function(){
			MusicMinus.writeSync(0);
		},50);
	}else{
		this.writeKaraokeCommand("PMM000");
		this.pullKaraokeLevels();		

	}

};


GPIOButtons.prototype.MicPlusPress = function() {
	var self = this;

	if(legacyKaraoke)
	{
		self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Microphone +')
		MicPlus.writeSync(1);
		setTimeout(function(){
			MicPlus.writeSync(0);
		},50);
	}else{
		this.writeKaraokeCommand("PIP000");
		this.pullKaraokeLevels();		

	}


};

GPIOButtons.prototype.MicMinusPress = function() {
	var self = this;

	if(legacyKaraoke)
	{
		self.commandRouter.broadcastToastMessage('info', 'Karaoke', 'Microphone -')
		MicMinus.writeSync(1);
		setTimeout(function(){
			MicMinus.writeSync(0);
		},50);
	}else{
		this.writeKaraokeCommand("PIM000");
		this.pullKaraokeLevels();		

	}

};

GPIOButtons.prototype.EchoPlusPress = function() {
	var self = this;

	if(legacyKaraoke)
	{
	}else{
		this.writeKaraokeCommand("PEP000");
		this.pullKaraokeLevels();		

	}


};

GPIOButtons.prototype.EchoMinusPress = function() {
	var self = this;

	if(legacyKaraoke)
	{
	}else{
		this.writeKaraokeCommand("PEM000");
		this.pullKaraokeLevels();		

	}

};

GPIOButtons.prototype.MusicLevelChange = function(data) {
	var self = this;

	if(!legacyKaraoke)
	{
		this.writeKaraokeCommand("SML"+String(data).padStart(3,'0'));
		this.pullKaraokeLevels();		

	}

};

GPIOButtons.prototype.MicLevelChange = function(data) {
	var self = this;

	if(!legacyKaraoke)
	{
		this.writeKaraokeCommand("SIL"+String(data).padStart(3,'0'));
		this.pullKaraokeLevels();		

	}

};

GPIOButtons.prototype.EchoLevelChange = function(data) {
	var self = this;

	if(!legacyKaraoke)
	{
		this.writeKaraokeCommand("SEL"+String(data).padStart(3,'0'));
		this.pullKaraokeLevels();		

	}

};




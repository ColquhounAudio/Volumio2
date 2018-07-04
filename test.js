
var fs = require('fs-extra');
var Gpio = require('onoff').Gpio;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');


var opticalIndicatorLed = new Gpio(506, 'out');
var analogIndicatorLed = new Gpio(505, 'out');
var internalIndicatorLed = new Gpio(504, 'out');

var inputSwitchBit0 = new Gpio(5, 'out');
var inputSwitchBit1 = new Gpio(6, 'out');

function remoteservice() {
var self = this; 
  self.context = context;
    self.commandRouter = self.context.coreCommand;
    self.logger = self.context.logger;

socket.emit('getState', '');
    socket.once('pushState', function (state) {

if (state.service == 'airplay' ) {

  this.commandRouter.closeModals();

    // turn off pin 6
    // turn off pin 5
    // stop whitenoise
    //runInShell.kill('SIGKILL');
    //socket.emit('pause');

    inputSwitchBit0.write(0);
    inputSwitchBit1.write(0);
    currentSource = 0;
    this.logger.info('GPIO-Buttons: switched to source 0');
    internalIndicatorLed.write(1);
    analogIndicatorLed.write(0);
    opticalIndicatorLed.write(0);


}
});
}

remoteservice();



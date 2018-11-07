'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var Gpio = require('onoff').Gpio;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var execSync = require('child_process').execSync;
var os = require('os');

var btStatus = 0;
// Define the BluetoothInterface class
module.exports = BluetoothInterface;


function BluetoothInterface(context) {
    var self = this;
    // Save a reference to the parent commandRouter
    self.context = context;
    self.commandRouter = self.context.coreCommand;
    self.logger=self.commandRouter.logger;

}

BluetoothInterface.prototype.onVolumioStart = function () {
    var self = this;

    self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Starting BluetoothController');

    return libQ.resolve();
};

BluetoothInterface.prototype.onStart = function () {
    var self = this;

    return libQ.resolve();
};

BluetoothInterface.prototype.BTpress = function () {
	var self = this;
	if(btStatus === 0)
	{
		socket.emit('getState', '');
		socket.once('pushState', function (state) {

				});

			setTimeout(function(){
					    execSync(" sudo systemctl stop background_noise.service" );
					}, 500);
			setTimeout(function(){
					    execSync(" sudo systemctl start a2dp-playback.service" );
					}, 1000);

			socket.emit('pause');
					

		this.commandRouter.closeModals();

		var modalDataOptical = {
			title: 'Bluetooth Input',
			message: 'Bluetooth Input is selected.',
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
		btStatus=1;
	}else{
		this.commandRouter.closeModals();


		execSync(" sudo systemctl stop a2dp-playback.service" );
		execSync(" sudo systemctl stop background_noise.service" );
		btStatus=0;
	}
	return libQ.resolve();
};


BluetoothInterface.prototype.BTStart = function () {
	var self = this;

	return libQ.resolve();
};


BluetoothInterface.prototype.statusCallback=function(){
	var self=this;

}

BluetoothInterface.prototype.songCallback=function(){
	var self=this;


}

BluetoothInterface.prototype.BTStop = function () {
	var self = this;

	return libQ.resolve();
};

BluetoothInterface.prototype.BTRestart = function () {
	var self = this;

	return libQ.resolve();
};

BluetoothInterface.prototype.onStop = function () {
    var self = this;
    //Perform startup tasks here
	return libQ.resolve();
};

BluetoothInterface.prototype.onRestart = function () {
    var self = this;


};

BluetoothInterface.prototype.onInstall = function () {
    var self = this;
    //Perform your installation tasks here
};

BluetoothInterface.prototype.onUninstall = function () {
    var self = this;
    //Perform your installation tasks here
};

BluetoothInterface.prototype.getUIConfig = function () {
    var self = this;


};

BluetoothInterface.prototype.setUIConfig = function (data) {
    var self = this;
    //Perform your installation tasks here
};

BluetoothInterface.prototype.getConf = function (varName) {
    var self = this;
    //Perform your installation tasks here
};

BluetoothInterface.prototype.setConf = function (varName, varValue) {
    var self = this;
    //Perform your installation tasks here
};

//Optional functions exposed for making development easier and more clear
BluetoothInterface.prototype.getSystemConf = function (pluginName, varName) {
    var self = this;
    //Perform your installation tasks here
};

BluetoothInterface.prototype.setSystemConf = function (pluginName, varName) {
    var self = this;
    //Perform your installation tasks here
};

BluetoothInterface.prototype.getAdditionalConf = function () {
    var self = this;
    //Perform your installation tasks here
};

BluetoothInterface.prototype.setAdditionalConf = function () {
    var self = this;
    //Perform your installation tasks here
};


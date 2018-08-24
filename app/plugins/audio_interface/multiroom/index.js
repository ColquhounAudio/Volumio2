var libQ = require('kew');
var libFast = require('fast.js');
var fs = require('fs-extra');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var io = require('socket.io-client');
var spawn = require('child_process').spawn;


// Define the ControllerSystem class
module.exports = ControllerMultiroom;

function log(desc) {
   //console.log("multiroom: " + desc);
}

function ControllerMultiroom(context) {
    var self = this;
    // Save a reference to the parent commandRouter
    self.context = context;
    self.logger = self.context.logger;
    self.commandRouter = self.context.coreCommand;
    //self.libSocketIO = require('socket.io')(self.context.websocketServer);

    self.config = new(require('v-conf'))();
    self.config.loadFile(__dirname + '/config.json');
    self.obeyGroupVolume = false;
}

var multiConf = [];

ControllerMultiroom.prototype.loadMultiroomConfiguration = function() {
    var self = this;

    log("load multiroom configuration");
    /*
    var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'currentMultiroom.json');
    return fs.readJsonSync(configFile);
    */
    return multiConf;
}

ControllerMultiroom.prototype.saveMultiroomConfiguration = function(configuration) {
    /*var self=this;
    log("save multiroom configuration");
    var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'currentMultiroom.json');
    fs.writeJsonSync(configFile,configuration);*/
    multiConf = configuration;
}

ControllerMultiroom.prototype.onVolumioStart = function() {
    var self = this;

    /*self.config= new (require('v-conf'))();
	var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');
	self.config.loadFile(configFile);
*/
    var boundMethod = self.handleDiscoveryCallback.bind(self);
    self.commandRouter.executeOnPlugin('system_controller', 'volumiodiscovery', 'registerCallback', boundMethod);

    self.saveMultiroomConfiguration([]);
    self.setMultiroomSingle();

    var volumioPushStateCallback = self.volumioPushStateCallback.bind(self);

    self.commandRouter.addCallback("volumioPushState", volumioPushStateCallback);

}

ControllerMultiroom.prototype.volumioPushStateCallback = function(state) {
	var self = this;
	if (state.volume == undefined) state.volume = 0;
	if (state.status == undefined) state.status = '';
	if (state.artist == undefined) state.artist = '';
	if (state.title == undefined) state.title = '';
	if (state.albumart == undefined) state.albumart = '';

	var systemController = self.commandRouter.pluginManager.getPlugin('system_controller', 'system');
	var uuid = systemController.getConf('uuid');
	var conf = self.findAndExecute(uuid, function (item) {
		item.volume = state.volume;
		item.status = state.status;
		item.artist = state.artist;
		item.title = state.title;
		item.track = state.title;
		item.song = state.title;
		item.albumart = state.albumart;
		return true
	});
    self.volume = state.volume;
	state.uuid = uuid;
	
	var oMessaggio = {	
                msg: "pushMultiroom",
                value: conf
            };
            self.commandRouter.executeOnPlugin('user_interface', 'websocket', 'broadcastMessage', oMessaggio);
    var oMessaggio = {
            msg: "pushMultiroomDevices",
            value: conf
        };
        self.commandRouter.executeOnPlugin('user_interface', 'websocket', 'broadcastMessage', oMessaggio);

    self.sendUpdateToOthers({update: state});
}

ControllerMultiroom.prototype.findAndExecute = function(uuid, func) {
	var self = this;
	var conf =  JSON.parse(JSON.stringify(self.loadMultiroomConfiguration()));
	var i = conf.length;
	var save=false;
	while (i--) {
		var item = conf[i];
		if (self.isGroup(item)) {
			if (item.server.uuid == uuid) {
				save = func(item);
			}
			var j = item.clients.length;
			while (j--) {
				var citem = item.clients[j];
				if (citem.uuid == uuid) {
					save = func(citem);
				}
			}

		} else {
			if (item.uuid == uuid) {
				save = func(item);
			}
		}
	}
	if (save) {
		log(" saving " + JSON.stringify(conf,null,4));
		self.saveMultiroomConfiguration(conf);
	}
	return conf;
}



ControllerMultiroom.prototype.getConfigurationFiles = function() {
    var self = this;

    return ['currentMultiroom.json'];
}

ControllerMultiroom.prototype.isGroup = function(item) {
    return item.type != undefined;
}

ControllerMultiroom.prototype.isItem = function(item, uuid) {
    return item.uuid == uuid;
}

ControllerMultiroom.prototype.isServer = function(item, uuid) {
    return item != undefined && item.server != undefined && item.server.uuid == uuid;
}

ControllerMultiroom.prototype.isClient = function(item, uuid) {
    var self = this;
    return self.getClient(item, uuid) != undefined;
}

ControllerMultiroom.prototype.getClient = function(item, uuid) {
    var self = this;
    for (var i in item.clients) {
        var client = item.clients[i];

        if (client.uuid == uuid)
            return client;
    }

    return undefined;
}



ControllerMultiroom.prototype.handleDiscoveryCallback = function(data) {
    var self = this;
    log("found stuff " + JSON.stringify(data));
    //Shall check if the device is already present
    //	self.logger.debug(JSON.stringify(data));
    var multiRoom = self.loadMultiroomConfiguration();

    self.logger.debug("--------- MULTIROOM ------------");
    self.logger.debug(JSON.stringify(multiRoom));

    // remove all device that aren't there
    var deviceRemoval = [];
    var singleGuys = [];
    for (var i in data.list) {
        var ip = data.list[i].host;
        var uuid = data.list[i].id;
        deviceRemoval.push(uuid);
    }


    //searching for device

    var i = data.list.length;
    while (i--) {
    	
    	var ip = data.list[i].host;
        var uuid = data.list[i].id;
        for (var j in multiRoom) {
        	var item = multiRoom[j];
        	if (self.isGroup(item)) {
        		var ci = item.clients.length;
        		while (ci --) {
        			var aClient = item.clients[ci];
        			if (deviceRemoval.indexOf(aClient.uuid) < 0)  {
        				item.clients.splice(ci);
        			}
        		}
        		if (item.clients.length == 0) {
        			multiRoom.push(item.server);
        			multiRoom.splice(j);
        			i++;
        			continue;
        		}
        		if (deviceRemoval.indexOf(item.server.uuid) < 0) {
        			singleGuys.concat(item.clients);
        			multiRoom.splice(j);
        		}
        	} else {
        		if (deviceRemoval.indexOf(item.uuid) < 0) {
        			multiRoom.splice(j);
        		}
        	}
        }
    }
    multiRoom.concat(singleGuys);

    var i = data.list.length;
    while (i--) {
        var ip = data.list[i].host;
        var uuid = data.list[i].id;

        var isPresent = false;
        var presentNode;
        for (var j in multiRoom) {
            var item = multiRoom[j];
            if (self.isGroup(item)) {
                if (self.isServer(item, uuid)) {
                    isPresent = true;
                    presentNode = item.server;
                } else if (self.isClient(item, uuid)) {
                    isPresent = true;
                    presentNode = self.getClient(item, uuid);
                }

            } else {
                if (self.isItem(item, uuid)) {
                    isPresent = true;
                    presentNode = item;
                }
            }
        }

        if (isPresent == false) {
            multiRoom.push({
                name: data.list[i].name,
                uuid: data.list[i].id,
                ip: data.list[i].host,
                volume: data.list[i].state.volume,
                song: data.list[i].state.track,
                artist: data.list[i].state.artist,
                albumart: ''
            });
        } else {
            presentNode.name = data.list[i].name;
            presentNode.volume = data.list[i].state.volume;
            presentNode.song = data.list[i].state.track,
            presentNode.artist = data.list[i].state.artist,
            presentNode.albumart = ''
        }
    }

    self.saveMultiroomConfiguration(multiRoom);
    var oMessaggio = {
                msg: "pushMultiroom",
                value: multiRoom
            };
            self.commandRouter.executeOnPlugin('user_interface', 'websocket', 'broadcastMessage', oMessaggio);
    var oMessaggio = {
            msg: "pushMultiroomDevices",
            value: multiRoom
        };
        self.commandRouter.executeOnPlugin('user_interface', 'websocket', 'broadcastMessage', oMessaggio);
}

ControllerMultiroom.prototype.onStart = function() {
    var self = this;

    return libQ.resolve();
}


ControllerMultiroom.prototype.getMultiroom = function(sCommand) {
    var self = this;

    var defer = libQ.defer();

    var multiRoom = self.loadMultiroomConfiguration();
    defer.resolve(multiRoom);


    return defer.promise;
};

//setMultiroom {ip:IP,set:client|server|single,volume:80}
ControllerMultiroom.prototype.setMultiroom = function(sCommand) {
    var self = this;
    log("setmultiroom " + JSON.stringify(sCommand));
    var defer = libQ.defer();

    var multiRoom = self.loadMultiroomConfiguration();

    if (sCommand.set == 'client') {
        self.setMultiroomClient(multiRoom, sCommand);
    } else if (sCommand.set == 'server') {
        self.setMultiroomServer(multiRoom, sCommand);
    } else if (sCommand.set == 'single') {
        self.setMultiroomSingle(multiRoom, sCommand);
    } else {

    }
    if ((sCommand.volume == undefined) && (sCommand.groupvolume == undefined)) {

    } else {
        if (sCommand.groupvolume == undefined) {
            log("Single volume");
            for (var i in multiRoom) {
                if (multiRoom[i].type == "GROUP") {
                    log(" SERVER -> " + multiRoom[i].server.ip + " " + sCommand.ip);
                    if (multiRoom[i].server.ip == sCommand.ip) {
                        multiRoom[i].server.volume = sCommand.volume
                           sCommand.uuid = multiRoom[i].server.uuid;
                    } else {
                        for (var x in multiRoom[i].clients) {

                            if (multiRoom[i].clients[x].ip == sCommand.ip) {
                                multiRoom[i].clients[x].volume = sCommand.volume
                                sCommand.uuid = multiRoom[i].clients[x].uuid;
                            }
                        }
                    }
                } else {
                    if (multiRoom[i].ip == sCommand.ip) {
                        multiRoom[i].volume = sCommand.volume
                        sCommand.uuid = multiRoom[i].uuid;
                    }
                }
            }
        } else {
            log("group volume");
            for (var i in multiRoom) {
                log("comp: " + multiRoom[i].type);
                if (multiRoom[i].type == "GROUP") {
                    multiRoom[i].server.groupvolume = sCommand.groupvolume;
                    // multiRoom[i].server.volume = sCommand.groupvolume
                    // for (var x in multiRoom[i].clients) {
                    // 		multiRoom[i].clients[x].volume = sCommand.groupvolume
                    // }

                } else {
                    //multiRoom[i].volume = sCommand.groupvolume
                }
            }
        }
    }

    self.saveMultiroomConfiguration(multiRoom);

    if (sCommand.configuration == undefined) {
        sCommand.configuration = multiRoom;
    }
    self.sendUpdateToOthers(sCommand);

    defer.resolve(multiRoom);

    //send this to other clients
    //

    return defer.promise;
};

ControllerMultiroom.prototype.getServerItem = function(data) {
    var self = this;
    log("get server item");

    log("DATA " + JSON.stringify(data));
    for (var i in data) {
        var item = data[i];
        if (item.type != undefined) {
            return item;
        }
    }
}

ControllerMultiroom.prototype.setMultiroomClient = function(data, command) {
    var self = this;
    log("set multiroom client");
    var presentItem;

    //remove item

    for (var i in data) {
        var item = data[i];

        if (self.isGroup(item)) {
            //Checking if server
            if (item.server != undefined && item.server.ip == command.ip) {
                presentItem = item.server;
                item.server = {};
                break;
            }

            for (var j in item.clients) {
                var client = item.clients[j];

                if (client.ip == command.ip) {
                    presentItem = client;
                    item.clients.splice(j, 1);
                    break;
                }
            }

        } else {
            if (item.ip == command.ip) {
                presentItem = data[i];
                data.splice(i, 1);
                break;
            }
        }
    }

    if (presentItem == undefined) {
        log("Device not found, cannot set it as client");
        return;
    }

    var group = self.getServerItem(data);

    if (group == undefined) {

        var group = {
            type: 'GROUP',
            name: 'group',
            server: {},
            clients: [{
                name: presentItem.name,
                uuid: presentItem.uuid,
                ip: presentItem.ip,
                volume: self.volume,
                song: '',
                artist: '',
                albumart: ''
            }]
        };

        data.push(group);

        self.dispatchMessage(presentItem.ip, 'setAsMultiroomClient');
    } else {
        group.clients.push({
            name: presentItem.name,
            uuid: presentItem.uuid,
            ip: presentItem.ip,
            volume: self.volume,
            song: '',
            artist: '',
            albumart: ''
        });

        self.dispatchMessage(presentItem.ip, 'setAsMultiroomClient');

    }
}


ControllerMultiroom.prototype.setMultiroomServer = function(data, command) {
    var self = this;

    //remove item from single
    log("set multiroom server " + JSON.stringify(data));

    var presentItem;
    var createGroup = true;
    var groupItem;
    for (var i in data) {
        var item = data[i];

        if (self.isGroup(item)) {
            if (item.server != undefined && item.server.ip == command.ip) {
                presentItem = item.server;
                break;
            }

            for (var j in item.clients) {
                var client = item.clients[j];

                if (client.ip == command.ip) {
                    presentItem = client;
                    item.clients.splice(j, 1);
                    break;
                }
            }
        } else {
            if (item.ip == command.ip) {
                presentItem = data[i];
                data.splice(i, 1);

            }
        }
    }

    if (presentItem == undefined) {
        log("Device not found, cannot set it as client");
        return;
    }

    var group = self.getServerItem(data);

    try {
        var mpcvol = execSync('/usr/bin/mpc volume | cut -d " " -f2', {encoding: 'utf8'});
        var groupvolume = mpcvol.replace('%','');
    } catch (e) {
        var groupvolume = 50;
    }

    if (group == undefined) {

        var groupItem = {
            type: 'GROUP',
            name: 'group',
            server: {
                name: presentItem.name,
                uuid: presentItem.uuid,
                ip: presentItem.ip,
                volume: self.volume,
                song: '',
                artist: '',
                albumart: '',
                groupvolume: groupvolume
            },
            clients: []
        };

        data.push(groupItem);
        self.dispatchMessage(presentItem.ip, 'setAsMultiroomServer');

    } else {
        if (group.server != undefined && group.server.ip != undefined && group.server.ip != command.ip) {
            group.clients.push(group.server);
        }

        group.server = {
            name: presentItem.name,
            uuid: presentItem.uuid,
            ip: presentItem.ip,
            volume: self.volume,
            song: '',
            artist: '',
            albumart: '',
            groupvolume: groupvolume
        };

        self.dispatchMessage(presentItem.ip, 'setAsMultiroomServer');

    }

    //check if group already exists
}


ControllerMultiroom.prototype.setMultiroomSingle = function(data, command) {
    var self = this;

    //remove item from single
    log("set multiroom single ");
    var presentItem;
    var foundItem;
    for (var i in data) {
        var item = data[i];

        if (item.type == undefined && item.ip == command.ip) {
            return;
        }

        if (item.type != undefined) {
            if (item.server.ip == undefined && item.clients.length == 0) {
                data.splice(i, 1);
            }

            if (item.server.ip == command.ip) {

                foundItem = item.server;

                //have to put a client as server
                if (item.clients.length > 0) {
                    var newServer = item.clients[0];
                    item.clients.splice(0, 1);

                    item.server = newServer;

                    if (item.clients.length == 0 && (item.server == undefined || item.server.ip == undefined))
                        data.splice(i, 1);
                } else {
                    //remove server
                    data.splice(i, 1);
                }

            } else {
                if (item.clients.length == 0)
                    data.splice(i, 1);
                else {
                    for (var j in item.clients) {
                        var client = item.clients[j];
                        if (client.ip == command.ip) {
                            foundItem = item.clients[j];
                            item.clients.splice(j, 1);
                        }

                    }

                }

            }
        }
    }

    if (foundItem == undefined) {
        log("Device not found, cannot set it as single");
        return;
    }

    var single = {
        name: foundItem.name,
        ip: command.ip,
        uuid: foundItem.uuid,
        volume: self.volume,
        song: '',
        artist: '',
        albumart: ''
    };

    data.push(single);


    var group = self.getServerItem(data);

    if (group != undefined) {
        if (group.server != undefined && group.server.ip != undefined && group.clients.length == 0) {
            self.dispatchMessage(group.server.ip, 'setAsMultiroomSingle');
            data.push(group.server);

            for (var k in data) {
                var item = data[k];

                if (self.isGroup(item)) {
                    data.splice(k, 1);

                }
            }
        }
    }


    self.dispatchMessage(command.ip, 'setAsMultiroomSingle');


}

ControllerMultiroom.prototype.sendUpdateToOthers = function(data,exceptMe) {
    var self = this;
    log("send update to others");

    var devices = self.commandRouter.executeOnPlugin('system_controller', 'volumiodiscovery', 'getDevices');
   

        for (var i in devices.list) {
            log("Sending multiroom info to " + devices.list[i].host);
            self.dispatchMessage(devices.list[i].host, 'writeMultiroom', data,exceptMe);
        }
}

ControllerMultiroom.prototype.dispatchMessage = function(host, message, data, exceptMe) {
    var self = this;

    var devices = self.commandRouter.executeOnPlugin('system_controller', 'volumiodiscovery', 'getDevices');
    for (var i in devices.list) {
        if (devices.list[i].host == host) {
            if (devices.list[i].isSelf == false) {
                log("Dispatch " + message + " to " + " " + host + " via network");
                self.sendMessageToDevice(devices.list[i].host, message, data);
            } else {
            	if (!exceptMe) {
	             	   if (message  == 'writeMultiroom') {
	                	log("Dispatch " + message + " to " + " " + host + " via local");
	                	self.writeMultiRoom(data);						
	                } else if (message == 'setAsMultiroomClient') {
	                	log("Dispatch " + message + "to" + " " + host + " via local");
	                	self.setClient();
	                } else if (message == 'setAsMultiroomServer') {
	                	log("Dispatch " + message + "to"  + " " + host + " via local");
	                	self.setServer();
	                } else if (message == 'setAsMultiroomSingle') {
	                	log("Dispatch " + message + "to" + " " + host + " via local");
	                	self.setSingle();
	                } else {
	                	log("NOT Dispatch " + message + "to" + " " + host + " via local ******************");
	                }
            	}

                


            }
        }
    }
}

ControllerMultiroom.prototype.sendMessageToDevice = function(url, emit, data) {
    var self = this;
    log("send message to device " + url + " " + emit + " " + JSON.stringify(data));
    var socket = io.connect(url + ":3000", {
        multiplex: false
    });
    socket.on('connect', function() {
        socket.emit(emit, data);
        socket.disconnect();
    });
}


ControllerMultiroom.prototype.writeMultiRoom = function(data) {
    var self = this;
    //log("write multiroom " + JSON.stringify(data));
    if (data == undefined) data = {};
    var conf = data.configuration;

    if (data.update != undefined) {
    	log("Found client configuration " + JSON.stringify(data.update,null,4));
    	self.commandRouter.executeOnPlugin('system_controller','volumiodiscovery','saveDeviceInfo',data.update);
    	conf = self.findAndExecute(data.update.uuid, function (item) {
    		item.volume = data.update.volume;
			item.status = data.update.status;
			item.artist = data.update.artist;
			item.title = data.update.title;
			item.track = data.update.title;
			item.song = data.update.title;
			item.albumart = data.update.albumart;
			return false
		});
    }

    if (conf == undefined) {
        log("Missing multiroom configuration");
    } else {
        var websocket=self.commandRouter.pluginManager.getPlugin('user_interface', 'websocket');

        log("Received Conf " + JSON.stringify(conf,null,4));
        if (conf != self.loadMultiroomConfiguration()) {
            log("Saving Sending data to everyone!");
            self.saveMultiroomConfiguration(conf);
            var oMessaggio = {
                msg: "pushMultiroom",
                value: conf
            };
            //self.commandRouter.executeOnPlugin('user_interface', 'websocket', 'broadcastMessage', oMessaggio);

            websocket.broadcastMessage('pushMultiroom',conf);
        } else {
            log("Configuration is a dupe, bailing out.")
        }
        var oMessaggio = {
            msg: "pushMultiroomDevices",
            value: conf
        };
        //self.commandRouter.executeOnPlugin('user_interface', 'websocket', 'broadcastMessage', oMessaggio);

        websocket.broadcastMessage('pushMultiroomDevices',conf);
    }
    var systemController = self.commandRouter.pluginManager.getPlugin('system_controller', 'system');
	var uuid = systemController.getConf('uuid');
    var volume = data.volume;
    if (data.uuid != uuid) {
    	volume = undefined;
    }

    if (data.groupvolume == undefined) {
        log("no group volume defined");
    } else {
        if (self.obeyGroupVolume) {
            log("AVC: obey groupvolume");
            self.commandRouter.executeOnPlugin('music_service', 'mpd', 'setGroupVolume', data.groupvolume);
        } else {
            log("AVC: ignore groupvolume");
        }
    }
    
    if (volume == undefined) {
        log("No volume to set with this " + JSON.stringify(data));
    } else {
        log("Should set my volume to: " + volume);
        self.commandRouter.volumiosetvolume(volume);
    }

}



ControllerMultiroom.prototype.setServer = function() {
    var self = this;
    log("set server");
    var timeStart = Date.now();
    self.obeyGroupVolume = true;
    self.logStart('Setting Multiroom Server')
        .then(libFast.bind(self.snapServerStart, self))
        .then(libFast.bind(self.snapClientStop, self))
        .then(libFast.bind(self.enableMultiroomOutput, self))
        .then(libFast.bind(self.disableAlsaOutput, self))
        .then(libFast.bind(self.snapClientStart, self))
        .fail(libFast.bind(self.pushError, self))
        .done(function() {
            return self.logDone(timeStart);
        });

}

ControllerMultiroom.prototype.setClient = function() {
    var self = this;
    log("set client");
    var timeStart = Date.now();
    self.obeyGroupVolume = false;
    self.logStart('Setting Multiroom Client')
        .then(libFast.bind(self.mpdStop, self))
        .then(libFast.bind(self.snapServerStop, self))
        .then(libFast.bind(self.enableAlsaOutput, self))
        .then(libFast.bind(self.disableMultiroomOutput, self))
        .then(libFast.bind(self.snapClientStart, self))
        .fail(libFast.bind(self.pushError, self))
        .done(function() {
            return self.logDone(timeStart);
        });

}

ControllerMultiroom.prototype.setSingle = function() {
    var self = this;
    log("set single");
    var timeStart = Date.now();
    self.obeyGroupVolume = false;
    self.logStart('Setting Multiroom Single')
        .then(libFast.bind(self.snapServerStop, self))
        .then(libFast.bind(self.snapClientStop, self))
        .then(libFast.bind(self.enableAlsaOutput, self))
        .then(libFast.bind(self.disableMultiroomOutput, self))
        .fail(libFast.bind(self.pushError, self))
        .done(function() {
            return self.logDone(timeStart);
        });

}



ControllerMultiroom.prototype.snapServerStart = function() {
    var self = this;
    log("snap server start");
    var defer = libQ.defer();
    var commandjson = '{"action":"start","parameters":"-d -b 3000 -c ogg --pipeReadBuffer 200"}';
    log("SNAPSERVERTART");
    fs.writeFile('/tmp/snapserver', commandjson, function(err) {
        if (err) {
            return log(err);
        }
        defer.resolve({});
        self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] SnapServer Started via File');
    });

    return defer.promise;
}

ControllerMultiroom.prototype.snapServerStop = function() {
    var self = this;
    log("snap server stop");
    var defer = libQ.defer();
    var commandjson = '{"action":"stop","parameters":""}';
    fs.writeFile('/tmp/snapserver', commandjson, function(err) {
        if (err) {
            return log(err);
        }
        defer.resolve({});
        self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] SnapServer Stopped via File');
    });

    return defer.promise;

}

ControllerMultiroom.prototype.snapClientStart = function() {
    var self = this;
    log("snap client start");
    var defer = libQ.defer();
    var commandjson = '{"action":"start","parameters":"-d -s volume --latency 50"}';

    fs.writeFile('/tmp/snapclient', commandjson, function(err) {
        if (err) {
            return log(err);
        }
        defer.resolve({});
        self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] SnapClientStarted via File');
    });
    return defer.promise;
}

ControllerMultiroom.prototype.snapClientStop = function() {
    var self = this;
    log("snap client stop");
    var defer = libQ.defer();

    exec("/usr/bin/sudo /usr/bin/killall snapclient", function(error, stdout, stderr) {
        if (error) {
            log('Cannot Kill Snapclient' + error);
        } else {
            self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] SnapClient Stopped');
        }
        defer.resolve({});
    });
    return defer.promise;

}

ControllerMultiroom.prototype.mpdResume = function() {
    var self = this;
    log("mpd resume");
    var defer = libQ.defer();

    self.context.coreCommand.executeOnPlugin('music_service', 'mpd', 'resume', '');
    self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] MPD Resume');

    defer.resolve({});
    return defer.promise;
}

ControllerMultiroom.prototype.mpdStop = function() {
    var self = this;
    log("mpd stop");
    var defer = libQ.defer();

    self.context.coreCommand.executeOnPlugin('music_service', 'mpd', 'stop', '');
    self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] MPD Stop');
    defer.resolve({});
    return defer.promise;
}


ControllerMultiroom.prototype.enableMultiroomOutput = function() {
    var self = this;
    log("enable multiroom output");
    var defer = libQ.defer();
    

    self.context.coreCommand.executeOnPlugin('music_service', 'mpd', 'enableOutput', '1');
    self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Multiroom Output Enabled');

    defer.resolve({});
    return defer.promise;
}

ControllerMultiroom.prototype.disableMultiroomOutput = function() {
    var self = this;
    log("disable multiroom output");
    var defer = libQ.defer();
    
    self.context.coreCommand.executeOnPlugin('music_service', 'mpd', 'disableOutput', '1');
    self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Multiroom Output Disabled');
    defer.resolve({});
    return defer.promise;
}

ControllerMultiroom.prototype.enableAlsaOutput = function() {
    var self = this;
    var defer = libQ.defer();
    log("enable alsa output");
    //Waiting 500ms to ensure Alsa can bind the audio interface properly
    setTimeout(function() {
        self.context.coreCommand.executeOnPlugin('music_service', 'mpd', 'enableOutput', '0');
        self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Alsa Output Enabled');
        defer.resolve({});
    }, 1000);

    return defer.promise;
}

ControllerMultiroom.prototype.disableAlsaOutput = function() {
    var self = this;
    log("disable alsa output");
    var defer = libQ.defer();

    self.context.coreCommand.executeOnPlugin('music_service', 'mpd', 'disableOutput', '0');
    self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Alsa Output Disabled');
    defer.resolve({});
    return defer.promise;
}



ControllerMultiroom.prototype.logDone = function(timeStart) {
    var self = this;
    var defer = libQ.defer();

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '------------------------------ ' + (Date.now() - timeStart) + 'ms');

    defer.resolve({});
    return defer.promise;
};

ControllerMultiroom.prototype.logStart = function(sCommand) {
    var self = this;
    var defer = libQ.defer();

    self.commandRouter.pushConsoleMessage('\n' + '[' + Date.now() + '] ' + '---------------------------- ' + sCommand);

    defer.resolve({});
    return defer.promise;
};


'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var execSync = require('child_process').execSync;
var exec = require('child_process').exec;
const os = require('os');
const kernelMajor = os.release().slice(0, os.release().indexOf('.'));
const kernelMinor = os.release().slice(os.release().indexOf('.') + 1, os.release().indexOf('.', os.release().indexOf('.') + 1));

// Define the IrController class
module.exports = IrController;


function IrController(context) {
    var self = this;
    // Save a reference to the parent commandRouter
    self.context = context;
    self.commandRouter = self.context.coreCommand;
    self.logger=self.commandRouter.logger;
    self.configManager = self.context.configManager;


}

IrController.prototype.onVolumioStart = function()
{
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();

}

IrController.prototype.getConfigurationFiles = function()
{
    return ['config.json'];
}

IrController.prototype.onStop = function() {
    var self = this;

    var defer = libQ.defer();

    return defer.promise;
};

IrController.prototype.onStart = function() {
    var self = this;

    var defer = libQ.defer();

    var defer = libQ.defer();
    var device = self.getAdditionalConf("system_controller", "system", "device");

    var ir_profile = self.config.get('ir_profile', "2wire/2wire.lircd.conf");

    self.saveIROptions({"ir_profile":{"value": ir_profile, "notify":false}});
    defer.resolve();

    return defer.promise;
};

IrController.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};


IrController.prototype.restartLirc = function (message) {
    var self = this;

    exec('usr/bin/sudo /bin/systemctl stop lircd.service', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Cannot kill irexec: '+error);
            }
            setTimeout(function(){

		    exec('usr/bin/sudo /bin/systemctl start lircd.service', {uid:1000,gid:1000},
			function (error, stdout, stderr) {
			    if(error != null) {
				self.logger.info('Error restarting LIRC: '+error);
				if (message){
				    self.commandRouter.pushToastMessage('error', 'IR Controller', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_ERROR'));
				}
			    } else {

				    exec('usr/bin/sudo /bin/systemctl start irexec.service', {uid:1000,gid:1000},
					function (error, stdout, stderr) {
					    if(error != null) {
						self.logger.info('Error restarting LIRC: '+error);
						if (message){
						    self.commandRouter.pushToastMessage('error', 'IR Controller', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_ERROR'));
						}
					    } else {

						self.logger.info('lirc correctly started');
						if (message){
						    self.commandRouter.pushToastMessage('success', 'IR Controller', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));
						}
					    }
					});
			    }
			});
            },1000)
    });
}

IrController.prototype.saveIROptions = function (data) {
    var self = this;

    self.config.set("ir_profile", data.ir_profile.value);

    var profileFolder = data.ir_profile.value;

    exec('/usr/bin/sudo /bin/chmod -R 777 /etc/lirc/lircd.conf.d', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error setting lirc conf file perms: '+error);
            } else {
                self.logger.info('lirc permissions set');
                exec('/bin/cp -r ' + __dirname +'/remotes/'+profileFolder +
                    ' /etc/lirc/lircd.conf.d/volumio.lircd.conf', {uid:1000,gid:1000},
                    function (error, stdout, stderr) {
                        if(error != null) {
                            self.logger.info('Error copying configurations: '+error);
                            self.commandRouter.pushToastMessage('error', 'IR Controller', self.commandRouter.getI18nString('COMMON.SETTINGS_SAVE_ERROR'));
                        } else {
                            self.logger.info('lirc correctly updated');
                            self.commandRouter.pushToastMessage('success', 'IR Controller', self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
                            setTimeout(function(){

                                if (data.ir_profile.notify == undefined || data.ir_profile.notify == false){
                                    self.restartLirc(true);
                                }

                            },1000)

                        }
                    });

            }
        });
}

IrController.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');
    var remote_manufacturers = fs.readdirSync(__dirname + "/remotes");

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            var activeProfile = self.config.get("ir_profile", "2wire/2wire.lircd.conf");
            uiconf.sections[0].content[0].value.value = activeProfile;
	    var psplit=activeProfile.split("/");
            uiconf.sections[0].content[0].value.label = psplit[0].replace("_"," ").toUpperCase()+" - "+psplit[1].replace(".lircd.conf","");

            self.logger.info('Got to here');
            for (var i = 0; i < remote_manufacturers.length; i++) {
		        var remotes=fs.readdirSync(__dirname + "/remotes/" + remote_manufacturers[i]);
			for (var j = 0; j < remotes.length; j++) {
				if(remotes[j].includes('lircd.conf')){
					self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[0].options', {
					    value: remote_manufacturers[i]+"/"+remotes[j],
					    label: remote_manufacturers[i].replace("_"," ").toUpperCase()+" - "+remotes[j].replace(".lircd.conf","")
					});
				}
			}
            }

            self.logger.info('Got to there');

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};



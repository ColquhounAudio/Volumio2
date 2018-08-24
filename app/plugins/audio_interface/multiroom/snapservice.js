var pidof = require('pidof');
var exec = require('child_process').exec;
var spawn =  require('child_process').spawn;
var Inotify = require('inotify').Inotify;
var fs=require('fs-extra');
var self=this;

init();

function init(){
//creating server control file and giving permissions
fs.writeFile('/tmp/snapserver', 'stop', function (err) {
          if (err) throw err;
          exec("/bin/chown volumio:volumio /tmp/snapserver", function (error, stdout, stderr) {
            if (error) {
              console.log('Cannot Grant Permissions' + error);
            }
            else {
            console.log('Starting Server Watch');
            return addWatchServer();
            }
      });
    });

//creating client control file and giving permissions
fs.writeFile('/tmp/snapclient', 'stop', function (err) {
              if (err) throw err;
              exec("/bin/chown volumio:volumio /tmp/snapclient", function (error, stdout, stderr) {
                if (error) {
                  console.log('Cannot Grant Permissions' + error);
                }
                else {
                console.log('Starting Client Watch');
                return addWatchClient();
                }
          });
        });
}



function addWatchServer() {

  var self=this;
  self.inotify = new Inotify();

    console.log("Adding watch for file Server");
    var file = '/tmp/snapserver';
    var watch = {
        path: file,
        watch_for: Inotify.IN_CLOSE_WRITE,
        callback: server
    };

    fs.ensureFileSync(file);
    self.inotify.addWatch(watch);

    return watch;
}

function addWatchClient() {

  var self=this;
  self.inotify = new Inotify();
    var file= '/tmp/snapclient';
    console.log("Adding watch for file Client");
    var watch = {
        path: file,
        watch_for: Inotify.IN_CLOSE_WRITE,
        callback: client
    };

    fs.ensureFileSync(file);
    self.inotify.addWatch(watch);

    return watch;
}


function server(){
  var self=this;

  try
  {
      var content = fs.readJsonSync('/tmp/snapserver');
      console.log('Snapserver command' + content.action);
      switch(content.action)

{
case 'start':
  startServer(content.parameters);
  break;
case 'stop':
  stopServer();
  break;
default:
  console.log('Invalid interchange file')
}
}
catch(error)
{
    console.log(error)
}
}

function client(){
  try
  {
      var content = fs.readJsonSync('/tmp/snapclient');
      console.log('Snapclient Command' + content.action);

  switch(content.action)
  {
  case 'start':
  startClient(content.parameters);
  break;
  case 'stop':
  stopClient();
  break;
  default:
  console.log('Invalid interchange file')
  }
  }

  catch(error)
  {
      console.log(error)
  }

}


function startServer(parameters) {
  exec("/usr/sbin/snapserver " + parameters, function (error, stdout, stderr) {
    if (error) {
      console.log('Cannot Start Snapclient' + error);
    }
    else {
    return console.log('started');
    }

  });
}


function stopServer() {
  exec(" /usr/bin/killall /usr/sbin/snapserver", function (error, stdout, stderr) {
    if (error) {
      console.log('Cannot Kill Snapserver' + error);
    }
    else {
    return console.log('Snapserver Killed');
    }

  });
}

function startClient(parameters) {
  exec("/usr/sbin/snapclient " + parameters, function (error, stdout, stderr) {
    if (error) {
      console.log('Cannot Start Snapclient' + error);
    }
    else {
    return console.log('Snapclient Started');
    }

  });
}

function stopClient() {
  exec("/usr/bin/killall /usr/sbin/snapclient", function (error, stdout, stderr) {
    if (error) {
      console.log('Cannot Kill Snapserver' + error);
    }
    else {
    return console.log('Snapclient Killed');
    }

  });
}

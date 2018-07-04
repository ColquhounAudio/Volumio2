#!/usr/local/bin/node
/**
 * Created by massi on 30/08/15.
 * Save data to /data/configuration/system_controller/network/config.json
 */
var io=require('socket.io-client');
var exec = require('child_process').exec;
var socket= io.connect('http://localhost:3000');
var fs = require('fs');

exec(" systemctl restart avahi-daemon.service " );
exec('/usr/bin/sudo /bin/systemctl start volumio.service', {uid:1000, gid:1000}, function (error, stdout, stderr) {
    if (error) {
        console.log('PUSHSSID: Cannot start Volumio: '+error);
    } else {
        console.log('PUSHSSID: Volumio Started');
    }
        try {
            fs.accessSync('/etc/airplayd/airplayname', fs.F_OK);
            fs.readFile('/etc/airplayd/airplayname', 'utf8', function (err,airplayname) {
                if (err) {
                    return console.log('PUSHSSID: Cannot read Airplayname: ' + err);
                } else {
                    console.log('PUSHSSID: Setting Airplay name to: '+airplayname)
                    var name={
                        "endpoint":"system_controller/system",
                        "method":"saveGeneralSettings",
                        "data": {'player_name': airplayname, 'startup_sound':true}
                    };

                    socket.emit('callMethod',name);
                    setNetwork();
                }
            });

        } catch (e) {
            console.log('PUSHSSID: No Airplay name file found')
            setNetwork();
        }

});

function setNetwork(){

    console.log('PUSHSSID: Setting Network');
    exec('/usr/bin/sudo /bin/chmod -R 777 /etc/wpa_supplicant/', {uid:1000, gid:1000}, function (error, stdout, stderr) {
        if (error) {
            console.log('PUSHSSID: Cannot set wpa supplicant files conf permission: '+error);
        } else {
            console.log('PUSHSSID: Wpa supplicant files permission given');
    if (process.argv[2] && process.argv[3]) {
        console.log('PUSHSSID: SSID: '+process.argv[2] + ' PASS: '+ process.argv[3]);
        var wacnet={
            "endpoint":"system_controller/network",
            "method":"saveWirelessNetworkSettings",
            "data": {'ssid': process.argv[2], 'password':process.argv[3]}
        };
    } else  if (process.argv[2]) {
        console.log('PUSHSSID: SSID: '+process.argv[2])
        var wacnet={
            "endpoint":"system_controller/network",
            "method":"saveWirelessNetworkSettingsWAC",
            "data": {'ssid': process.argv[2], 'password':''}
        };
    } else {
        console.log('PUSHSSID: No credentials supplied')
    }
    socket.emit('callMethod', wacnet);
        }
    });
}
exec( " cp /etc/hostapd/hostapd.conf.save /etc/hostapd/hostapd.conf " );
exec( " cp /etc/hostapd/hostapd.conf.save /etc/hostapd/hostapd.tmpl " );

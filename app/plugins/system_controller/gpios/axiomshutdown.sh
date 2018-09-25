#GPIO PIN that controls shutdown

#syncing changes to disk for safe shutdown
/bin/sync
# Setting Karaoke low (GPIO 13)
gpio mode 23 out
gpio write 23 low
#Setting GPIO4 as output
gpio mode 7 out
#Writing low
gpio write 7 0
#Shutting down
sudo systemctl stop avahi-daemon
sudo /sbin/shutdown

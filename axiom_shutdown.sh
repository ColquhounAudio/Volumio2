#!/bin/bash
#
# axiom_shutdown.sh
#
# 20180406 RMPckering - Perform any necessary pre-shutdown tasks, then set GPIO4 out and low to trigger Axiom board power down sequence
# 20180809 GGiraudon - Added : Sync and remount fs, Interrupt execution by sleep.
# 20191219 GGiraudon - Added : Karaoke AVR shutdown
#
# NOTE: This script should run only in case of poweroff. Setting GPIO 4 out low will cause AxiomAir DAC board to cut power to the RPi.

echo "Set 4 to output"
gpio -g mode 4 out
echo "Set 4 to 0"
gpio -g write 4 0
gpio readall
echo "Save and lock fs"
#sync
#mount -o remount,ro /
#echo "Nitynight !"
#sleep 1000
/usr/local/bin/karaokectl write SKT000
exit 0

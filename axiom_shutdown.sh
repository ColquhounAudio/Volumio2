#!/bin/bash
#
# axiom_shutdown.sh
#
# 20180406 RMPckering - Perform any necessary pre-shutdown tasks, then set GPIO4 out and low to trigger Axiom board power down sequence
#
# NOTE: This script should run only in case of poweroff. Setting GPIO 4 out low will cause AxiomAir DAC board to cut power to the RPi.

gpio -g mode 4 out
gpio -g mode 4 down
gpio -g write 4 0

exit 0

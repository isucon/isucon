#!/bin/bash
export PATH=$PATH:/home/isucon/.nvm/v0.4.11/bin
export NODE_PATH=/home/isucon/node_modules/

APPDIR=$(dirname $0)/..
cd $APPDIR
exec node agent.js

#!/bin/bash
export PATH=$PATH:/home/isucon/.nvm/v0.4.10/bin
# alias node=/home/edge-bash/.nvm/v0.4.8/bin/node
export NODE_PATH=/home/isucon/.nvm/v0.4.10/lib/node_modules/

APPDIR=$(dirname $0)/..
# LIBDIR=$APPDIR/lib
cd $APPDIR
#export NODE_PATH=$LIBDIR:$NODE_PATH
exec node app.js

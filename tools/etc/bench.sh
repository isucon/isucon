#!/bin/bash
export PATH=$PATH:$HOME/.nvm/v0.4.11/bin
export NODE_PATH=$HOME/node_modules/:lib

APPDIR=$(dirname $0)/..
cd $APPDIR
exec node bench.js "$@"

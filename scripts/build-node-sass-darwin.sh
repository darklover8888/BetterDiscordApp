#!/bin/sh

PLATFORM="darwin"
ARCH="x64"

NODE_API_VERSION="64"
ELECTRON_VERSION="4.0.0-beta.11"

scripts/build-node-sass.sh $PLATFORM $ARCH $NODE_API_VERSION $ELECTRON_VERSION

NODE_API_VERSION="69"
ELECTRON_VERSION="4.0.8"

scripts/build-node-sass.sh $PLATFORM $ARCH $NODE_API_VERSION $ELECTRON_VERSION

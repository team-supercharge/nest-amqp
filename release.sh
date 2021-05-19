#!/bin/bash

set -euo pipefail

# configure Git user and e-mail for the release commit
git config user.name "supercharge-bot"
git config user.email balazs.kovacs+bot@supercharge.io

# generate changelog and new version number then create a release commit
npm run release

# start SSH agent
eval $(ssh-agent -t 60 -s)
# add SSH key to push the release commit and tag with
echo "${SUPERCHARGE_BOT_DEPLOY_KEY}" | ssh-add -

# add github.com as known host -> SSH connect won't ask it
mkdir -p ~/.ssh/
ssh-keyscan github.com >> ~/.ssh/known_hosts

# push the release commit and the new tag to the upstream
git push --follow-tags git@github.com:team-supercharge/nest-amqp.git master

# delete all manually added SSH keys
ssh-add -D
# stop SSH agent
ssh-agent -k

# remove the github.com known host
rm ~/.ssh/known_hosts

# build the production app
npm run build:prod

# copy the files to the dist directory
cp package.json README.md LICENSE dist/

# remove unnecessary devDependencies and scripts objects from the production package.json
./node_modules/.bin/json -I -f dist/package.json -e 'this.devDependencies=undefined' -e 'this.scripts=undefined'

# go to the production build directory
cd dist

# add auth token
echo "//registry.npmjs.org/:_authToken=${NPM_LOGIN_TOKEN}" > .npmrc

# publish the package to NPM
npm publish

# cleanup
rm .npmrc

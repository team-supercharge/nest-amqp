#!/bin/bash

# configure Git user and e-mail for the release commit
git config user.name "Tamás Hugyák"
git config user.email tahubu@outlook.com

# generate changelog and new version number then create a release commit
npm run release

# push the release commit and the new tag to the upstream
git push --follow-tags origin master

# build the production app
npm run build

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

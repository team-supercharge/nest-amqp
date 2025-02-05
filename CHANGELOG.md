# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 3.6.3 (2025-02-05)

### 3.6.2 (2024-06-21)

### 3.6.1 (2024-06-20)

## 3.6.0 (2024-02-07)


### Features

* **queue-service:** add `removeListener` method ([e3f16e3](https://github.com/team-supercharge/nest-amqp/commit/e3f16e37e28555723eef6869015afa8870298d1f)), closes [#70](https://github.com/team-supercharge/nest-amqp/issues/70)

### 3.5.1 (2023-07-12)

## 3.5.0 (2023-07-08)


### Features

* **nestjs:** add support to NestJS v10 ([a2f7d10](https://github.com/team-supercharge/nest-amqp/commit/a2f7d10e610b3f8760abdcc2a7df1677fda56704))

### 3.3.2 (2023-03-10)


### Bug Fixes

* **queue-service:** issue with empty object as validator options ([05c5ce8](https://github.com/team-supercharge/nest-amqp/commit/05c5ce86521b1955aa6687b3ccdb29bbc81623af))

### 3.3.1 (2023-03-10)

## 3.3.0 (2022-09-06)


### Features

* **nestjs:** add support to NestJS v9 ([7c70645](https://github.com/team-supercharge/nest-amqp/commit/7c70645e33e4d8dc9c349f14468160155a2bca20))

### 3.2.2 (2022-09-02)

### 3.2.1 (2022-06-13)

## 3.2.0 (2022-06-06)


### Features

* **class-transformer:** add support to v0.5.1 or newer v0.5.x versions ([38ad576](https://github.com/team-supercharge/nest-amqp/commit/38ad5760875c1bc0892975763916893e1d112673))

### 3.1.2 (2022-04-26)


### Bug Fixes

* **amqp-service:** rename connectionName to connectionToken ([bc3b144](https://github.com/team-supercharge/nest-amqp/commit/bc3b14457efed5efe988ad0ac2135520720086d9))

### 3.1.1 (2022-03-29)

## 3.1.0 (2022-03-29)


### Features

* **listen:** add support for Source in listener ([2cb6ee8](https://github.com/team-supercharge/nest-amqp/commit/2cb6ee829b18bfcc318bb5e5c763e3370f02e44c)), closes [#49](https://github.com/team-supercharge/nest-amqp/issues/49)

### 3.0.3 (2021-09-08)


### Bug Fixes

* **queue-service:** use toString to better check for object ([d825139](https://github.com/team-supercharge/nest-amqp/commit/d825139063a0dfbdfb95c06c1f00551044816962))

### 3.0.2 (2021-08-27)


### Bug Fixes

* export module constants ([235813a](https://github.com/team-supercharge/nest-amqp/commit/235813a471676da20493656b1f0c3de443a7d3b0))

## [3.0.1](https://github.com/team-supercharge/nest-amqp/compare/v2.3.0...v3.0.1) (2021-08-24)


### ⚠ BREAKING CHANGES

* `acceptValidationNullObjectException` is moved to `ListenOptions` and
  will not be available on `QueueModuleOptions`.
### Features

* add support to use multiple connections ([af4d5bb](https://github.com/team-supercharge/nest-amqp/commit/af4d5bb7c2861031dbb20284b87cba88b663bab7))

## 2.3.0 (2021-08-24)


### Features

* **queue-module:** throw error if no way to create provider is supplied ([d711d81](https://github.com/team-supercharge/nest-amqp/commit/d711d81344b641f43d8e85f8ae38e5eb74115209))

### 2.2.2 (2021-08-02)


### Bug Fixes

* **events:** dispatch disconnected event on connection ([5e2f21e](https://github.com/team-supercharge/nest-amqp/commit/5e2f21ebb76b278127dbc97b8ea06b8f098e5baa))

### 2.2.1 (2021-08-02)


### Bug Fixes

* try service resolution with class reference (fixes [#35](https://github.com/team-supercharge/nest-amqp/issues/35)) ([0cc7d34](https://github.com/team-supercharge/nest-amqp/commit/0cc7d344734c72b54ac6fb0886f9300f71fea0db))

## 2.2.0 (2021-08-01)


### Features

* support latest version of class-validator + class-transformer ([53a87dd](https://github.com/team-supercharge/nest-amqp/commit/53a87dde0504c22aa3fcead02e2e777181bd2a86))

## 2.1.0 (2021-08-01)


### Features

* **nest:** add support to Nest v8 ([edb044f](https://github.com/team-supercharge/nest-amqp/commit/edb044f71422d20e4dc5e864517d4f412183cb2e))

### 2.0.2 (2021-07-28)

### 2.0.1 (2021-07-24)


### Bug Fixes

* **amqp-uri:** support special chars in username + password (fix [#24](https://github.com/team-supercharge/nest-amqp/issues/24)) ([59ae5e5](https://github.com/team-supercharge/nest-amqp/commit/59ae5e53ce32b06f2227103cb0abf64666d80711))

## [2.0.0](https://github.com/team-supercharge/nest-amqp/compare/v1.3.0...v2.0.0) (2021-04-14)


### ⚠ BREAKING CHANGES

* `AMQPService.getConnectionOptions()` was renamed to `AMQPService.getModuleOptions()`.
* `QueueModule.forRoot()` method argument interface was restructured and renamed to `QueueModuleOptions`.
  The new structure (all properties are optional):
  ```javascript
  {
    "isGlobal": true,
    "logger": new MyLogger(),
    "throwExceptionOnConnectionError": true,
    "acceptValidationNullObjectException": false,
    "connectionUri": "amqp://admin:secret@127.0.0.1:5672",
    "connectionOptions": { // rhea and rhea-promise connection options go here
      "transport": "tls",
      "reconnect": false
    }
  }
  ```

### Features

* add support to use custom logger ([accdc72](https://github.com/team-supercharge/nest-amqp/commit/accdc72b253e18f4a28709c4f3599cb3153fe7e5))
* **connection-uri:** add custom protocols ([1816233](https://github.com/team-supercharge/nest-amqp/commit/1816233aacee749e958703073ecacd443b9ed1cb))
* **module:** add option to make AMQP module available globally ([d92dcc5](https://github.com/team-supercharge/nest-amqp/commit/d92dcc5026a8d91fc9b7f843d40469ce86e92235))
* **queue:** add support to work only with module options arg ([523d279](https://github.com/team-supercharge/nest-amqp/commit/523d279d307c436f3818eb4d66fa46d0275d14a9))
* add async module configuration ([de4a3df](https://github.com/team-supercharge/nest-amqp/commit/de4a3df18ba4841b1ef16e2a8d8adadd343a7b4d))


### Bug Fixes

* check connection is open to cleanup during shutdown ([e6bb019](https://github.com/team-supercharge/nest-amqp/commit/e6bb019c464447b4e5976eb9bff8f4bcf1ecdb5b))

## [1.3.0](https://github.com/team-supercharge/nest-amqp/compare/v1.2.0...v1.3.0) (2021-03-26)


### Features

* **amqp-service:** add acceptValidationNullObjectException connection option ([8d68a2f](https://github.com/team-supercharge/nest-amqp/commit/8d68a2fc1ffaaed8d01fb88a53efc66ec4ba7eef))


### Bug Fixes

* **release:** abort release on first error ([2e4cfdd](https://github.com/team-supercharge/nest-amqp/commit/2e4cfdd1569f568e87e0cf9615d42a4bd8465186))

## [1.2.0](https://github.com/team-supercharge/nest-amqp/compare/v1.0.0...v1.2.0) (2020-11-18)


### Features

* **connection:** add throwExceptionOnConnectionError connection option ([7b4ba08](https://github.com/team-supercharge/nest-amqp/commit/7b4ba08ad00bbdb741aaa3f507f941ada3cd5981))


### Bug Fixes

* import feature QueueModule in example app ([902e594](https://github.com/team-supercharge/nest-amqp/commit/902e5944d496847c160356b2e15d535548482c47))
* **readme:** spelling improvements and type fixes ([67e931e](https://github.com/team-supercharge/nest-amqp/commit/67e931e6017b9298525836bb7dd49f06d4a99e4b))

## 1.0.0 (2020-09-28)

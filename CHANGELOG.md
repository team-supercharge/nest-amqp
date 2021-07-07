# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.0.1] (2021-07-07)

### Bug Fixes
- Support username & password with special characters.


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

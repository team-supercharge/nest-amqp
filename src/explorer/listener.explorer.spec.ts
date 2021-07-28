import { Injectable, Module } from '@nestjs/common';
import { MetadataScanner } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { ListenerExplorer } from './listener.explorer';
import { Listen } from '../decorator';
import { LoggerMock } from '../test/logger.mock';
import { Logger } from '../util';

Logger.overrideLogger(new LoggerMock());

describe('ListenerExplorer', () => {
  let service: ListenerExplorer;
  let module: TestingModule;

  @Injectable()
  class TestListener {
    @Listen('queue-name')
    public listen() {}
    public doNothing() {}
  }

  @Module({ providers: [TestListener] })
  class TestModule {}

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [TestModule],
      providers: [ListenerExplorer, MetadataScanner],
    }).compile();
    service = module.get<ListenerExplorer>(ListenerExplorer);
  });

  afterEach(() => {
    module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should explore the modules', () => {
    const listenerMethods = service.explore();

    expect(listenerMethods).toHaveLength(1);
  });
});

import { Injectable, Module } from '@nestjs/common';
import { MetadataScanner } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { ListenerExplorer } from './listener.explorer';
import { Listen } from '../decorator';

describe('ListenerExplorer', () => {
  let service: ListenerExplorer;

  @Injectable()
  class TestListener {
    @Listen('queue-name')
    public listen() {}
    public doNothing() {}
  }

  @Module({ providers: [TestListener] })
  class TestModule {}

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
      providers: [ListenerExplorer, MetadataScanner],
    }).compile();
    service = module.get<ListenerExplorer>(ListenerExplorer);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should explore the modules', () => {
    const providers = service.explore();

    expect(providers).toHaveLength(1);
  });
});

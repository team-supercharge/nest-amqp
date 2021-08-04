import { AMQConnectionStorage } from './amq-connection.storage';

describe('AMQConnectionStorage', () => {
  const spySet = jest.spyOn((AMQConnectionStorage as any).storage, 'set');
  const spyGet = jest.spyOn((AMQConnectionStorage as any).storage, 'get');

  beforeEach(() => {
    ((AMQConnectionStorage as any).storage as Map<string, any>).clear();

    spySet.mockClear();
    spyGet.mockClear();
  });

  it('should add connection', () => {
    AMQConnectionStorage.add('test', {} as any);

    expect(spySet.mock.calls.length).toBe(1);
  });

  it('should retreive connection', () => {
    AMQConnectionStorage.add('test', {} as any);

    const testConnection = AMQConnectionStorage.get('test');

    expect(spySet.mock.calls.length).toBe(1);
    expect(spyGet.mock.calls.length).toBe(1);
    expect(testConnection).toEqual({});
  });

  it('should return null with no connection matching given name', () => {
    AMQConnectionStorage.add('test', {} as any);

    const testConnection = AMQConnectionStorage.get('not_existing');

    expect(spySet.mock.calls.length).toBe(1);
    expect(spyGet.mock.calls.length).toBe(1);
    expect(testConnection).toBeNull();
  });

  it('should return null with no name given', () => {
    AMQConnectionStorage.add('test', {} as any);

    const testConnection = AMQConnectionStorage.get(undefined);

    expect(spySet.mock.calls.length).toBe(1);
    expect(spyGet.mock.calls.length).toBe(0);
    expect(testConnection).toBeNull();
  });
});

import { AMQConnectionOptionsStorage } from './amqp-connection-options.storage';

describe('AMQConnectionOptionsStorage', () => {
  const spySet = jest.spyOn((AMQConnectionOptionsStorage as any).storage, 'set');
  const spyGet = jest.spyOn((AMQConnectionOptionsStorage as any).storage, 'get');

  beforeEach(() => {
    ((AMQConnectionOptionsStorage as any).storage as Map<string, any>).clear();

    spySet.mockClear();
    spyGet.mockClear();
  });

  it('should add options for connection', () => {
    AMQConnectionOptionsStorage.add('test', {} as any);

    expect(spySet.mock.calls.length).toBe(1);
  });

  it('should retreive options for connection', () => {
    AMQConnectionOptionsStorage.add('test', {} as any);

    const testConnection = AMQConnectionOptionsStorage.get('test');

    expect(spySet.mock.calls.length).toBe(1);
    expect(spyGet.mock.calls.length).toBe(1);
    expect(testConnection).toEqual({});
  });

  it('should return null with no options matching given connection', () => {
    AMQConnectionOptionsStorage.add('test', {} as any);

    const testConnection = AMQConnectionOptionsStorage.get('not_existing');

    expect(spySet.mock.calls.length).toBe(1);
    expect(spyGet.mock.calls.length).toBe(1);
    expect(testConnection).toBeNull();
  });

  it('should return null with no connection given', () => {
    AMQConnectionOptionsStorage.add('test', {} as any);

    const testConnection = AMQConnectionOptionsStorage.get(undefined);

    expect(spySet.mock.calls.length).toBe(1);
    expect(spyGet.mock.calls.length).toBe(0);
    expect(testConnection).toBeNull();
  });

  it('should return all the option keys', () => {
    AMQConnectionOptionsStorage.add('key1', { connectionUri: 'does not matter' });
    AMQConnectionOptionsStorage.add('key2', { connectionUri: 'does not matter' });

    expect(AMQConnectionOptionsStorage.getKeys()).toEqual(['key1', 'key2']);
  });
});

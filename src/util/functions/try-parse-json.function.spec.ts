import { tryParseJSON } from './try-parse-json.function';

describe('tryParseJSON()', () => {
  it('should parse an empty object', () => {
    expect(tryParseJSON('{}')).toEqual({});
  });

  it('should parse a not empty object', () => {
    expect(tryParseJSON('{"name":"Peter","age":20}')).toEqual({ name: 'Peter', age: 20 });
  });

  it('should not parse null value', () => {
    expect(tryParseJSON('null')).toEqual(undefined);
  });

  it('should return false on parse error', () => {
    expect(tryParseJSON('text')).toEqual(undefined);
  });
});

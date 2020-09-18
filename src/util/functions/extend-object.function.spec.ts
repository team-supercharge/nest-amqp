import { extendObject } from './extend-object.function';

describe('extendObject()', () => {
  it('should override existing properties', () => {
    expect(extendObject({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('should add new properties', () => {
    expect(extendObject({ a: 1 }, { b: 1 })).toEqual({ a: 1, b: 1 });
  });

  it('should extend sub-object properties', () => {
    expect(extendObject({ a: 1, b: { c: 2 } }, { b: { d: 3 } })).toEqual({ a: 1, b: { c: 2, d: 3 } });
  });

  it('should add sub-object if not exists', () => {
    expect(extendObject({ a: 1 }, { b: { c: 2 } })).toEqual({ a: 1, b: { c: 2 } });
  });
});

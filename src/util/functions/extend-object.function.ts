const toString: () => string = Object.prototype.toString;

/**
 * The source object's properties will be merged to the target object.
 *
 * @param {Record<string, any>} target Target object.
 * @param {Record<string, any>} source Source object which will be merged to target object.
 *
 * @return {Record<string, any>} The merged object.
 */
export function extendObject(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const sourceKeys = Object.keys(source);

  for (const key of sourceKeys) {
    if (toString.call(source[key]) === '[object Object]') {
      if (!target[key]) {
        target[key] = {};
      }
      target[key] = extendObject(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }

  return target;
}

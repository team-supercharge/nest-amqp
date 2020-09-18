/**
 * Try to parse a string value into an object. If the parsing fails then `false`
 * value will be returned.
 *
 * @param {string} jsonString Object as string.
 * @return {(T|boolean)} Parsed object or false.
 */
export function tryParseJSON<T = any>(jsonString: string): T | boolean {
  try {
    const o = JSON.parse(jsonString);

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsy, so this suffices:
    if (o && typeof o === 'object') {
      return o;
    }
  } catch (e) {
    return false;
  }
}

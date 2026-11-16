// The value of a JSON-LD property: the first `@value` of an expanded property, or the property itself.
export function readValue(object: any, name: string): any {
  const first = object?.[name]?.at?.(0);
  if (first !== null && typeof first === "object" && "@value" in first) {
    return first["@value"];
  }
  return object?.[name];
}

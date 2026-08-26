import { isCanonicalAuthRequestHost, readCanonicalAuthOrigin } from "@/lib/auth-origin";

describe("School Screen canonical auth origin", () => {
  it("accepts only the configured HTTPS canonical origin", () => {
    expect(readCanonicalAuthOrigin("https://asasplus.shop")?.href).toBe("https://asasplus.shop/");
    expect(() => readCanonicalAuthOrigin("http://asasplus.shop")).toThrow();
    expect(() => readCanonicalAuthOrigin("https://www.asasplus.shop")).toThrow();
    expect(() => readCanonicalAuthOrigin("https://asasplus.shop/auth")).toThrow();
  });

  it("requires an exact forwarded or direct canonical host", () => {
    const origin = readCanonicalAuthOrigin("https://asasplus.shop");
    const canonical = new Headers({ host: "asasplus.shop" });
    const proxiedCanonical = new Headers({ host: "localhost:3106", "x-forwarded-host": "asasplus.shop" });
    const untrusted = new Headers({ host: "evil.example" });

    expect(isCanonicalAuthRequestHost(canonical, origin)).toBe(true);
    expect(isCanonicalAuthRequestHost(proxiedCanonical, origin)).toBe(true);
    expect(isCanonicalAuthRequestHost(untrusted, origin)).toBe(false);
  });
});

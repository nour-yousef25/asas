/**
 * BullMQ depends on ESM-only transitive packages that Jest does not transform
 * in this project. Real infrastructure evidence is intentionally executed by
 * `npm run test:w01:redis`, which uses tsx and a real Redis/Prisma runtime.
 */
describe.skip("W01 Redis/BullMQ Jest runner boundary", () => {
  it("keeps the runtime integration harness outside Jest", () => {
    expect(true).toBe(true);
  });
});

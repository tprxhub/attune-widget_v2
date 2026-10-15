import { describe, expect, test } from "bun:test";
import { contactErrors } from "./pulseContact";

describe("Play Pulse contact form", () => {
  test("accepts real details", () => {
    expect(
      contactErrors({ name: "Sara Khan", email: "sara@example.com", phone: "+971 50 123 4567" }),
    ).toEqual({});
    expect(contactErrors({ name: "Li", email: "li@x.co", phone: "050-123 4567" })).toEqual({});
  });

  test("flags each missing or malformed field", () => {
    const errors = contactErrors({ name: " ", email: "sara@", phone: "12" });
    expect(Object.keys(errors).sort()).toEqual(["email", "name", "phone"]);
    expect(
      contactErrors({ name: "Sam", email: "s@x.io", phone: "+1 234 567 890 123 456" }).phone,
    ).toBeDefined();
  });
});

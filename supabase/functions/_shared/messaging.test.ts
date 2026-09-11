import { getDirectMessageEligibility } from "./messaging.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

Deno.test("direct-message eligibility uses the canonical database predicate", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve({ data: "eligible", error: null });
    },
  };

  const status = await getDirectMessageEligibility(
    client as never,
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222"
  );

  assertEquals(status, "eligible");
  assertEquals(calls, [{
    name: "direct_message_pair_status",
    args: {
      p_user_a: "11111111-1111-1111-1111-111111111111",
      p_user_b: "22222222-2222-2222-2222-222222222222",
    },
  }]);
});

Deno.test("direct-message eligibility preserves non-sensitive denial states", async () => {
  for (const status of ["relationship_required", "restricted"] as const) {
    const client = {
      rpc: () => Promise.resolve({ data: status, error: null }),
    };
    assertEquals(
      await getDirectMessageEligibility(client as never, "reader-a", "reader-b"),
      status
    );
  }
});

Deno.test("direct-message eligibility fails closed on malformed database output", async () => {
  const client = {
    rpc: () => Promise.resolve({ data: "unexpected", error: null }),
  };
  let failed = false;
  try {
    await getDirectMessageEligibility(client as never, "reader-a", "reader-b");
  } catch {
    failed = true;
  }
  assertEquals(failed, true);
});

Deno.test("direct-message eligibility propagates database failures", async () => {
  const expected = new Error("lookup failed");
  const client = {
    rpc: () => Promise.resolve({ data: null, error: expected }),
  };
  let actual: unknown = null;
  try {
    await getDirectMessageEligibility(client as never, "reader-a", "reader-b");
  } catch (error) {
    actual = error;
  }
  assertEquals(actual, expected);
});

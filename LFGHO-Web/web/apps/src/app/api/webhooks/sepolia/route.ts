import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";
import { sepolia } from "viem/chains";

const rawContractSchema = z.object({
  rawValue: z.string(),
  address: z.string().optional(),
  decimals: z.number(),
});

const activitySchema = z.object({
  category: z.string(),
  fromAddress: z.string(),
  toAddress: z.string(),
  erc721TokenId: z.string().nullable().optional(),
  erc1155Metadata: z.unknown().nullable().optional(), // Adjust type as needed
  asset: z.string(),
  value: z.number(),
  blockNum: z.string(),
  hash: z.string(),
  typeTraceAddress: z.string().nullable().optional(),
  rawContract: rawContractSchema,
});

const eventSchema = z.object({
  network: z.string(),
  activity: z.array(activitySchema),
});

const alchemyWebhookTypeSchema = z.union([
  z.literal("MINED_TRANSACTION"),
  z.literal("DROPPED_TRANSACTION"),
  z.literal("ADDRESS_ACTIVITY"),
]);

const webhookResponseSchema = z.object({
  webhookId: z.string(),
  id: z.string(),
  createdAt: z.string(),
  type: alchemyWebhookTypeSchema,
  event: eventSchema,
});

function isValidBody(
  body: string,
  signature: string,
  signingKey: string
): boolean {
  const hmac = createHmac("sha256", signingKey); // Create a HMAC SHA256 hash using the signing key
  hmac.update(body, "utf8"); // Update the token hash with the request body using utf8
  const digest = hmac.digest("hex");
  return signature === digest;
}

export async function POST(req: NextRequest) {

  const body = await req.json();

  console.info("Received", JSON.stringify(body, null, 2));

  const payload = webhookResponseSchema.parse(body);

  const transfers = payload.event.activity.map((activity) => {
    return {
      chainId: sepolia.id,
      fromAddress: activity.fromAddress.toLowerCase(),
      toAddress: activity.toAddress.toLowerCase(),
      token: {
        name: activity.asset.toLowerCase(),
        amount: activity.value,
        address: activity.rawContract.address?.toLowerCase() ?? "",
      },
    };
  });

  const events = transfers.map((transfer) => {
    return {
      name: "app/tokens.received" as const,
      data: transfer,
    };
  });

  if (events.length > 0) {
    console.info("Sent");
  }

  return NextResponse.json({ ok: true });
}

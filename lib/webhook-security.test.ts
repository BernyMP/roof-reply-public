import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import {
  createTelnyxPublicKey,
  validateTelnyxSignature,
  resolveTelnyxPublicKey,
  shouldRejectMissingSignature,
} from "./webhook-security.ts";

test("rejects missing signature headers in production", () => {
  assert.equal(
    shouldRejectMissingSignature({
      signature: null,
      timestamp: null,
      nodeEnv: "production",
    }),
    true
  );
});

test("rejects missing signature headers in development", () => {
  assert.equal(
    shouldRejectMissingSignature({
      signature: null,
      timestamp: null,
      nodeEnv: "development",
    }),
    true
  );
});

test("does not reject when both signature headers are present", () => {
  assert.equal(
    shouldRejectMissingSignature({
      signature: "sig",
      timestamp: "123",
      nodeEnv: "production",
    }),
    false
  );
});

test("uses TELNYX_PUBLIC_KEY for webhook signature validation", () => {
  assert.equal(
    resolveTelnyxPublicKey({
      TELNYX_PUBLIC_KEY: "telnyx-public-key",
    }),
    "telnyx-public-key"
  );
});

test("does not read a separate webhook public key env var", () => {
  assert.equal(resolveTelnyxPublicKey({}), undefined);
});

test("creates an Ed25519 key from Telnyx raw base64 public key format", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({
    format: "der",
    type: "spki",
  }) as Buffer;
  const rawPublicKey = publicKeyDer.subarray(-32).toString("base64");
  const signedPayload = Buffer.from("123|{\"event\":\"message.received\"}");
  const signature = crypto.sign(null, signedPayload, privateKey);

  assert.equal(
    crypto.verify(
      null,
      signedPayload,
      createTelnyxPublicKey(rawPublicKey),
      signature
    ),
    true
  );
});

test("creates an Ed25519 key from DER SPKI base64 public key format", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({
    format: "der",
    type: "spki",
  }) as Buffer;
  const signedPayload = Buffer.from("123|{\"event\":\"message.received\"}");
  const signature = crypto.sign(null, signedPayload, privateKey);

  assert.equal(
    crypto.verify(
      null,
      signedPayload,
      createTelnyxPublicKey(publicKeyDer.toString("base64")),
      signature
    ),
    true
  );
});


test("validates the raw signature and rejects changed bodies, malformed timestamps, and expired events", () => {
  const old=process.env.TELNYX_PUBLIC_KEY;
  const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
  process.env.TELNYX_PUBLIC_KEY=(publicKey.export({format:"der",type:"spki"}) as Buffer).subarray(-32).toString("base64");
  try {
    const body='{"data":{"id":"event"}}',time=String(Math.floor(Date.now()/1000));
    const sign=(timestamp:string)=>crypto.sign(null,Buffer.from(`${timestamp}|${body}`),privateKey).toString("base64");
    assert.equal(validateTelnyxSignature(body,sign(time),time).valid,true);
    assert.equal(validateTelnyxSignature(body+" ",sign(time),time).valid,false);
    assert.equal(validateTelnyxSignature(body,sign(time+"abc"),time+"abc").valid,false);
    const expired=String(Number(time)-600);
    assert.equal(validateTelnyxSignature(body,sign(expired),expired).valid,false);
    delete process.env.TELNYX_PUBLIC_KEY;
    assert.equal(validateTelnyxSignature(body,sign(time),time).valid,false);
  } finally {if(old===undefined)delete process.env.TELNYX_PUBLIC_KEY;else process.env.TELNYX_PUBLIC_KEY=old;}
});

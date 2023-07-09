import { Principal } from "azle";
import {
  Address,
  TransferFee,
  hexAddressFromPrincipal,
  Ledger,
  Tokens,
  TransferResult,
} from 'azle/canisters/ledger';

import { v4 as uuidv4 } from 'uuid';

type Coffee = {
  id: string;
  name: string;
  timestamp: bigint;
  message: string;
};

type CoffeePayload = {
  name: string;
  message: string;
  amount: bigint;
};

const icpCanisterAddress: Address = "bkyz2-fmaaa-aaaaa-qaaaq-cai";

const icpCanister = new Ledger(
  Principal.fromText(icpCanisterAddress)
);

const coffeeStorage = new StableBTreeMap<string, Coffee>(0, 44, 1024);

export function getCoffees(): Coffee[] {
  return coffeeStorage.values();
}

export function getCoffee(id: string): Coffee | null {
  return coffeeStorage.get(id) || null;
}

export async function sendCoffee(payload: CoffeePayload): Promise<Coffee> {
  await depositCoffee(payload.amount);
  const coffee: Coffee = { id: uuidv4(), timestamp: BigInt(Date.now()), ...payload };
  coffeeStorage.insert(coffee.id, coffee);
  return coffee;
}

export function deleteCoffee(id: string): Coffee | null {
  const coffee = coffeeStorage.remove(id);
  if (coffee) {
    return coffee;
  }
  return null;
}

async function depositCoffee(amount: bigint): Promise<TransferResult> {
  const balance = (await getAccountBalance(ic.caller().toText()))?.Ok?.e8s;
  const transferFee = (await getTransferFee())?.Ok?.transfer_fee?.e8s;

  if (balance !== undefined && balance >= amount) {
    return await icpCanister.transfer({
      memo: 0n,
      amount: { e8s: amount },
      fee: { e8s: transferFee ?? 10000n },
      from_subaccount: null,
      to: binaryAddressFromAddress(icpCanisterAddress),
      created_at_time: null
    }).call();
  } else {
    throw new Error("Fund your account first");
  }
}

export async function withdrawFunds(
  to: Address,
  amount: bigint
): Promise<TransferResult> {
  if (ic.caller() !== owner) {
    throw new Error("Only owner can withdraw funds");
  }

  const balance = (await getAccountBalance(icpCanisterAddress))?.Ok?.e8s;
  const transferFee = (await getTransferFee())?.Ok?.transfer_fee?.e8s;

  if (balance !== undefined && balance >= amount) {
    return await icpCanister.transfer({
      memo: 0n,
      amount: { e8s: amount },
      fee: { e8s: transferFee ?? 10000n },
      from_subaccount: null,
      to: binaryAddressFromAddress(to),
      created_at_time: null
    }).call();
  } else {
    throw new Error("Fund your account first");
  }
}

async function getAccountBalance(address: Address): Promise<Tokens | null> {
  const result = await icpCanister.account_balance({
    account: binaryAddressFromAddress(address)
  }).call();

  return result?.Ok || null;
}

async function getTransferFee(): Promise<TransferFee | null> {
  const result = await icpCanister.transfer_fee({}).call();

  return result?.Ok || null;
}

// Provide documentation for the functions and parameters

/**
 * Get the hexadecimal address string from a Principal.
 * @param principal The Principal to convert.
 * @returns The hexadecimal address string.
 */
export function getAddressFromPrincipal(principal: Principal): string {
  return hexAddressFromPrincipal(principal, 0);
}

// Set the owner based on the text representation of the Principal
const owner: Principal = Principal.fromText("bnz7o-iuaaa-aaaaa-qaaaa-cai");

// Generate random UUIDs using a more compatible approach
function generateUUID(): string {
  let uuid = '';
  for (let i = 0; i < 32; i++) {
    uuid += Math.floor(Math.random() * 16).toString(16);
  }
  return `${uuid.substr(0, 8)}-${uuid.substr(8, 4)}-${uuid.substr(12, 4)}-${uuid.substr(16, 4)}-${uuid.substr(20)}`;
}

globalThis.crypto = {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
};

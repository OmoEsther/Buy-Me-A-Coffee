import { $query, $update, Record, StableBTreeMap, Vec, Opt, match, Result, nat64, ic, Principal } from "azle";
import {
    Address,
    binaryAddressFromAddress,
    TransferFee,
    hexAddressFromPrincipal,
    Ledger,
    Tokens,
    TransferResult
} from 'azle/canisters/ledger';

import { v4 as uuidv4 } from 'uuid';

type Coffee = Record<{
    id: string;
    name: string;
    timestamp: nat64;
    message: string;
}>

type CoffeePayload = Record<{
    name: string;
    message: string;
    amount: nat64
}>

// set up with address of canister
const icpCanisterAddress: Address = "bkyz2-fmaaa-aaaaa-qaaaq-cai"

const icpCanister = new Ledger(
    Principal.fromText(icpCanisterAddress)
);

// set up with wallet of local user 
const owner: Principal = Principal.fromText("bnz7o-iuaaa-aaaaa-qaaaa-cai")

const coffeeStorage = new StableBTreeMap<string, Coffee>(0, 44, 1024);

$query;
export function getAddressFromPrincipal(principal: Principal): string {
    return hexAddressFromPrincipal(principal, 0);
}

$query;
export function getCoffees(): Result<Vec<Coffee>, string> {
    return Result.Ok(coffeeStorage.values());
}

$query;
export function getCoffee(id: string): Result<Coffee, string> {
    return match(coffeeStorage.get(id), {
        Some: (coffee) => Result.Ok<Coffee, string>(coffee),
        None: () => Result.Err<Coffee, string>(`coffee information with id=${id} not found`)
    });
}

$update;
export async function sendCoffee(payload: CoffeePayload): Promise<Result<Coffee, string>> {
    await depositCoffee(payload.amount);
    const coffee: Coffee = { id: uuidv4(), timestamp: ic.time(), ...payload };
    coffeeStorage.insert(coffee.id, coffee);
    return Result.Ok<Coffee, string>(coffee);
}

$update;
export function deleteCoffee(id: string): Result<Coffee, string> {
    return match(coffeeStorage.remove(id), {
        Some: (deletedCoffee) => Result.Ok<Coffee, string>(deletedCoffee),
        None: () => Result.Err<Coffee, string>(`couldn't delete coffee with id=${id}. message not found.`)
    });
}

$query;
export function searchCoffeeByCriteria(criteria: string): Result<Vec<Coffee>, string> {
    const filteredCoffees = coffeeStorage.values().filter((coffee) => {
        return (
            coffee.name.toLowerCase().includes(criteria.toLowerCase()) ||
            coffee.message.toLowerCase().includes(criteria.toLowerCase())
        );
    });
    return Result.Ok(filteredCoffees);
}

$update;
export function updateCoffee(id: string, updatedCoffee: CoffeePayload): Result<Coffee, string> {
    const existingCoffee = coffeeStorage.get(id);
    if (!existingCoffee) {
        return Result.Err(`coffee information with id=${id} not found`);
    }

    const updatedRecord: Coffee = {
        ...existingCoffee,
        name: updatedCoffee.name,
        message: updatedCoffee.message,
    };

    coffeeStorage.insert(id, updatedRecord);

    return Result.Ok(updatedRecord);
}

$query;
export function getCoffeesWithPagination(pageSize: number, page: number): Result<Vec<Coffee>, string> {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const coffees = coffeeStorage.values();

    if (startIndex >= coffees.length) {
        return Result.Err("Invalid page number");
    }

    const paginatedCoffees = coffees.slice(startIndex, endIndex);

    return Result.Ok(paginatedCoffees);
}

$update;
export async function withdrawFunds(
    to: Address,
    amount: nat64,
): Promise<Result<TransferResult, string>> {
    if(ic.caller() !== owner){
        ic.trap("Only owner can withdraw funds")
    }
    const balance = (await getAccountBalance(icpCanisterAddress)).Ok?.e8s;
    const transfer_fee = (await getTransferFee()).Ok?.transfer_fee.e8s;

    if(balance !== undefined && balance > amount){
        return await icpCanister
        .transfer({
            memo: 0n,
            amount: {
                e8s: amount
            },
            fee: {
                e8s: transfer_fee? transfer_fee : 10000n 
            },
            from_subaccount: Opt.None,
            to: binaryAddressFromAddress(to),
            created_at_time: Opt.None
        })
        .call();
    }else{
        ic.trap("Fund your account first")
    }
}

async function getAccountBalance(
    address: Address
): Promise<Result<Tokens, string>> {
    return await icpCanister
        .account_balance({
            account: binaryAddressFromAddress(address)
        })
        .call();
}

async function getTransferFee(): Promise<Result<TransferFee, string>> {
    return await icpCanister.transfer_fee({}).call();
}


// a workaround to make uuid package work with Azle
globalThis.crypto = {
    //@ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }
};

export default {
    getAddressFromPrincipal,
    getCoffees,
    getCoffee,
    sendCoffee,
    deleteCoffee,
    searchCoffeeByCriteria,
    updateCoffee,
    getCoffeesWithPagination,
    withdrawFunds
};
